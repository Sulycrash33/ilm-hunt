import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as locales from "../src/app/(app)/admin/hadiths/hadith-locales";

async function main() {
  const jsxRuntime = await import("react/jsx-runtime");
  const exports: Record<string, (props: unknown) => any> = {};
  const state = new Map<number, any>();
  const lock = { current: false };
  let index = 0, loads = 0, saves = 0, removes = 0;
  let resolve!: (result: any) => void, reject!: (error: Error) => void;
  let request: Promise<any>;
  const defer = () => { request = new Promise((yes, no) => { resolve = yes; reject = no; }); };
  defer();
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/components/admin/HadithsPageClient.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Error, require: (name: string) => {
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (name === "react") return {
      useRef: () => lock,
      useState: (initial: any) => {
        const key = index++;
        if (!state.has(key)) state.set(key, initial);
        return [state.get(key), (next: any) => state.set(key, typeof next === "function" ? next(state.get(key)) : next)];
      },
    };
    if (name.endsWith("hadith-locales")) return locales;
    if (name.endsWith("/actions")) return {
      getHadithTexts: async () => { loads++; return request; },
      saveHadith: async () => { saves++; return request; },
      deleteHadithLocale: async () => { removes++; return request; },
    };
    return { default: "Link" };
  } });
  const rows = ["one", "two"].map((id, position) => ({ id, reference: `fixture:${id}`, position, isActive: true, locales: ["en", "ha"], english: "Fixture text" }));
  const render = () => { index = 0; return exports.HadithsPageClient({ rows, listError: null }); };
  function nodes(node: any, predicate: (node: any) => boolean): any[] {
    if (!node || typeof node !== "object") return [];
    return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => nodes(child, predicate))];
  }
  const button = (tree: any, label: string) => nodes(tree, node => node.type === "button" && node.props.children === label)[0];
  const assertPending = (tree: any) => {
    assert.equal(nodes(tree, node => node.type === "fieldset")[0].props.disabled, true, "Editing is disabled throughout awaited requests");
    assert.equal(button(tree, "Add a hadith").props.disabled, true);
    assert.ok(nodes(tree, node => node.type === "button" && node.props.children === "Edit").every(node => node.props.disabled));
    assert.equal(button(tree, "Working…").props.disabled, true);
  };

  let tree = render();
  const editButtons = nodes(tree, node => node.type === "button" && node.props.children === "Edit");
  const loading = editButtons[0].props.onClick();
  await editButtons[1].props.onClick(); button(tree, "Add a hadith").props.onClick();
  assert.equal(loads, 1, "Repeated edit clicks cannot create overlapping loads"); assertPending(render());
  resolve({ ok: true, texts: { en: { text: "English fixture", attribution: "Source" }, ha: { text: "Hausa fixture", attribution: "Source" } } }); await loading;
  assert.equal(state.get(2).id, "one", "Adding/switching rows while loading cannot overwrite the selected editor");

  tree = render(); defer();
  const save = button(tree, "Save changes").props.onClick();
  await button(tree, "Save changes").props.onClick(); await editButtons[1].props.onClick(); button(tree, "Add a hadith").props.onClick();
  assert.equal(saves, 1); assert.equal(loads, 1); assertPending(render());
  reject(new Error("Save offline")); await save;
  assert.equal(state.get(0), "Save offline"); assert.equal(state.get(1), false); assert.equal(lock.current, false);
  assert.equal(state.get(6).en.text, "English fixture", "Failure retains the editor for retry");
  tree = render(); defer();
  const retry = button(tree, "Save changes").props.onClick(); resolve({ ok: true, id: "one" }); await retry;
  assert.equal(saves, 2); assert.equal(state.get(0), "Saved. Reload to see it in the list.");

  state.set(7, "ha"); tree = render(); defer();
  const removeButton = nodes(tree, node => node.type === "button" && Array.isArray(node.props.children) && node.props.children[0] === "Remove ")[0];
  assert.ok(removeButton);
  const removing = removeButton.props.onClick(); await removeButton.props.onClick(); await button(tree, "Save changes").props.onClick();
  assert.equal(removes, 1); assert.equal(saves, 2); assertPending(render());
  reject(new Error("Remove offline")); await removing;
  assert.equal(state.get(0), "Remove offline"); assert.equal(state.get(6).ha.text, "Hausa fixture");
  tree = render(); defer();
  const removeRetry = nodes(tree, node => node.type === "button" && Array.isArray(node.props.children) && node.props.children[0] === "Remove ")[0].props.onClick();
  resolve({ ok: true }); await removeRetry;
  assert.equal(removes, 2); assert.equal(state.get(6).ha, undefined); assert.equal(state.get(1), false);
  tree = render(); defer();
  const failedLoad = nodes(tree, node => node.type === "button" && node.props.children === "Edit")[1].props.onClick();
  reject(new Error("Load offline")); await failedLoad;
  assert.equal(state.get(0), "Load offline"); assert.equal(state.get(2).id, "one"); assert.equal(lock.current, false);
  console.log("Hadith tools: delayed load/save/remove, duplicate guards, disabled editor and failure recovery passed");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
