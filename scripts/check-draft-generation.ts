import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

async function main() {
  const jsxRuntime = await import("react/jsx-runtime");
  const exports: Record<string, (props: unknown) => any> = {};
  const state = new Map<number, unknown>();
  const lock = { current: false };
  let hookIndex = 0;
  const requests: Record<string, string>[] = [];
  let request: Promise<any>, resolve!: (result: any) => void, reject!: (error: Error) => void;
  const defer = () => { request = new Promise((yes, no) => { resolve = yes; reject = no; }); };
  defer();
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/app/(app)/admin/review/GenerateForm.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Error, FormData, require: (name: string) => {
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (name === "react") return {
      useId: () => "draft-fields",
      useRef: () => lock,
      useState: (initial: unknown) => {
        const index = hookIndex++;
        if (!state.has(index)) state.set(index, initial);
        return [state.get(index), (value: unknown) => state.set(index, value)];
      },
    };
    if (name === "./actions") return {
      generateDraftQuestions: async (data: FormData) => {
        requests.push(Object.fromEntries([...data.entries()].map(([key, value]) => [key, String(value)])));
        return request;
      },
    };
    return new Proxy({}, { get: (_, key) => String(key) });
  } });
  const categories = [{ id: "one", name: "First category" }, { id: "two", name: "Second category" }];
  const render = (available = categories) => { hookIndex = 0; return exports.GenerateForm({ categories: available }); };
  function nodes(node: any, predicate: (node: any) => boolean): any[] {
    if (!node || typeof node !== "object") return [];
    return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => nodes(child, predicate))];
  }
  const event = { preventDefault() {} };
  const first = (tree: any, type: string) => nodes(tree, node => node.type === type)[0];
  const assertPending = () => {
    const tree = render();
    assert.equal(first(tree, "fieldset").props.disabled, true);
    assert.equal(first(tree, "Input").props.disabled, true);
    assert.equal(first(tree, "Button").props.disabled, true);
    assert.ok(nodes(tree, node => node.type === "Select").every(node => node.props.disabled));
    assert.ok(nodes(tree, node => node.type === "SelectTrigger").every(node => node.props.disabled));
  };
  let tree = render();
  const controlIds = [...nodes(tree, node => node.type === "SelectTrigger"), first(tree, "Input")].map(node => node.props.id);
  assert.deepEqual(nodes(tree, node => node.type === "Label").map(node => node.props.htmlFor), controlIds, "Every setting label addresses its control");
  assert.equal(nodes(tree, node => node.type === "Select")[2].props.value, "en", "English remains the initial language");
  const selects = nodes(tree, node => node.type === "Select");
  selects[0].props.onValueChange("two"); selects[1].props.onValueChange("hard"); selects[2].props.onValueChange("fr");
  first(tree, "Input").props.onChange({ target: { value: "7" } });
  tree = render();
  const pending = tree.props.onSubmit(event);
  await tree.props.onSubmit(event);
  assert.equal(requests.length, 1, "Same-frame repeated submit makes one request"); assertPending();
  await render().props.onSubmit(event);
  assert.equal(requests.length, 1, "Repeated submit after rerender remains guarded");
  assert.deepEqual(requests[0], { categoryId: "two", categoryName: "Second category", difficulty: "hard", language: "fr", count: "7" });
  reject(new Error("Transport offline")); await pending;
  tree = render();
  assert.equal(first(tree, "fieldset").props.disabled, false);
  assert.equal(first(tree, "Button").props.disabled, false);
  assert.equal(nodes(tree, node => node.props?.role === "alert")[0].props.children, "Transport offline");
  assert.deepEqual(nodes(tree, node => node.type === "Select").map(node => node.props.value), ["two", "hard", "fr"]);
  assert.equal(first(tree, "Input").props.value, 7, "Failed requests retain all draft settings");
  defer();
  const failedResult = tree.props.onSubmit(event); assertPending();
  resolve({ ok: false, error: "Draft provider unavailable" }); await failedResult;
  tree = render();
  assert.equal(nodes(tree, node => node.props?.role === "alert")[0].props.children, "Draft provider unavailable");
  assert.equal(lock.current, false);
  defer();
  const retry = tree.props.onSubmit(event); assertPending();
  resolve({ ok: true, draftedCount: 7 }); await retry;
  tree = render();
  assert.equal(requests.length, 3); assert.equal(first(tree, "Button").props.disabled, false);
  assert.equal(nodes(tree, node => node.props?.role === "status")[0].props.children, "Drafted 7 question(s) - review them below before they can be published.");
  assert.equal(lock.current, false);
  await render([]).props.onSubmit(event);
  assert.equal(requests.length, 3, "Missing category cannot dispatch generation");
  console.log("Draft generation: full-await guard, disabled settings, English default, failure recovery and retry passed (mock actions only)");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
