import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import * as engine from "../src/lib/hunt-engine";

// Exercise the real action and localisation code through the installed
// PostgREST client. Only the HTTP boundary is simulated; no live accounts.
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const owner = "review-player";
let locale = "en";
let authenticated = true;
let authFailed = false;
let queryFailed = false;
const requests: URL[] = [];
const rows = Array.from({ length: 18 }, (_, index) => ({
  user_id: owner,
  question_id: `q${String(index).padStart(2, "0")}`,
  due_on: index < 16 ? "2026-01-01" : tomorrow,
  questions: {
    id: `q${String(index).padStart(2, "0")}`,
    question_text: `English question ${index}`,
    choices: ["One", "Two", "Three", "Four"],
    difficulty: "easy", tier: 1 + index % 9,
    review_status: index === 17 ? "draft" : "published",
    categories: index === 2 ? null : { name: index % 2 ? "Hadith Sciences" : "Holy Quran" },
  },
}));
rows.push({ ...rows[0], question_id: "unpublished", questions: { ...rows[0].questions, id: "unpublished", review_status: "draft" } });
rows.push({ ...rows[0], user_id: "another-player", question_id: "foreign" });

const http = createClient("https://review.example", "test-publishable-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, init) => {
    const url = new URL(String(input)); requests.push(url);
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (url.pathname.endsWith("/profiles")) return json({ preferred_language: locale });
    if (url.pathname.endsWith("/question_translations")) return json([
      { question_id: "q00", question_text: "Translated first question", choices: ["A", "B", "C", "D"] },
      { question_id: "q01", question_text: "Invalid option count", choices: ["A", "B"] },
    ]);
    assert.ok(url.pathname.endsWith("/user_question_schedule"));
    if (queryFailed) return new Response(JSON.stringify({ message: "Temporary failure", code: "TEST" }), { status: 503, headers: { "content-type": "application/json" } });
    // These assertions verify the SDK-generated owner and publication filters.
    assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
    assert.equal(url.searchParams.get("questions.review_status"), "eq.published");
    assert.match(url.searchParams.get("select") ?? "", /questions!inner\(/);
    assert.doesNotMatch(url.searchParams.get("select") ?? "", /correct_choice_index|explanation|citation_reference/);
    const dateFilter = url.searchParams.get("due_on")!;
    assert.ok(dateFilter === `lte.${today}` || dateFilter === `gt.${today}`);
    const selected = rows.filter(row => row.user_id === owner && row.questions.review_status === "published" &&
      (dateFilter.startsWith("lte.") ? row.due_on <= today : row.due_on > today))
      .sort((a, b) => a.due_on.localeCompare(b.due_on) || a.question_id.localeCompare(b.question_id));
    if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": `0-0/${selected.length}` } });
    return json(selected.slice(0, Number(url.searchParams.get("limit"))));
  } },
});
const client = {
  from: http.from.bind(http),
  auth: { getUser: async () => ({ data: { user: authenticated ? { id: owner } : null }, error: authFailed ? new Error("Auth failed") : null }) },
};
function load(file: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, any> = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Date, Map, Number, Error, require: (name: string) => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name];
  } });
  return exports;
}
const server = { createClient: async () => client };
const quiz = load("src/lib/quiz-service.ts", { "@/lib/supabase/server": server, "@/lib/hunt-engine": engine });
const review = load("src/app/(app)/review/actions.ts", { "@/lib/supabase/server": server, "@/lib/quiz-service": quiz });
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
async function main() {
  const session = await review.getReviewSession();
  assert.deepEqual(plain(session.status), { due: 16, scheduled: 1, nextDueOn: tomorrow });
  assert.equal(session.questions.length, 15);
  assert.deepEqual(plain(session.questions.map((q: any) => q.id)), rows.slice(0, 15).map(row => row.question_id));
  assert.equal(session.questions[0].text, "English question 0");
  assert.equal(session.questions[0].categoryName, "Holy Quran");
  assert.equal(session.questions[1].categoryName, "Hadith Sciences");
  assert.equal(session.questions[2].categoryName, undefined, "Missing topic metadata must not drop a question");
  assert.ok(requests.some(url => url.searchParams.get("order") === "due_on.asc,question_id.asc"));
  assert.ok(!requests.some(url => url.pathname.endsWith("question_translations")), "English is the default without a translation request");
  for (const limit of [999, NaN]) assert.equal((await review.getDueReviewQuestions(limit)).length, 15);
  assert.equal((await review.getDueReviewQuestions(3)).length, 3);
  locale = "ha";
  const translated = await review.getDueReviewQuestions(3);
  assert.equal(translated[0].text, "Translated first question");
  assert.equal(translated[0].categoryName, "Holy Quran", "Translation preserves the actual subject");
  assert.deepEqual(plain(translated[0].options), ["A", "B", "C", "D"]);
  assert.equal(translated[1].text, "English question 1", "Malformed translations fall back per question");
  assert.equal(translated[2].text, "English question 2", "Missing translations fall back per question");
  assert.ok(requests.some(url => url.pathname.endsWith("question_translations") && url.searchParams.get("locale") === "eq.ha"));
  assert.ok(!("correctIndex" in translated[0]) && !("explanation" in translated[0]));
  rows[0].due_on = tomorrow;
  const refreshed = await review.getReviewSession();
  assert.equal(refreshed.status.due, 15); assert.equal(refreshed.status.scheduled, 2);
  assert.equal(refreshed.questions[0].id, "q01", "Refresh must omit rescheduled questions");
  queryFailed = true;
  await assert.rejects(review.getReviewSession(), /Could not load review/);
  await assert.rejects(review.getReviewStatus(), /Could not load review status/);
  queryFailed = false; authFailed = true;
  await assert.rejects(review.getReviewSession(), /Could not authenticate/);
  authFailed = false; authenticated = false;
  assert.deepEqual(plain(await review.getReviewSession()), { questions: [], status: { due: 0, scheduled: 0, nextDueOn: null } });
  console.log("Review owner/publication filters, all 15 questions, localisation, refresh and error checks passed");
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
