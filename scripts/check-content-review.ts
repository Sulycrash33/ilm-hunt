import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import * as review from "../src/lib/question-review";

async function main() {
  const edited = { questionText: " Which option? ", choices: [" One ", "Two"], correctChoiceIndex: 0, explanation: " An explanation. ", citationReference: " A source. ", madhabTag: "na" };
  let signedIn = true, role = "reviewer", status = "ai_drafted", queryFailed = false;
  let writes = 0, revalidations = 0;
  const payloads: Record<string, unknown>[] = [];
  const client = createClient("https://review.example", "test-publishable-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      const json = (value: unknown, httpStatus = 200) => new Response(JSON.stringify(value), { status: httpStatus, headers: { "content-type": "application/json" } });
      if (url.pathname.endsWith("/profiles")) return json({ role });
      assert.ok(url.pathname.endsWith("/questions"));
      assert.equal(init?.method, "PATCH");
      assert.equal(url.searchParams.get("id"), "eq.question-one");
      assert.equal(url.searchParams.get("review_status"), "eq.ai_drafted", "A stale card must not change decided content");
      assert.equal(url.searchParams.get("select"), "id", "Use affected rows to distinguish success from no-op");
      writes++;
      const payload = JSON.parse(String(init?.body)); payloads.push(payload);
      if (queryFailed) return json({ message: "Offline", code: "TEST" }, 400);
      if (status !== "ai_drafted") return json([]);
      status = payload.review_status;
      return json([{ id: "question-one" }]);
    } },
  });
  const dependencies: Record<string, unknown> = {
    "@/lib/supabase/server": { createClient: async () => ({ from: client.from.bind(client), auth: { getUser: async () => ({ data: { user: signedIn ? { id: "reviewer-id" } : null } }) } }) },
    "@/ai/flows/draft-questions": { draftQuestions: () => assert.fail("Review tests do not generate content") },
    "@/lib/question-review": review,
    "next/cache": { revalidatePath: (path: string) => { assert.equal(path, "/admin/review"); revalidations++; } },
  };
  const actions: Record<string, (...args: any[]) => Promise<void>> = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/app/(app)/admin/review/actions.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: actions, Date, Error, require: (name: string) => { assert.ok(name in dependencies); return dependencies[name]; } });

  await actions.approveQuestion("question-one", edited);
  assert.equal(status, "published"); assert.equal(revalidations, 1);
  assert.equal(payloads[0].question_text, "Which option?");
  assert.deepEqual(payloads[0].choices, ["One", "Two"]);
  assert.equal(payloads[0].reviewed_by, "reviewer-id");
  await assert.rejects(actions.rejectQuestion("question-one"), /no longer pending/);
  await assert.rejects(actions.approveQuestion("question-one", edited), /no longer pending/);
  assert.equal(status, "published"); assert.equal(revalidations, 1);
  status = "ai_drafted";
  await actions.rejectQuestion("question-one");
  assert.equal(status, "rejected");
  await assert.rejects(actions.approveQuestion("question-one", edited), /no longer pending/);
  assert.equal(status, "rejected"); assert.equal(revalidations, 2);

  const beforeInvalid = writes;
  for (const invalid of [
    { questionText: " " }, { choices: ["One"] }, { choices: ["One", " "] },
    { choices: ["One", "one"] }, { correctChoiceIndex: 2 }, { correctChoiceIndex: 0.5 },
    { citationReference: " " }, { explanation: " " }, { madhabTag: "unknown" },
  ]) await assert.rejects(actions.approveQuestion("question-one", { ...edited, ...invalid }));
  assert.equal(writes, beforeInvalid, "Invalid input must never reach a mutation");
  role = "user";
  await assert.rejects(actions.approveQuestion("question-one", edited), /Not authorized/);
  await assert.rejects(actions.rejectQuestion("question-one"), /Not authorized/);
  signedIn = false;
  await assert.rejects(actions.rejectQuestion("question-one"), /Not signed in/);
  assert.equal(writes, beforeInvalid, "Unauthorized requests must never reach a mutation");

  signedIn = true; role = "admin"; status = "ai_drafted"; queryFailed = true;
  await assert.rejects(actions.approveQuestion("question-one", edited), /Offline/);
  assert.equal(status, "ai_drafted"); assert.equal(revalidations, 2);
  queryFailed = false;
  await actions.approveQuestion("question-one", edited);
  assert.equal(status, "published"); assert.equal(revalidations, 3);

  // Run the actual card with deterministic hooks: a deferred request must
  // disable editing and both actions for its whole lifetime under React 18.
  const jsxRuntime = await import("react/jsx-runtime");
  const cardExports: Record<string, (props: unknown) => any> = {};
  const cardState = new Map<number, unknown>();
  let hookIndex = 0, approves = 0, rejects = 0;
  const saveRef = { current: false };
  let finishSave!: () => void, failSave!: (error: Error) => void;
  let savePromise = new Promise<void>((resolve, reject) => { finishSave = resolve; failSave = reject; });
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/app/(app)/admin/review/QuestionReviewCard.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports: cardExports, Error, require: (name: string) => {
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (name === "react") return {
      useRef: () => saveRef,
      useState: (initial: unknown) => {
        const index = hookIndex++;
        return [cardState.has(index) ? cardState.get(index) : initial, (value: unknown) => cardState.set(index, value)];
      },
    };
    if (name === "./actions") return {
      approveQuestion: async () => { approves++; await savePromise; },
      rejectQuestion: async () => { rejects++; await savePromise; },
    };
    return new Proxy({}, { get: (_, key) => String(key) });
  } });
  function renderCard() {
    hookIndex = 0;
    return cardExports.QuestionReviewCard({ q: { id: "card-one", question_text: "Which option?", choices: ["One", "Two"], correct_choice_index: 0, explanation: "Explanation", citation_reference: "Source", madhab_tag: "na", difficulty: "easy", language: "en", categoryName: "Category" } });
  }
  function find(node: any, predicate: (node: any) => boolean): any {
    if (!node || typeof node !== "object") return;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child, predicate); if (found) return found;
    }
  }
  const firstCard = renderCard();
  const approveButton = find(firstCard, node => node.type === "Button" && node.props.variant !== "outline");
  const rejectButton = find(firstCard, node => node.type === "Button" && node.props.variant === "outline");
  const pendingSave = approveButton.props.onClick();
  await approveButton.props.onClick(); await rejectButton.props.onClick();
  assert.equal(approves, 1); assert.equal(rejects, 0, "Immediate duplicate and conflicting decisions are ignored");
  const savingCard = renderCard();
  assert.equal(find(savingCard, node => node.type === "fieldset").props.disabled, true);
  assert.equal(find(savingCard, node => node.type === "SelectTrigger").props.disabled, true);
  assert.equal(find(savingCard, node => node.type === "Button" && node.props.variant !== "outline").props.disabled, true);
  assert.equal(find(savingCard, node => node.type === "Button" && node.props.variant === "outline").props.disabled, true);
  failSave(new Error("Temporary save failure")); await pendingSave;
  const failedCard = renderCard();
  assert.equal(find(failedCard, node => node.type === "fieldset").props.disabled, false);
  assert.equal(find(failedCard, node => node.props?.role === "alert").props.children, "Temporary save failure");
  savePromise = new Promise<void>(resolve => { finishSave = resolve; });
  const retry = find(failedCard, node => node.type === "Button" && node.props.variant !== "outline").props.onClick();
  assert.equal(approves, 2); finishSave(); await retry;
  assert.equal(cardState.get(1), "approved"); assert.equal(cardState.get(0), false);
  assert.equal(saveRef.current, false);
  console.log("Content review: stale decisions, affected rows, input validation, authorization and error recovery passed");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
