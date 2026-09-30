import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import ts from "typescript"
import { coalescedRefresh, parseRoomCode, roomInvitePath, questionDeadline } from "../src/lib/multiplayer-experience"

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function main() {
  assert.equal(parseRoomCode(" ab23cd "), "AB23CD")
  for (const bad of [null, "", "abc", "https://bad.example", "ABC123&next=evil", "../ABC123"]) {
    assert.equal(parseRoomCode(bad), null)
    assert.equal(roomInvitePath(bad), "/home")
  }
  assert.equal(roomInvitePath("ab23cd"), "/multiplayer?room=AB23CD")
  assert.equal(questionDeadline("2026-09-30T12:00:00Z", 30, 0), Date.parse("2026-09-30T12:00:30Z"))
  assert.equal(questionDeadline(undefined, 30, 1000), 31000)
  assert.equal(questionDeadline("bad", 30, 1000), 31000)

  let loads = 0
  const received: number[] = []
  let resolveFirst!: (value: number) => void
  const first = new Promise<number>(resolve => { resolveFirst = resolve })
  const refresh = coalescedRefresh(async () => ++loads === 1 ? first : loads, value => received.push(value), () => assert.fail("Unexpected refresh error"), 0)
  for (let i = 0; i < 20; i++) refresh.trigger()
  await sleep(10)
  assert.equal(loads, 1, "An event burst must issue one refresh")
  for (let i = 0; i < 20; i++) refresh.trigger()
  assert.equal(loads, 1, "Requests must never overlap")
  resolveFirst(1)
  await sleep(20)
  assert.equal(loads, 2, "Updates during an in-flight request must get a trailing refresh")
  assert.deepEqual(received, [1, 2])
  refresh.dispose()
  refresh.trigger()
  await sleep(10)
  assert.equal(loads, 2)

  let finish!: (value: number) => void
  const pending = new Promise<number>(resolve => { finish = resolve })
  const abandoned = coalescedRefresh(() => pending, () => assert.fail("A departed room received a late response"), () => assert.fail(), 0)
  abandoned.trigger(); await sleep(10); abandoned.dispose(); finish(1); await sleep(10)
  let errors = 0
  let attempts = 0
  const retriable = coalescedRefresh(async () => { if (++attempts === 1) throw new Error("Offline"); return 2 }, value => assert.equal(value, 2), () => errors++, 0)
  retriable.trigger(); await sleep(10); retriable.trigger(); await sleep(10)
  assert.equal(errors, 1); assert.equal(attempts, 2)
  retriable.dispose()
  let authenticated = false
  const calls: Array<{ name: string; args: unknown }> = []
  const client = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: "player" } : null } }) },
    rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return { data: false, error: null } },
  }
  const actions: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/app/(app)/multiplayer/actions.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: actions, require: () => ({ createClient: async () => client }) })
  for (const invoke of [() => actions.startMultiplayerQuiz("room"), () => actions.beginMultiplayerQuiz("room"), () => actions.advanceQuestion("room", 7)]) {
    await assert.rejects(invoke(), /signed in/)
  }
  assert.equal(calls.length, 0, "Signed-out users cannot perform room mutations")
  authenticated = true
  await actions.advanceQuestion("room", 7)
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { name: "advance_multiplayer_question_rpc", args: { p_room_id: "room", p_expected_question: 7 } })
  await actions.beginMultiplayerQuiz("room")
  assert.equal(calls[1].name, "begin_multiplayer_quiz_rpc")
  console.log("Multiplayer invitation, timer, burst, retry and cleanup checks passed")
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
