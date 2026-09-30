import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const host = '00000000-0000-0000-0000-000000000001';
const guest = '00000000-0000-0000-0000-000000000002';
const stranger = '00000000-0000-0000-0000-000000000003';
const room = '10000000-0000-0000-0000-000000000001';
const other = '10000000-0000-0000-0000-000000000002';
const migration = fs.readFileSync('supabase/migrations/20260930212819_reliable_multiplayer_rounds.sql', 'utf8');
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as
      $$select nullif(current_setting('test.user', true), '')::uuid$$;
    create table auth.users(id uuid primary key);
    create table public.profiles(id uuid primary key, display_name text, avatar_id text);
    create table public.questions(id uuid primary key default gen_random_uuid(), question_text text,
      choices jsonb, correct_choice_index integer, pool text, difficulty text, review_status text);
  `);
  // Real table constraints, identity trigger, and changed RPCs; no production connection.
  const original = fs.readFileSync('supabase/migrations/0003_multiplayer_quiz.sql', 'utf8').replace(/^\uFEFF/, '');
  await db.exec(original.slice(0, original.indexOf('-- 5.')));
  await db.exec(`alter table quiz_rooms alter column category drop not null;
    alter table quiz_room_players add column avatar_id text;
    grant usage on schema public, auth to authenticated, anon;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    alter table quiz_room_players enable row level security;
    alter table quiz_room_answers enable row level security;
    create policy own_player on quiz_room_players for all to authenticated
      using(user_id = auth.uid()) with check(user_id = auth.uid());
  `);
  const identity = fs.readFileSync('supabase/migrations/0036_room_identity.sql', 'utf8');
  await db.exec(identity.slice(identity.indexOf('create or replace function public.stamp_room_player_identity'), identity.indexOf('drop function if exists public.join_room_rpc')));
  await db.exec(migration);
  await db.exec(`insert into auth.users values('${host}'),('${guest}'),('${stranger}');
    insert into profiles values('${host}', 'Host', null),('${guest}', 'Friend', null),('${stranger}', 'Stranger', null);
    insert into quiz_rooms(id, code, host_id, host_name, question_count) values
      ('${room}', 'ABC123', '${host}', 'Host', 5), ('${other}', 'XYZ123', '${stranger}', 'Stranger', 5);
    insert into quiz_room_players(room_id, user_id, user_name, is_host) values
      ('${room}', '${host}', 'Spoofed', true), ('${room}', '${guest}', 'Spoofed', false);
    insert into questions(question_text, choices, correct_choice_index, pool, difficulty, review_status)
      select 'Sample ' || n, '["One","Two","Three","Four"]'::jsonb, 0, 'arena', 'medium', 'published'
      from generate_series(1,40) n;
  `);
  const user = async (id) => db.query(`select set_config('test.user', $1, false)`, [id]);
  const rejects = async (sql, pattern) => assert.rejects(db.query(sql), pattern);
  await user(''); await rejects(`select begin_multiplayer_quiz_rpc('${room}')`, /signed in/);
  await user(guest); await rejects(`select start_multiplayer_quiz_rpc('${room}')`, /Only the host/);
  await user(host); await db.query(`select start_multiplayer_quiz_rpc('${room}')`);
  let rows = (await db.query(`select id, order_num from quiz_room_questions where room_id='${room}' order by order_num`)).rows;
  assert.deepEqual(rows.map(r => r.order_num), [1,2,3,4,5], 'Random selection must retain consecutive question numbers');
  const first = rows[0].id, second = rows[1].id;
  await db.query(`select start_multiplayer_quiz_rpc('${room}')`);
  assert.equal((await db.query(`select count(*)::int as n from quiz_room_questions where room_id='${room}'`)).rows[0].n, 5);
  await rejects(`select begin_multiplayer_quiz_rpc('${room}')`, /Countdown/);
  await user(stranger); await rejects(`select begin_multiplayer_quiz_rpc('${room}')`, /participant/);
  await db.exec(`update quiz_rooms set starts_at=clock_timestamp()-interval '10 seconds' where id='${room}'`);
  await user(guest); await db.query(`select begin_multiplayer_quiz_rpc('${room}')`);
  await db.query(`select begin_multiplayer_quiz_rpc('${room}')`);
  assert.equal((await db.query(`select status from quiz_rooms where id='${room}'`)).rows[0].status, 'in_progress');
  await rejects(`select submit_multiplayer_answer_rpc('${other}','${first}',0,0)`, /participant/);
  await rejects(`select submit_multiplayer_answer_rpc('${room}','${second}',0,0)`, /not active/);
  await rejects(`select submit_multiplayer_answer_rpc('${room}','${first}',8,0)`, /Invalid/);
  const grade = (await db.query(`select * from submit_multiplayer_answer_rpc('${room}','${first}',0,-9999)`)).rows[0];
  assert.equal(grade.is_correct, true);
  assert.ok(grade.points_earned <= 80 && grade.points_earned >= 70, 'Client time cannot inflate points');
  const score = (await db.query(`select score from quiz_room_players where user_id='${guest}'`)).rows[0].score;
  assert.deepEqual((await db.query(`select * from submit_multiplayer_answer_rpc('${room}','${first}',1,0)`)).rows[0], grade);
  assert.equal((await db.query(`select score from quiz_room_players where user_id='${guest}'`)).rows[0].score, score);
  await rejects(`select advance_multiplayer_question_rpc('${room}',1)`, /Only the host/);
  await user(host); await db.query(`select advance_multiplayer_question_rpc('${room}',1)`);
  await db.query(`select advance_multiplayer_question_rpc('${room}',1)`);
  assert.equal((await db.query(`select current_question from quiz_rooms where id='${room}'`)).rows[0].current_question, 2);
  await rejects(`select submit_multiplayer_answer_rpc('${room}','${first}',0,0)`, /not active/);
  assert.ok((await db.query(`select started_at from quiz_room_questions where id='${second}'`)).rows[0].started_at);
  await db.exec(`update quiz_room_questions set started_at=clock_timestamp()-interval '31 seconds' where id='${second}'`);
  await rejects(`select submit_multiplayer_answer_rpc('${room}','${second}',0,0)`, /Time is up/);
  await db.exec('set role authenticated');
  await rejects(`update quiz_room_players set score=999999 where user_id='${host}'`, /permission denied/);
  await rejects(`insert into quiz_room_answers(room_id,question_id,user_id,selected_index,is_correct,time_taken)
    values('${room}','${second}','${host}',0,true,0)`, /permission denied/);
  await db.query(`update quiz_room_players set is_ready=true where user_id='${host}'`);
  assert.equal((await db.query('select count(*)::int as n from quiz_room_answers')).rows[0].n, 0, 'Other players cannot read submitted choices');
  await db.exec('reset role; set role anon');
  await rejects(`select begin_multiplayer_quiz_rpc('${room}')`, /permission denied/);
  await db.exec('reset role');
  // A missing next question rolls back both the timer and room transition.
  await db.exec(`delete from quiz_room_questions where room_id='${room}' and order_num=3`);
  await rejects(`select advance_multiplayer_question_rpc('${room}',2)`, /Next question not found/);
  assert.equal((await db.query(`select current_question from quiz_rooms where id='${room}'`)).rows[0].current_question, 2);
  await db.exec(`insert into quiz_room_questions(room_id, question_id, question_text, choices, correct_index, order_num)
    select '${room}', id, question_text, choices, correct_choice_index, 3 from questions limit 1`);
  for (const n of [2,3,4,5]) await db.query(`select advance_multiplayer_question_rpc('${room}',${n})`);
  assert.equal((await db.query(`select status from quiz_rooms where id='${room}'`)).rows[0].status, 'finished');
  assert.equal((await db.query(`select advance_multiplayer_question_rpc('${room}',5) as done`)).rows[0].done, true);
  await db.exec(`insert into quiz_room_players(room_id,user_id,user_name)
    values('${other}','${stranger}','Stranger'),('${other}','${guest}','Friend');
    update quiz_rooms set difficulty='hard' where id='${other}'`);
  await user(stranger);
  await rejects(`select start_multiplayer_quiz_rpc('${other}')`, /Not enough questions/);
  assert.equal((await db.query(`select status from quiz_rooms where id='${other}'`)).rows[0].status, 'waiting');
  assert.equal((await db.query(`select count(*)::int as n from quiz_room_questions where room_id='${other}'`)).rows[0].n, 0);
  console.log('Multiplayer SQL checks passed: countdown, sequence, retries, permissions, timer, scoring and rollback');
} catch (error) { console.error(error.message); process.exitCode = 1; } finally { await db.close(); }
