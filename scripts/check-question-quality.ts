import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { questionQualityReasons, reviewQuestionQuality } from "../src/lib/question-quality";
import * as quality from "../src/lib/question-quality";

async function main() {
  assert.deepEqual(questionQualityReasons({ text: "How many articles of faith are there?", choices: ["Five", "Six"] }), []);
  assert.deepEqual(questionQualityReasons({ text: "True or false: this statement is correct.", choices: ["True", "False"] }), []);
  assert.deepEqual(questionQualityReasons({ text: "What has this tier established?", choices: ["A", "B"] }), ["context"]);
  assert.deepEqual(questionQualityReasons({ text: "What does this category's method require?", choices: ["A", "B"] }), ["context"]);
  assert.deepEqual(questionQualityReasons({ text: "What does the capstone tier certify?", choices: ["A", "B"] }), ["context"]);
  for (const text of [
    "How does tier 3 compare with tier 6?",
    "What did tiers 1 through 4 establish?",
    "Which earlier tier modelled that distinction?",
    "What do the texts covered so far suggest?",
    "What was established in the previous lesson?",
    "How does lesson two prepare for the next category?",
  ]) assert.deepEqual(questionQualityReasons({ text, choices: ["A", "B"] }), ["context"], text);
  for (const text of [
    "Which report names three phrases of remembrance?",
    "How many tiers does this diagram show?",
    "What are the three lessons drawn from Quran 2:201?",
    "What does this statement say about gratitude?",
  ]) assert.deepEqual(questionQualityReasons({ text, choices: ["A", "B"] }), [], text);
  assert.deepEqual(questionQualityReasons({ text: " ", choices: [" "] }), ["blankText", "fewChoices", "blankChoice"]);
  assert.deepEqual(questionQualityReasons({ text: "Choose an option.", choices: ["Ａllah", "allah"] }), ["duplicateChoice"]);
  const sample = [
    { id: "a", text: "Which surah?", choices: ["A", "B"], category: "Holy Quran", categoryId: "q", tier: 1 },
    { id: "b", text: "WHICH surah!", choices: ["A", "B"], category: "Tafsir", categoryId: "t", tier: 2 },
  ];
  const original = JSON.stringify(sample);
  const duplicates = reviewQuestionQuality(sample);
  assert.deepEqual(duplicates.map(issue => issue.reasons), [["reusedStem"], ["reusedStem"]]);
  assert.equal(JSON.stringify(sample), original, "Writing checks must not mutate questions");
  assert.ok(!("choices" in duplicates[0]), "The report should contain only review context");

  let signedIn = true, role = "admin", queryFailed = false, bankReads = 0;
  const cursors: Array<string | null> = [];
  const rows = Array.from({ length: 1001 }, (_, i) => ({
    id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    question_text: i === 1 ? "What has this tier established?" : `What number is shown by marker ${i}?`,
    choices: ["One", "Two"], tier: 1, category_id: "subject", categories: { name: "Holy Quran" },
  }));
  rows[1000].question_text = rows[0].question_text;
  const http = createClient("https://quality.example", "test-publishable-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async input => {
      const url = new URL(String(input));
      const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
      if (url.pathname.endsWith("/profiles")) return json({ role });
      assert.ok(url.pathname.endsWith("/questions")); bankReads++;
      assert.equal(url.searchParams.get("review_status"), "eq.published");
      assert.equal(url.searchParams.get("order"), "id.asc");
      assert.equal(url.searchParams.get("limit"), "1000");
      assert.doesNotMatch(url.searchParams.get("select") ?? "", /correct_choice_index|explanation|citation_reference/);
      const cursor = url.searchParams.get("id"); cursors.push(cursor);
      if (queryFailed) return new Response(JSON.stringify({ message: "Offline", code: "TEST" }), { status: 400, headers: { "content-type": "application/json" } });
      return json(rows.filter(row => !cursor || row.id > cursor.slice(3)).slice(0, 1000));
    } },
  });
  const client = { from: http.from.bind(http), auth: { getUser: async () => ({ data: { user: signedIn ? { id: "admin-player" } : null } }) } };
  const actions: Record<string, any> = {};
  const dependencies: Record<string, any> = {
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/question-quality": quality,
    "next/cache": { revalidatePath: () => assert.fail("A read-only scan must not revalidate or write") },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/app/(app)/admin/questions/actions.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: actions, Date, Error, require: (name: string) => {
    assert.ok(name in dependencies); return dependencies[name];
  } });
  const result = await actions.getQuestionQualityReport();
  assert.equal(result.ok, true); assert.equal(result.report.scanned, 1001); assert.equal(result.report.complete, true);
  assert.equal(result.report.issues.length, 3, "Repeated wording across scan pages must be found");
  assert.equal(bankReads, 2); assert.equal(cursors[0], null); assert.equal(cursors[1], `gt.${rows[999].id}`);
  role = "learner";
  assert.equal((await actions.getQuestionQualityReport()).ok, false);
  signedIn = false;
  assert.equal((await actions.getQuestionQualityReport()).ok, false);
  assert.equal(bankReads, 2, "Non-admin and signed-out scans cannot read the bank");
  signedIn = true; role = "admin"; queryFailed = true;
  assert.equal((await actions.getQuestionQualityReport()).ok, false, "Query failure must not claim a completed scan");
  queryFailed = false;
  assert.equal((await actions.getQuestionQualityReport()).ok, true, "A failed scan can retry");
  console.log("Question quality: writing/choice checks, cross-page duplicates, scan paging, admin access and retry passed");
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
