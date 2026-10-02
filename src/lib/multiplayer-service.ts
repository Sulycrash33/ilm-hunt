"use client"

import { coalescedRefresh } from "./multiplayer-experience"
import { createClient } from "@/lib/supabase/client"
import { startMultiplayerQuiz, advanceQuestion, beginMultiplayerQuiz } from "@/app/(app)/multiplayer/actions"
import { submitMultiplayerAnswer } from "@/app/(app)/multiplayer/answer-actions"
import type {
  QuizRoom,
  QuizRoomPlayer,
  QuizRoomQuestion,
  QuizRoomDB,
  QuizRoomPlayerDB,
  QuizRoomQuestionDB,
  CreateRoomInput,
  JoinRoomInput,
  SubmitAnswerInput,
} from "./multiplayer-types"

// Transform functions from DB to App types
function transformRoom(db: QuizRoomDB): QuizRoom {
  return {
    id: db.id,
    code: db.code,
    hostId: db.host_id,
    hostName: db.host_name,
    status: db.status,
    category: db.category,
    difficulty: db.difficulty,
    maxPlayers: db.max_players,
    currentPlayers: db.current_players,
    questionCount: db.question_count,
    currentQuestion: db.current_question,
    createdAt: db.created_at,
    startsAt: db.starts_at,
    finishedAt: db.finished_at,
  }
}

function transformPlayer(db: QuizRoomPlayerDB): QuizRoomPlayer {
  return {
    id: db.id,
    roomId: db.room_id,
    userId: db.user_id,
    userName: db.user_name,
    avatarId: db.avatar_id,
    score: db.score,
    correctAnswers: db.correct_answers,
    totalAnswers: db.total_answers,
    streak: db.streak,
    isReady: db.is_ready,
    isHost: db.is_host,
    joinedAt: db.joined_at,
  }
}

function transformQuestion(db: QuizRoomQuestionDB): QuizRoomQuestion {
  return {
    id: db.id,
    roomId: db.room_id,
    questionId: db.question_id,
    questionText: db.question_text,
    choices: Array.isArray(db.choices) ? (db.choices as string[]) : (Object.values(db.choices) as string[]),
    timeLimit: db.time_limit,
    orderNum: db.order_num,
    startedAt: db.started_at,
  }
}

// Generate a unique 6-character room code
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Create a new quiz room
export async function createRoom(
  input: CreateRoomInput,
  hostId: string,
  hostName: string
): Promise<QuizRoom> {
  const supabase = createClient()
  const roomCode = generateRoomCode()

  const { data: room, error: roomError } = await supabase
    .from("quiz_rooms")
    .insert({
      code: roomCode,
      host_id: hostId,
      host_name: hostName,
      status: "waiting",
      // No category. Migration 0056 moved battles onto the arena bank, which
      // is drawn across every subject at once, and made this column nullable
      // for exactly this. Rooms created before it keep the category they used,
      // so the history stays legible.
      category: null,
      difficulty: input.difficulty,
      max_players: input.maxPlayers,
      current_players: 1,
      question_count: input.questionCount,
      current_question: 0,
    })
    .select()
    .single()

  if (roomError || !room) throw new Error("Failed to create room")

  // Add host as first player.
  //
  // The name and avatar are deliberately not sent. Since migration 0036 a
  // trigger stamps both from `profiles`, so whatever this insert claimed would
  // be overwritten anyway — and sending them would suggest, to the next
  // reader, that a client gets to choose who it plays as. It does not.
  const { error: playerError } = await supabase
    .from("quiz_room_players")
    .insert({
      room_id: room.id,
      user_id: hostId,
      is_ready: true,
      is_host: true,
    })

  if (playerError) throw new Error("Failed to add host to room")

  return transformRoom(room as QuizRoomDB)
}

// Join an existing room
// Join a room by code - delegated to a SECURITY DEFINER function so the
// player-count increment (which the joining player has no RLS permission
// to do directly) and the "room is full" check happen atomically and
// correctly. See supabase/migrations.
export async function joinRoom(input: JoinRoomInput): Promise<QuizRoom> {
  const supabase = createClient()

  // The code is the only thing a joining player gets to say. `p_user_name` was
  // removed in migration 0036: the room reads the name off the account, so a
  // player can no longer walk into a lobby wearing someone else's.
  const { data: roomId, error } = await supabase.rpc("join_room_rpc", {
    p_room_code: input.roomCode.toUpperCase(),
  })
  if (error) throw new Error(error.message || "Failed to join room")

  const { data: room, error: roomError } = await supabase
    .from("quiz_rooms")
    .select("*")
    .eq("id", roomId)
    .single()
  if (roomError || !room) throw new Error("Room not found")

  return transformRoom(room as QuizRoomDB)
}

// Start the quiz (host only) - uses server action
export async function startQuiz(roomId: string): Promise<void> {
  await startMultiplayerQuiz(roomId)
}

// Advance to the next question, or finish the quiz (host only) - uses server action
export async function nextQuestion(roomId: string, expectedQuestion: number): Promise<boolean> {
  return advanceQuestion(roomId, expectedQuestion)
}

export const beginQuiz = beginMultiplayerQuiz

// Submit an answer - uses server action
export async function submitAnswer(
  input: SubmitAnswerInput,
  userId: string
): Promise<{ isCorrect: boolean; pointsEarned: number }> {
  return submitMultiplayerAnswer(input)
}

