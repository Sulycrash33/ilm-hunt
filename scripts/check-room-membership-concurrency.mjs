import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const { Client } = require(process.env.PG_MODULE || 'pg');
const [connectionString, patchPath, repoPath] = process.argv.slice(2);
if (!connectionString || !patchPath || !repoPath) {
  throw new Error('Usage: node check-room-membership-concurrency.mjs <local PostgreSQL URL> <patch.sql> <repo path>');
}
const url = new URL(connectionString);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Only local disposable PostgreSQL is allowed');
assert.equal(url.pathname, '/membership_concurrency', 'Use the dedicated disposable membership_concurrency database');
const clients = [];
async function connect() {
  const client = new Client({ connectionString });
  await client.connect();
  clients.push(client);
  await client.query("set statement_timeout='15s'; set lock_timeout='12s'");
  client.pid = (await client.query('select pg_backend_pid() pid')).rows[0].pid;
  return client;
}
const host = '00000000-0000-0000-0000-000000000001';
const guest = '00000000-0000-0000-0000-000000000002';
const outsider = '00000000-0000-0000-0000-000000000003';
const room = '10000000-0000-0000-0000-000000000001';
const checks = [];
const lockEvidence = [];
let admin, first, second;
async function setup() {
  assert.equal((await admin.query("select count(*)::int n from information_schema.tables where table_schema='public'")).rows[0].n, 0,
    'Refusing to overwrite a populated database');
  // Reuse the exact schema/policy/identity/round setup from the reviewed sequential fixture.
  // This is local test code, loaded from the explicitly supplied checkout.
  const fixture = fs.readFileSync(path.join(repoPath, 'scripts/check-room-membership-db.mjs'), 'utf8');
  const start = fixture.indexOf('  await db.exec(`create role anon;');
  const end = fixture.indexOf("  await db.exec(fs.readFileSync(patchPath,'utf8'));", start);
  assert.ok(start >= 0 && end > start, 'Fixture setup markers must match');
  let setupCode = fixture.slice(start, end)
    .replace('create role anon; create role authenticated;',
      "do $$begin if not exists(select from pg_roles where rolname='anon') then create role anon; end if; if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if; end$$;")
    .replaceAll('db.exec(', 'admin.query(')
    .replaceAll("fs.readFileSync('supabase/", "fs.readFileSync(repoPath+'/supabase/");
  await new Function('admin', 'fs', 'repoPath', `return (async()=>{${setupCode}})()`)(admin, fs, repoPath);
  await admin.query(fs.readFileSync(patchPath, 'utf8'));
  await admin.query(`insert into auth.users values('${host}'),('${guest}'),('${outsider}');
    insert into profiles values('${host}','Host',null),('${guest}','Guest',null),('${outsider}','Outsider',null);
    insert into questions(question_text,choices,correct_choice_index,pool,difficulty,review_status)
      select 'Synthetic'||n,'["A","B"]',0,'arena','medium','published' from generate_series(1,10)n`);
}
async function roomWith(users, status='waiting', capacity=2) {
  await admin.query('delete from quiz_rooms');
  await admin.query(`insert into quiz_rooms(id,code,host_id,host_name,question_count,max_players,status,current_players)
    values($1,'ABC123',$2,'Host',5,$3,$4,$5)`, [room, host, capacity, status, users.length]);
  for (const [index, user] of users.entries()) {
    await admin.query(`insert into quiz_room_players(room_id,user_id,is_host,is_ready,joined_at)
      values($1,$2,$3,true,'2026-01-01'::timestamptz + $4 * interval '1 second')`, [room, user, user===host, index]);
  }
}
async function begin(client, user) {
  await client.query('begin isolation level read committed');
  await client.query('set local role authenticated');
  await client.query("select set_config('test.user',$1,true)", [user]);
}
// Polling here observes an actual blocked transaction; the delay only limits observer traffic.
async function blocked(waiter, blocker, label) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const result = await admin.query(`select wait_event_type,wait_event,pg_blocking_pids(pid) blockers
      from pg_stat_activity where pid=$1`, [waiter.pid]);
    const row = result.rows[0];
    if (row?.wait_event_type==='Lock' && row.blockers.includes(blocker.pid)) {
      lockEvidence.push({ label, waiter:waiter.pid, blocker:blocker.pid, event:row.wait_event });
      return;
    }
    await delay(10);
  }
  throw new Error(`${label}: second connection never demonstrably waited for first connection`);
}
async function race(user1, sql1, user2, sql2, label, beforeCommit) {
  await begin(first,user1);
  await first.query(sql1);
  await begin(second,user2);
  const pending = second.query(sql2).then(result=>({result}), error=>({error}));
  await blocked(second,first,label);
  if (beforeCommit) await beforeCommit(first);
  await first.query('commit');
  const outcome = await pending;
  await second.query(outcome.error ? 'rollback' : 'commit');
  return outcome;
}
async function snapshot() {
  const rooms=(await admin.query('select * from quiz_rooms')).rows;
  const players=(await admin.query('select * from quiz_room_players order by joined_at,id')).rows;
  return {rooms,players};
}
try {
  admin=await connect(); first=await connect(); second=await connect();
  await setup();
  await roomWith([host]);
  let outcome=await race(guest,"select join_room_rpc('ABC123')",outsider,"select join_room_rpc('ABC123')",'last capacity joins');
  assert.match(outcome.error?.message || '',/Room is full/);
  let data=await snapshot();assert.equal(data.players.length,2);assert.equal(data.rooms[0].current_players,2);
  assert.equal(data.players.filter(p=>p.user_id===outsider).length,0);
  checks.push('Two distinct joins race for the last slot: exactly one joins, count remains 2');

  await roomWith([host]);
  outcome=await race(guest,"select join_room_rpc('ABC123')",guest,"select join_room_rpc('ABC123')",'duplicate join');
  assert.equal(outcome.error,undefined);assert.equal(outcome.result.rows[0].join_room_rpc,room);
  data=await snapshot();assert.equal(data.players.length,2);assert.equal(data.rooms[0].current_players,2);
  checks.push('Concurrent same-user join retries succeed with one membership and one count increment');

  outcome=await race(guest,`select leave_room_rpc('${room}')`,guest,`select leave_room_rpc('${room}')`,'duplicate leave');
  assert.equal(outcome.error,undefined);data=await snapshot();assert.equal(data.players.length,1);
  assert.equal(data.rooms[0].current_players,1);assert.equal(data.rooms[0].host_id,host);
  checks.push('Concurrent same-user leave retries remove one membership and decrement once');

  await roomWith([host,guest,outsider],'waiting',3);
  outcome=await race(host,`select leave_room_rpc('${room}')`,guest,`select leave_room_rpc('${room}')`,'host succession followed by successor leave');
  assert.equal(outcome.error,undefined);data=await snapshot();assert.equal(data.players.length,1);
  assert.equal(data.rooms[0].current_players,1);assert.equal(data.rooms[0].host_id,outsider);
  assert.equal(data.rooms[0].host_name,'Outsider');assert.equal(data.players[0].is_host,true);
  checks.push('Host leave racing successor leave transfers host twice with correct identity and count');

  await roomWith([host,guest]);
  let firstCountdown;
  outcome=await race(host,`select start_multiplayer_quiz_rpc('${room}')`,host,
    `select start_multiplayer_quiz_rpc('${room}')`,'duplicate start',async(client)=>{
      firstCountdown=(await client.query('select starts_at from quiz_rooms where id=$1',[room])).rows[0].starts_at;
    });
  assert.equal(outcome.error,undefined);data=await snapshot();assert.equal(data.rooms[0].status,'starting');
  assert.equal(data.rooms[0].starts_at.getTime(),firstCountdown.getTime());
  assert.equal((await admin.query('select count(*)::int n from quiz_room_questions where room_id=$1',[room])).rows[0].n,5);
  checks.push('Concurrent start retries seed exactly five questions and preserve the original countdown timestamp');

  await roomWith([host,guest],'waiting',3);
  outcome=await race(outsider,"select join_room_rpc('ABC123')",host,
    `select start_multiplayer_quiz_rpc('${room}')`,'last slot join before start');
  assert.match(outcome.error?.message || '',/all players are ready/);data=await snapshot();
  assert.equal(data.rooms[0].status,'waiting');assert.equal(data.rooms[0].current_players,3);
  assert.equal(data.players.length,3);assert.equal(data.players.find(p=>p.user_id===outsider).is_ready,false);
  assert.equal((await admin.query('select count(*)::int n from quiz_room_questions where room_id=$1',[room])).rows[0].n,0);
  checks.push('Last-slot join commits before start: new unready guest prevents countdown without partial questions');

  await roomWith([host,guest],'waiting',3);
  outcome=await race(host,`select start_multiplayer_quiz_rpc('${room}')`,outsider,
    "select join_room_rpc('ABC123')",'start before last slot join');
  assert.match(outcome.error?.message || '',/not accepting players/);data=await snapshot();
  assert.equal(data.rooms[0].status,'starting');assert.equal(data.rooms[0].current_players,2);
  assert.equal(data.players.length,2);assert.equal(data.players.filter(p=>p.user_id===outsider).length,0);
  assert.equal((await admin.query('select count(*)::int n from quiz_room_questions where room_id=$1',[room])).rows[0].n,5);
  checks.push('Start commits before last-slot join: countdown rejects late guest and preserves both memberships');

  await roomWith([host,guest],'finished');
  await admin.query("update quiz_rooms set starts_at=now()-interval '1 minute',finished_at=now(),current_question=5; update quiz_room_players set score=50,streak=3,total_answers=4,correct_answers=2");
  outcome=await race(host,`select restart_room_rpc('${room}')`,host,`select restart_room_rpc('${room}')`,'duplicate restart',async(client)=>{
    // Commit a readiness update after the first reset while the retry is blocked.
    await client.query("select set_config('test.user',$1,true)",[guest]);
    await client.query('update quiz_room_players set is_ready=true where user_id=$1',[guest]);
  });
  assert.equal(outcome.error,undefined);data=await snapshot();assert.equal(data.rooms[0].status,'waiting');
  assert.equal(data.rooms[0].starts_at,null);assert.equal(data.rooms[0].finished_at,null);
  assert.equal(data.rooms[0].current_question,0);assert.equal(data.rooms[0].current_players,2);
  assert.ok(data.players.every(p=>p.score===0 && p.streak===0 && p.total_answers===0 && p.correct_answers===0));
  assert.equal(data.players.find(p=>p.user_id===guest).is_ready,true);
  checks.push('Concurrent restart retry observes waiting state and preserves readiness committed after first reset');
  console.log(JSON.stringify({serverVersion:(await admin.query('show server_version')).rows[0].server_version,
    isolation:'READ COMMITTED',passed:checks,observedLockWaits:lockEvidence,
    dataScope:'Disposable local synthetic database only'},null,2));
} catch(error) {
  console.error(error.stack);process.exitCode=1;
} finally {
  for (const client of clients) {
    try { await client.query('rollback'); } catch {}
    try { await client.end(); } catch {}
  }
}
