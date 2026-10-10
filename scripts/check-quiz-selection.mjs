import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

// Load the production server module with only the request client substituted.
// This exercises its actual query filters and returned player-facing fields.
const nativeRequire = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const cache = new Map();
let queries = [];
let bank = [];
let failPage = -1;
let failCategories = false;
function client() {
  return {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from(table) {
      const q = { table, filters: [], fields: '', from: 0, to: Infinity };
      queries.push(q);
      const builder = {
        select(fields) { q.fields = fields; return this; },
        eq(key, value) { q.filters.push(['eq', key, value]); return this; },
        gte(key, value) { q.filters.push(['gte', key, value]); return this; },
        lte(key, value) { q.filters.push(['lte', key, value]); return this; },
        in(key, value) { q.filters.push(['in', key, value]); return this; },
        order(key) { q.order = key; return this; },
        range(from, to) { q.from = from; q.to = to; return this; },
        single() { q.single = true; return this; },
        then(resolve, reject) {
          let rows = table === 'categories'
            ? [{ id: 'ordinary', slug: 'ordinary', pool: 'category' }, { id: 'arena', slug: 'arena', pool: 'arena' }]
            : bank;
          for (const [op, key, value] of q.filters) rows = rows.filter(row =>
            op === 'eq' ? row[key] === value : op === 'gte' ? row[key] >= value
              : op === 'lte' ? row[key] <= value : value.includes(row[key]));
          if (q.order) rows = [...rows].sort((a, b) => a[q.order].localeCompare(b[q.order]));
          // Match the live column grants: filtering questions.pool is denied
          // even when it is absent from the selected fields.
          const deniedPool = table === 'questions' && q.filters.some(([, key]) => key === 'pool');
          const error = deniedPool || (table === 'categories' && failCategories) || (table === 'questions' && q.fields === 'id' && q.from === failPage) ? { message: 'unavailable' } : null;
          rows = rows.slice(q.from, q.to + 1);
          // Simulate column selection, including the categories relationship.
          rows = rows.map(row => Object.fromEntries(q.fields.split(',').map(field => {
            const key = field.trim().split('(')[0]; return [key, row[key]];
          })));
          return Promise.resolve({ data: error ? null : q.single ? rows[0] ?? null : rows, error }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}
function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const module = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(new URL(relative, root), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const requireModule = name => {
    if (name === '@/lib/supabase/server') return { createClient: async () => client() };
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
    return nativeRequire(name);
  };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: requireModule }, { filename: relative });
  cache.set(relative, module.exports);
  return module.exports;
}
const { sampleQuestionIds } = load('src/lib/mode-question-sampling.ts');
const { getCategoryBySlug, getModeQuestionPool } = load('src/lib/quiz-service.ts');
const ids = Array.from({ length: 1601 }, (_, i) => ({ id: String(i) }));
let pages = [];
const fetchPage = async (from, to) => { pages.push([from, to]); return ids.slice(from, to + 1); };
const tail = await sampleQuestionIds(fetchPage, 3, () => 0);
assert.equal(tail.length, 3);
assert.ok(tail.includes('1600'), 'Questions beyond both old 300-row and API 1,000-row caps must be eligible');
assert.equal(new Set(tail).size, 3);
assert.equal(pages.length, 4);
assert.ok(pages.every(([from, to]) => to - from + 1 <= 500));
const head = await sampleQuestionIds(fetchPage, 3, max => max - 1);
assert.equal(head.join(','), '0,1,2', 'Earlier questions must remain eligible too');
await assert.rejects(sampleQuestionIds(async from => { if (from) throw Error('page failed'); return ids.slice(0, 500); }, 3, () => 0));
assert.equal((await sampleQuestionIds(fetchPage, 0, () => 0)).length, 0);
assert.equal((await sampleQuestionIds(fetchPage, Infinity, () => 0)).length, 0);
assert.equal((await sampleQuestionIds(async () => ids.slice(0, 2), 300, () => 0)).length, 2);
assert.equal((await sampleQuestionIds(fetchPage, 999, () => 0)).length, 300);
// Small exhaustive check: each ID has equal inclusion frequency for k=1,n=3.
const frequencies = [0, 0, 0];
for (let a = 0; a < 2; a++) for (let b = 0; b < 3; b++) {
  const draws = [a, b];
  const result = await sampleQuestionIds(async () => ids.slice(0, 3), 1, () => draws.shift());
  frequencies[Number(result[0])]++;
}
assert.deepEqual(frequencies, [2, 2, 2]);
assert.equal(await getCategoryBySlug('arena'), null);
assert.equal((await getCategoryBySlug('ordinary')).id, 'ordinary');
bank = Array.from({ length: 1601 }, (_, i) => ({
  id: `q${String(i).padStart(4, '0')}`, category_id: 'arena', pool: 'arena', tier: 2, review_status: 'published',
  question_text: 'Synthetic prompt', choices: ['A', 'B'], difficulty: 'easy', categories: { name: 'Synthetic' },
  correct_choice_index: 1, explanation: 'Private synthetic explanation',
}));
bank.push({ ...bank[0], id: 'category', category_id: 'ordinary', pool: 'category' }, { ...bank[0], id: 'draft', review_status: 'ai_drafted' }, { ...bank[0], id: 'outside', tier: 9 });
queries = [];
const result = await getModeQuestionPool(1, 3);
assert.equal(result.length, 300);
assert.equal(new Set(result.map(q => q.id)).size, 300);
assert.ok(result.every(q => q.id.startsWith('q') && q.tier === 2));
assert.ok(result.every(q => !('correct_choice_index' in q) && !('explanation' in q)));
const idQueries = queries.filter(q => q.table === 'questions' && q.fields === 'id');
assert.equal(idQueries.length, 4);
assert.ok(idQueries.every(q => q.order === 'id' && q.filters.some(([op, key, value]) => op === 'in' && key === 'category_id' && value.includes('arena'))));
assert.ok(idQueries.every(q => !q.filters.some(([, key]) => key === 'pool')));
assert.ok(queries.filter(q => q.table === 'questions').every(q => !/correct_choice_index|explanation|citation/.test(q.fields)));
failPage = 500;
assert.equal((await getModeQuestionPool(1, 3)).length, 0);
failPage = -1;
failCategories = true;
queries = [];
assert.equal((await getModeQuestionPool(1, 3)).length, 0);
assert.equal(queries.filter(q => q.table === 'questions').length, 0);
console.log('Quiz selection: full-bank eligibility, equal sampling, pagination, failure handling, category isolation, tier/published filters and hidden answer fields passed.');
