// Synthetic room only: this harness never imports a Supabase client or server action.
import React from "react"
import { t as translate } from "../../src/lib/i18n"

const text = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, "en", params)
export const useLanguage = () => ({ t: text, dir: "ltr" })
export const useGameReducedMotion = () => true
export const playCue = () => {}
const element = (tag: string) => ({ children, initial, animate, transition, whileHover, whileTap, layout, ...props }: any) => React.createElement(tag, props, children)
export const motion: any = new Proxy({ create: (component: any) => component }, { get: (target, key: string) => key === "create" ? target.create : element(key) })
export default element("a")
export const PageHeader = ({ title }: any) => <h1>{title}</h1>
export const CreateRoomModal = () => null
export const RoomLobby = () => <p>Synthetic lobby</p>
export const QuizResults = () => <p>Synthetic results</p>

const room = { id: "fixture-room", code: "ABC123", hostId: "fixture-player", status: "in_progress", currentQuestion: 1, questionCount: 2 }
const questions = [1, 2].map(number => ({
  id: `fixture-question-${number}`, orderNum: number, startedAt: new Date().toISOString(), timeLimit: 120,
  questionText: `Synthetic round ${number}`, choices: ["Synthetic first choice", "Synthetic second choice"],
}))
const players = [{ id: "fixture-player", userId: "fixture-player", userName: "Fixture player", score: 0, streak: 0, correctAnswers: 0 }]
const scenario = new URLSearchParams(window.location.search).get("scenario")
const staleSaved = scenario === "stale-saved"
const staleRejection = scenario === "stale-rejection" || scenario === "restore-error"
type SavedAnswer = { selectedIndex: number; isCorrect: boolean }
let finishInitialRead!: (answer: SavedAnswer | null) => void
let rejectInitialRead!: (error: Error) => void
const initialRead = new Promise<SavedAnswer | null>((resolve, reject) => { finishInitialRead = resolve; rejectInitialRead = reject })
let reads = 0
const submitted: number[] = []
let callbacks: any
let finishLateSubmission!: (result: { isCorrect: boolean; pointsEarned: number }) => void
const lateSubmission = new Promise<{ isCorrect: boolean; pointsEarned: number }>(resolve => { finishLateSubmission = resolve })
let late = false
export const createClient = () => ({
  auth: { getUser: async () => ({ data: { user: { id: "fixture-player", email: "fixture@example.invalid" } } }) },
  from: () => ({ select() { return this }, eq() { return this }, single: async () => ({ data: { display_name: "Fixture player" } }) }),
})
export const getRoomState = async () => ({ room: { ...room }, questions, players })
export const getMyRoomAnswer = async () => ++reads === 1 ? initialRead : null
export const submitAnswer = async (input: { selectedIndex: number }) => {
  submitted.push(input.selectedIndex)
  if (late) return lateSubmission
  if (submitted.length === 1 && !staleSaved && !staleRejection) throw new Error("Synthetic lost response")
  return { isCorrect: true, pointsEarned: 98 }
}
export const subscribeToRoom = (_room: string, handlers: any) => {
  callbacks = handlers
  queueMicrotask(() => {
    handlers.onQuestionChange(questions)
    handlers.onPlayerChange(players)
    handlers.onRoomChange({ ...room })
    handlers.onConnectionChange("connected")
  })
  return () => { if (callbacks === handlers) callbacks = undefined }
}
export const createRoom = async () => { throw new Error("Unused fixture action") }
export const joinRoom = createRoom
export const startQuiz = createRoom
export const beginQuiz = createRoom
export const nextQuestion = createRoom
export const leaveRoom = async () => {}
export const toggleReady = createRoom

Object.assign(window, { __multiplayerFixture: {
  submitted,
  finishInitialRead: () => staleRejection ? rejectInitialRead(new Error("Synthetic old lookup failed")) : finishInitialRead(staleSaved ? { selectedIndex: 1, isCorrect: false } : null),
  setLate: () => { late = true },
  advance: () => { room.currentQuestion = 2; callbacks.onRoomChange({ ...room }) },
  finishLate: () => finishLateSubmission({ isCorrect: true, pointsEarned: 98 }),
} })