// Get room state
export async function getRoomState(roomId: string): Promise<{
  room: QuizRoom
  players: QuizRoomPlayer[]
  questions: QuizRoomQuestion[]
}> {
  const supabase = createClient()

  const [roomResult, playerResult, questionResult] = await Promise.all([
    supabase.from("quiz_rooms").select("*").eq("id", roomId).single(),
    supabase.from("quiz_room_players").select("*").eq("room_id", roomId).order("joined_at"),
    // Only the safe view can supply questions to the browser.
    supabase.from("quiz_room_questions_safe")
      .select("id, room_id, question_id, question_text, choices, time_limit, order_num, started_at")
      .eq("room_id", roomId).order("order_num"),
  ])
  if (roomResult.error || !roomResult.data) throw new Error("Room not found")
  if (playerResult.error || questionResult.error) throw new Error("Unable to refresh room")
  const room = roomResult.data
  const players = playerResult.data
  const questions = questionResult.data

  return {
    room: transformRoom(room as QuizRoomDB),
    players: (players || []).map(transformPlayer),
    questions: (questions || []).map(transformQuestion),
  }
}

export type RoomConnection = "connecting" | "connected" | "reconnecting" | "error"

// A single snapshot handles event bursts and recovers missed events on reconnect.
export function subscribeToRoom(
  roomId: string,
  callbacks: {
    onRoomChange?: (room: QuizRoom) => void
    onPlayerChange?: (players: QuizRoomPlayer[]) => void
    onQuestionChange?: (questions: QuizRoomQuestion[]) => void
    onConnectionChange?: (status: RoomConnection) => void
  }
) {
  const supabase = createClient()
  let disposed = false
  let subscribed = false
  const refresh = coalescedRefresh(() => getRoomState(roomId), (state) => {
    // Questions first: the room callback can immediately resolve its active question.
    callbacks.onQuestionChange?.(state.questions)
    callbacks.onPlayerChange?.(state.players)
    callbacks.onRoomChange?.(state.room)
    callbacks.onConnectionChange?.(subscribed ? "connected" : "reconnecting")
  }, () => callbacks.onConnectionChange?.("error"))
  callbacks.onConnectionChange?.("connecting")
  const channel = supabase.channel(`room:${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "quiz_rooms", filter: `id=eq.${roomId}` }, refresh.trigger)
    .on("postgres_changes", { event: "*", schema: "public", table: "quiz_room_players", filter: `room_id=eq.${roomId}` }, refresh.trigger)
    .on("postgres_changes", { event: "*", schema: "public", table: "quiz_room_questions", filter: `room_id=eq.${roomId}` }, refresh.trigger)
    .subscribe((status) => {
      if (disposed) return
      subscribed = status === "SUBSCRIBED"
      if (subscribed) refresh.trigger()
      else callbacks.onConnectionChange?.("reconnecting")
    })
  // Realtime can miss events while reconnecting. Keep visible rooms usable
  // through snapshots, without claiming the live subscription has recovered.
  const recoveryTimer = setInterval(() => {
    if (!subscribed && document.visibilityState === "visible") refresh.trigger()
  }, 15000)
  const onVisible = () => { if (document.visibilityState === "visible") refresh.trigger() }
  const onOnline = () => refresh.trigger()
  document.addEventListener("visibilitychange", onVisible)
  window.addEventListener("online", onOnline)
  return () => {
    disposed = true
    clearInterval(recoveryTimer)
    refresh.dispose()
    document.removeEventListener("visibilitychange", onVisible)
    window.removeEventListener("online", onOnline)
    void supabase.removeChannel(channel)
  }
}

// Leave room - delegated to a SECURITY DEFINER function so host-transfer
// (which needs to reassign quiz_rooms.host_id to someone else) works
// correctly and can't be spoofed. See supabase/migrations.
export async function leaveRoom(roomId: string, _userId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc("leave_room_rpc", { p_room_id: roomId })
  if (error) throw error
}

// Toggle ready status
export async function toggleReady(roomId: string, userId: string): Promise<void> {
  const supabase = createClient()

  const { data: player, error: readError } = await supabase
    .from("quiz_room_players")
    .select("is_ready")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .single()

  if (readError || !player) throw new Error("Player not found")
  if (player) {
    const { error } = await supabase
      .from("quiz_room_players")
      .update({ is_ready: !player.is_ready })
      .eq("room_id", roomId)
      .eq("user_id", userId)
    if (error) throw error
  }
}

// Get current room for user
export async function getCurrentRoom(userId: string): Promise<QuizRoom | null> {
  const supabase = createClient()

  const { data: player } = await supabase
    .from("quiz_room_players")
    .select("room_id")
    .eq("user_id", userId)
    .single()

  if (!player) return null

  const { data: room } = await supabase
    .from("quiz_rooms")
    .select("*")
    .eq("id", player.room_id)
    .single()

  if (!room) return null

  return transformRoom(room as QuizRoomDB)
}

// Only this player's submitted choice/result is needed for refresh recovery.
export async function getMyRoomAnswer(roomId: string, questionId: string, userId: string) {
  const { data, error } = await createClient().from("quiz_room_answers")
    .select("selected_index, is_correct").eq("room_id", roomId)
    .eq("question_id", questionId).eq("user_id", userId).maybeSingle()
  if (error) throw error
  return data ? { selectedIndex: data.selected_index as number, isCorrect: data.is_correct as boolean } : null
}
