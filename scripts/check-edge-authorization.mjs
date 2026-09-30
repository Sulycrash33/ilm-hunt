import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real handlers with fake services. A denied request must not read
// content, claim jobs, call a model, write rows or send a notification.
const files = ['translate-questions', 'translate-hadiths', 'send-streak-reminders', 'import-arena-bank', 'import-hadith-editions'];
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service', SUPABASE_SECRET_KEYS: '{"default":"test-secret"}', GEMINI_API_KEY: 'test-model-key', VAPID_PUBLIC_KEY: 'test-public', VAPID_PRIVATE_KEY: 'test-private' };
let effects = 0;
let role = 'learner';
let legacyChecks = 0;
let legacyOutage = false;
const legacyCredential = 'eyJ.test-service.signature';
const client = {
  auth: { getUser: async (token) => ({ data: { user: token === 'test-user' ? { id: 'test-user-id' } : null }, error: null }) },
  from(name) {
    assert.equal(name, 'profiles', 'An unauthorized request accessed content');
    const query = { select: () => query, eq: () => query, single: async () => ({ data: { role }, error: null }) };
    return query;
  },
  rpc() { effects++; throw new Error('Unexpected RPC'); },
  storage: { from() { effects++; throw new Error('Unexpected Storage read'); } },
};
function compile(file, overrides = {}) {
  let handler;
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, {
    exports, Request, Response, Headers, URL, console,
    Deno: { env: { get: (name) => env[name] }, serve: (fn) => { handler = fn; } },
    fetch: () => { effects++; throw new Error('Unexpected outbound request'); },
    require: (name) => name.includes('_shared') ? helper : name.startsWith('jsr:') ? { createClient: (_url, key) => key === env.SUPABASE_SERVICE_ROLE_KEY ? client : {
      auth: { admin: { listUsers: async (options) => {
        legacyChecks++;
        assert.equal(options.perPage, 1);
        if (legacyOutage) throw new Error('Auth unavailable');
        return key === legacyCredential ? { data: { users: [] }, error: null } : { data: { users: [] }, error: new Error('Denied') };
      } } },
    } } : overrides[name] ?? { default: {} },
  }, { filename: file });
  return { exports, handler };
}
const helper = compile('supabase/functions/_shared/privileged-request.ts').exports;
const request = (headers = {}, method = 'POST') => new Request('https://example.test', { method, headers });
for (const file of files) {
  const { handler } = compile(`supabase/functions/${file}/index.ts`);
  for (const req of [request(), request({ Authorization: 'Bearer invalid' }), request({ apikey: 'publishable-test' })]) {
    assert.equal((await handler(req)).status, 401, `${file} admitted an unauthorized caller`);
  }
  assert.equal((await handler(request({}, 'GET'))).status, 405);
  const userResult = await handler(request({ Authorization: 'Bearer test-user' }));
  assert.equal(userResult.status, file === 'translate-questions' || file === 'send-streak-reminders' ? 401 : 403);
}
assert.equal(effects, 0, 'Denied requests caused privileged work');
assert.equal(await helper.authorizePrivilegedRequest(request({ Authorization: `Bearer ${legacyCredential}` }), client), null);
assert.equal((await helper.authorizePrivilegedRequest(request({ Authorization: 'Bearer eyJ.forged-service-role.signature' }), client)).status, 401);
assert.equal((await helper.authorizePrivilegedRequest(request({ Authorization: 'Bearer eyJ.anonymous.signature' }), client)).status, 401);
legacyOutage = true;
assert.equal((await helper.authorizePrivilegedRequest(request({ Authorization: `Bearer ${legacyCredential}` }), client)).status, 401);
legacyOutage = false;
assert.equal(legacyChecks, 4, 'Legacy credentials were not verified by Auth');
for (const headers of [{ Authorization: 'Bearer test-service' }, { apikey: 'test-secret' }]) {
  assert.equal(await helper.authorizePrivilegedRequest(request(headers), client), null);
}
role = 'admin';
assert.equal(await helper.authorizePrivilegedRequest(request({ Authorization: 'Bearer test-user' }), client, true), null);
assert.equal((await helper.authorizePrivilegedRequest(request({ Authorization: 'Bearer test-user' }), client)).status, 401);
env.SUPABASE_SERVICE_ROLE_KEY = '';
env.SUPABASE_SECRET_KEYS = 'not-json';
assert.equal((await helper.authorizePrivilegedRequest(request(), client)).status, 401, 'Empty keys authorized a request');
env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
env.SUPABASE_SECRET_KEYS = '{"default":"test-secret"}';
const present = new Set();
const bank = [{ ref: 123, slug: 'arena_quran', tier: 1, difficulty: 'easy', question: 'Test question', choices: ['A', 'B', 'C', 'D'], correct: 0, explanation: 'Test explanation' }];
let inserted = 0;
client.storage.from = (bucket) => {
  assert.equal(bucket, 'content-banks');
  return { download: async (key) => {
    assert.equal(key, 'arena/bank.json');
    return { data: new Blob([JSON.stringify(bank)]), error: null };
  } };
};
client.from = (table) => {
  if (table === 'categories') return { select: () => ({ eq: async () => ({ data: [{ id: 'category-test', slug: 'arena_quran' }], error: null }) }) };
  assert.equal(table, 'questions');
  return {
    select: () => ({ like: () => ({ range: async () => ({ data: [...present].map(seed_batch => ({ seed_batch })), error: null }) }) }),
    insert: async (rows) => {
      for (const row of rows) { assert.ok(!present.has(row.seed_batch)); present.add(row.seed_batch); }
      inserted += rows.length;
      return { count: rows.length, error: null };
    },
  };
};
const importer = compile('supabase/functions/import-arena-bank/index.ts').handler;
const importRequest = (dryRun) => new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer test-service', 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun }) });
const dry = await (await importer(importRequest(true))).json();
assert.equal(dry.toInsert, 1);
assert.equal(inserted, 0, 'Dry run inserted questions');
assert.equal((await (await importer(importRequest(false))).json()).inserted, 1);
assert.equal((await (await importer(importRequest(false))).json()).inserted, 0);
assert.equal(inserted, 1, 'Repeated import duplicated a question');
console.log('PASS: all five edge handlers reject unauthorized work; intended credentials work; private importer dry-run and repeat-import behaviour are correct.');
