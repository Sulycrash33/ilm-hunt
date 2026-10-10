import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(process.env.TYPESCRIPT_PACKAGE || import.meta.url);
const ts = require('typescript');
const source = fs.readFileSync(new URL('../supabase/functions/translate-questions/index.ts', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
for (const scenario of ['success', '429', '503', 'network', 'refused']) {
  let handler;
  const info = [], calls = [];
  const client = { rpc: async (name) => {
    calls.push(name);
    if (name === 'claim_translation_batch') return { data: [{ o_question_id: 'synthetic', o_locale: 'fr', o_text: 'PRIVATE STEM', o_choices: ['PRIVATE A', 'PRIVATE B'], o_explanation: 'PRIVATE EXPLANATION' }] };
    if (name === 'complete_translation') return { data: [{ o_success: scenario !== 'refused' }] };
    return { error: null };
  } };
  const context = {
    createClient: () => client, authorizePrivilegedRequest: async () => null,
    Deno: { env: { get: () => 'synthetic' }, serve: fn => { handler = fn; } },
    console: { info: (...args) => info.push(args), error: () => {} },
    Response, Date, JSON, Math, Number, Array, Error,
    fetch: async () => {
      if (scenario === 'network') throw new Error('synthetic network');
      if (scenario === '429' || scenario === '503') return { ok: false, status: Number(scenario), text: async () => '{"error":{"message":"synthetic"}}' };
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"question":"translated","choices":["A","B"],"explanation":"translated"}' }] } }] }) };
    },
  };
  // Numeric concurrency env is required; all other env values stay synthetic.
  context.Deno.env.get = name => name === 'TRANSLATE_CONCURRENCY' ? '1' : 'synthetic';
  vm.runInNewContext(js, context);
  const response = await handler({ json: async () => ({ limit: 1 }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(info.length, 1);
  assert.equal(info[0][0], 'translate-questions: batch');
  assert.deepEqual(JSON.parse(info[0][1]), body);
  assert.deepEqual(Object.keys(body).sort(), ['claimed', 'concurrency', 'elapsedMs', 'failed', 'rateLimited', 'refused', 'released', 'written'].sort());
  assert.ok(Object.values(body).every(value => typeof value === 'number'));
  assert.equal(body.claimed, 1);
  const retry = ['429', '503', 'network'].includes(scenario);
  assert.equal(body.written, scenario === 'success' ? 1 : 0);
  assert.equal(body.refused, scenario === 'refused' ? 1 : 0);
  assert.equal(body.released, retry ? 1 : 0);
  assert.equal(body.rateLimited, retry ? 1 : 0);
  assert.equal(calls.includes('release_translation_claim'), retry);
  assert.ok(!info[0][1].includes('PRIVATE'));
}
console.log('PASS: five mocked worker outcomes; aggregate log matches response and excludes content. No external requests.');
