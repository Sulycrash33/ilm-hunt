import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import ts from "typescript"
import { coalescedRefresh, parseRoomCode, roomInvitePath, questionDeadline, rankPlayers } from "../src/lib/multiplayer-experience"

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
  const restoredAt = Date.parse("2026-09-30T12:01:00Z")
  assert.ok(questionDeadline("2026-09-30T12:00:00Z", 30, restoredAt) < restoredAt, "Restoring an expired round must not restart its timer")
  const standings = [{ id: "c", score: 40 }, { id: "b", score: 100 }, { id: "a", score: 100 }, { id: "d", score: 40 }]
  assert.deepEqual(rankPlayers(standings).map(p => [p.id, p.rank]), [["a", 1], ["b", 1], ["c", 3], ["d", 3]])
  assert.equal(standings[0].id, "c", "Ranking must not mutate room state")
  assert.deepEqual(rankPlayers([{ id: "one", score: 0 }, { id: "two", score: 0 }]).map(p => p.rank), [1, 1])
  assert.deepEqual(rankPlayers([]), [])

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
  let automaticAttempts = 0
  const automaticValues: number[] = []
  const automatic = coalescedRefresh(async () => {
    if (++automaticAttempts < 3) throw new Error("Temporary outage")
    return 3
  }, value => automaticValues.push(value), () => {}, 0, 5)
  automatic.trigger()
  await sleep(60)
  assert.equal(automaticAttempts, 3, "A failed snapshot must retry without another room event")
  assert.deepEqual(automaticValues, [3])
  automatic.dispose()
  let cancelledAttempts = 0
  const cancelledRetry = coalescedRefresh(async () => { cancelledAttempts++; throw new Error("Offline") }, () => assert.fail(), () => {}, 0, 30)
  cancelledRetry.trigger(); await sleep(10); cancelledRetry.dispose(); await sleep(40)
  assert.equal(cancelledAttempts, 1, "Leaving a room must cancel a scheduled retry")

  // Exercise the page's real answer handler with deterministic hooks and a
  // simulated lost RPC response. No browser or production database is needed.
  const state = new Map<number, unknown>([
    [6, "quiz"], [9, "room"], [12, { id: "question", choices: ["One", "Two"], timeLimit: 30 }],
    [13, 1], [14, 5], [17, "player"],
  ])
  const refs: Array<{ current: unknown }> = []
  let stateIndex = 0, refIndex = 0, submissions = 0, recoveryReads = 0
  let recoveryOffline = false
  let recoveryMissing = false, submissionSucceeds = false
  const submittedChoices: number[] = []
  let submissionGate: Promise<{ isCorrect: boolean; pointsEarned: number }> | undefined
  let recoveryGate: Promise<{ selectedIndex: number; isCorrect: boolean }> | undefined
  const savedAnswer = { selectedIndex: 0, isCorrect: true }
  const services = {
    submitAnswer: async (input: { selectedIndex: number }) => {
      submissions++; submittedChoices.push(input.selectedIndex)
      if (submissionGate) return submissionGate
      if (submissionSucceeds) return { isCorrect: true, pointsEarned: 96 }
      throw new Error("Response lost")
    },
    getMyRoomAnswer: async () => { recoveryReads++; if (recoveryOffline) throw new Error("Offline"); return recoveryMissing ? null : recoveryGate ?? savedAnswer },
  }
  const page: Record<string, () => unknown> = {}
  const jsxRuntime = await import("react/jsx-runtime")
  const react = {
    useState: (initial: unknown) => {
      const index = stateIndex++
      return [state.has(index) ? state.get(index) : initial, (value: unknown) => state.set(index, value)]
    },
    useRef: (initial: unknown) => refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }),
    useEffect: () => {}, useCallback: (callback: unknown) => callback,
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/app/(app)/multiplayer/page.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports: page, console: { error() {} }, require: (name: string) => {
    if (name === "react") return react
    if (name === "react/jsx-runtime") return jsxRuntime
    if (name.endsWith("multiplayer-service")) return services
    if (name.endsWith("LanguageContext")) return { useLanguage: () => ({ t: (key: string) => key, dir: "ltr" }) }
    if (name.endsWith("GameExperienceContext")) return { useGameReducedMotion: () => true }
    if (name === "framer-motion") return { motion: { div: "div", p: "p" } }
    return new Proxy({}, { get: (_, key) => String(key) })
  } })
  function findAnswerHandler(node: any): ((choice: number, seconds: number) => Promise<boolean>) | undefined {
    if (!node || typeof node !== "object") return
    if (node.props?.onAnswer) return node.props.onAnswer
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = findAnswerHandler(child)
      if (found) return found
    }
  }
  function renderAnswerHandler() {
    stateIndex = 0; refIndex = 0
    const handler = findAnswerHandler(page.default())!
    refs[5].current = "question"
    assert.ok(handler)
    return handler
  }
  let answer = renderAnswerHandler()
  assert.equal(await answer(0, 2), true)
  assert.deepEqual(state.get(22), savedAnswer, "Lost responses restore the server's submitted choice")
  assert.equal(state.get(23), true)
  refs[6].current = false; refs[7].current = null; state.set(21, false); state.set(22, null)
  recoveryOffline = true
  answer = renderAnswerHandler()
  assert.equal(await answer(0, 2), false)
  assert.equal(submissions, 2)
  recoveryOffline = false
  answer = renderAnswerHandler()
  assert.equal(await answer(1, 3), true)
  assert.equal(submissions, 2, "A retry must resolve an uncertain commit before sending a different choice")
  assert.deepEqual(state.get(22), savedAnswer)
  assert.equal(recoveryReads, 3)
  refs[6].current = false; state.set(21, false); state.set(22, null)
  let completeRecovery!: (value: typeof savedAnswer) => void
  recoveryGate = new Promise(resolve => { completeRecovery = resolve })
  answer = renderAnswerHandler()
  const lateAnswer = answer(0, 2)
  await sleep(0)
  refs[5].current = "next-question"
  completeRecovery(savedAnswer)
  assert.equal(await lateAnswer, false)
  assert.equal(state.get(22), null, "A late recovered answer cannot overwrite the next round")
  recoveryGate = undefined; recoveryMissing = true
  refs[6].current = false; refs[7].current = null; state.set(21, false)
  answer = renderAnswerHandler()
  assert.equal(await answer(0, 2), false)
  submissionSucceeds = true
  answer = renderAnswerHandler()
  assert.equal(await answer(1, 3), true)
  assert.equal(submittedChoices.at(-1), 0, "A null recovery read cannot rule out a later commit; retry the original choice")
  assert.deepEqual(JSON.parse(JSON.stringify(state.get(22))), savedAnswer, "A successful ambiguous retry shows the original choice")

  refs[6].current = false; refs[7].current = null; state.set(21, false); state.set(23, null); state.set(24, null)
  let finishSubmission!: (value: { isCorrect: boolean; pointsEarned: number }) => void
  submissionGate = new Promise(resolve => { finishSubmission = resolve })
  answer = renderAnswerHandler()
  const lateSubmission = answer(0, 2)
  refs[5].current = "next-question"
  finishSubmission({ isCorrect: true, pointsEarned: 96 })
  assert.equal(await lateSubmission, true)
  assert.equal(state.get(23), null, "A late successful response cannot grade the next question")
  assert.equal(state.get(24), null)

  let channelStatus!: (status: string) => void
  let fallbackTick!: () => void
  let fallbackCleared = false, channelsRemoved = 0, snapshotReads = 0
  const listeners = new Map<string, () => void>()
  const connectionStates: string[] = []
  const channel = { on() { return this }, subscribe(callback: (status: string) => void) { channelStatus = callback; return this } }
  const snapshotClient = {
    channel: () => channel,
    removeChannel: async () => { channelsRemoved++ },
    from: (table: string) => {
      const query = {
        select() { return this }, eq() { return this },
        single: async () => { snapshotReads++; return { data: { id: "room", status: "waiting" }, error: null } },
        order: async () => ({ data: [], error: null }),
      }
      assert.ok(["quiz_rooms", "quiz_room_players", "quiz_room_questions_safe"].includes(table))
      return query
    },
  }
  const serviceExports: Record<string, (...args: any[]) => any> = {}
  const eventTarget = {
    visibilityState: "visible",
    addEventListener: (event: string, callback: () => void) => listeners.set(event, callback),
    removeEventListener: (event: string) => listeners.delete(event),
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/multiplayer-service.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports: serviceExports, document: eventTarget, window: eventTarget,
    setInterval: (callback: () => void) => { fallbackTick = callback; return 1 },
    clearInterval: () => { fallbackCleared = true },
    require: (name: string) => name === "./multiplayer-experience" ? { coalescedRefresh } : { createClient: () => snapshotClient },
  })
  const unsubscribe = serviceExports.subscribeToRoom("room", { onConnectionChange: (status: string) => connectionStates.push(status) })
  channelStatus("SUBSCRIBED"); await sleep(80)
  assert.equal(connectionStates.at(-1), "connected")
  channelStatus("CHANNEL_ERROR")
  fallbackTick(); await sleep(80)
  assert.equal(snapshotReads, 2, "Visible rooms refresh while the channel is reconnecting")
  assert.equal(connectionStates.at(-1), "reconnecting", "A successful snapshot cannot claim the live channel is connected")
  eventTarget.visibilityState = "hidden"
  fallbackTick(); await sleep(80)
  assert.equal(snapshotReads, 2, "Background rooms do not poll")
  unsubscribe()
  assert.equal(fallbackCleared, true)
  assert.equal(channelsRemoved, 1)
  assert.equal(listeners.size, 0)
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
  console.log("Multiplayer invitation, timer, lost-answer recovery, reconnect, retry and cleanup checks passed")
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
