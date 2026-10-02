"use client"

import { useGameReducedMotion } from "@/contexts/GameExperienceContext"

import { PageHeader } from "@/components/layout/PageHeader"
import { Swords } from "lucide-react"

import { motion } from "framer-motion"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumButton } from "@/components/ui/premium-button"
import { PremiumBadge } from "@/components/ui/premium-badge"
import { CreateRoomModal } from "@/components/multiplayer/CreateRoomModal"
import { RoomLobby } from "@/components/multiplayer/RoomLobby"
import { LiveQuiz } from "@/components/multiplayer/LiveQuiz"
import { QuizResults } from "@/components/multiplayer/QuizResults"
import {
  createRoom,
  joinRoom,
  startQuiz,
  beginQuiz,
  getMyRoomAnswer,
  submitAnswer,
  nextQuestion,
  getRoomState,
  subscribeToRoom,
  leaveRoom,
  toggleReady,
} from "@/lib/multiplayer-service"
import { parseRoomCode } from "@/lib/multiplayer-experience"
import type { RoomConnection } from "@/lib/multiplayer-service"
import type { QuizRoom, QuizRoomPlayer, QuizRoomQuestion } from "@/lib/multiplayer-types"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/contexts/LanguageContext"
import type { Translations } from "@/lib/i18n"

// The category list that used to sit here is gone with the picker it fed.
//
// Worth recording why, because it was not only unused: its ids were slugs like
// "holy-quran", and `start_multiplayer_quiz_rpc` compared the room's category
// to `questions.category_id::text` — a uuid. Those could never match, so every
// battle would have raised "No questions available for this category" and no
// quiz could ever have started. Five of the six ids did not match a category
// slug either. Nothing caught it because no room has ever been created.
//
// Migration 0056 removes the category filter altogether, so the bug goes with
// it: a battle now draws from the whole arena bank at the room's difficulty.

type ViewState = "home" | "creating" | "joining" | "lobby" | "countdown" | "quiz" | "results"

export default function MultiplayerPage() {
  const { t, dir } = useLanguage()
  const reduce = useGameReducedMotion()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [connection, setConnection] = useState<RoomConnection>("connecting")
  const [invited, setInvited] = useState(false)
  const [joining, setJoining] = useState(false)
  const joinLock = useRef(false)
  const roomActionLock = useRef(false)
  const [roomActionPending, setRoomActionPending] = useState(false)
  const roomRef = useRef<QuizRoom | null>(null)
  const [viewState, setViewState] = useState<ViewState>("home")
  const [roomCode, setRoomCode] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [roomId, setRoomId] = useState<string | null>(null)
  const [room, setRoom] = useState<QuizRoom | null>(null)
  const [players, setPlayers] = useState<QuizRoomPlayer[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<QuizRoomQuestion | null>(null)
  const [questionNumber, setQuestionNumber] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [isHost, setIsHost] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string>("")
  const [countdown, setCountdown] = useState(3)
  const [timeRemaining, setTimeRemaining] = useState(30)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [restoredAnswer, setRestoredAnswer] = useState<{ selectedIndex: number; isCorrect: boolean } | null>(null)
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null)
  const [answerPoints, setAnswerPoints] = useState<number | null>(null)
  const [countdownFailed, setCountdownFailed] = useState(false)

  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => { if (countdownTimer.current) clearInterval(countdownTimer.current) }, [])

  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const code = parseRoomCode(new URLSearchParams(window.location.search).get("room"))
    if (code) { setJoinCode(code); setInvited(true) }
  }, [])

  // Get current user on mount
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) setRestoring(false)
      if (data.user) {
        setCurrentUserId(data.user.id)
        // Get user's display name
        supabase
          .from("profiles")
          .select("display_name")
          .eq("id", data.user.id)
          .single()
          .then(({ data: profile }) => {
            setCurrentUserName(profile?.display_name || data.user!.email?.split("@")[0] || "Player")
          })
      }
    }).catch(() => { setRestoring(false); setErrorMessage(t("somethingWentWrong")) })
  }, [t])

  // Keep the latest fetched questions around so the room-status callback
  // (which fires independently of the questions callback) can look up the
  // active question without an extra round trip.
  const activeQuestionRef = useRef<string | null>(null)
  const answerLock = useRef(false)
  const answerRecoveryRef = useRef<{ questionId: string; selectedIndex: number | null } | null>(null)
  const questionsRef = useRef<QuizRoomQuestion[]>([])
  const viewStateRef = useRef<ViewState>("home")
  useEffect(() => {
    viewStateRef.current = viewState
  }, [viewState])

  const applyActiveQuestion = useCallback((updatedRoom: QuizRoom) => {
    if (updatedRoom.status !== "in_progress") return
    const active = questionsRef.current.find((q) => q.orderNum === updatedRoom.currentQuestion)
    if (!active || !active.startedAt) return
    if (activeQuestionRef.current === active.id) {
      setCurrentQuestion(previous => previous?.startedAt === active.startedAt ? previous : active)
      return
    }
    activeQuestionRef.current = active.id
    answerRecoveryRef.current = null
    answerLock.current = false
    setErrorMessage(null)
    setCurrentQuestion(active)
    setQuestionNumber(updatedRoom.currentQuestion)
    setTotalQuestions(updatedRoom.questionCount)
    setTimeRemaining(active.timeLimit)
    setHasAnswered(false)
    setLastAnswerCorrect(null)
    setAnswerPoints(null)
    setRestoredAnswer(null)
  }, [])

  // Only restore a room this signed-in player still belongs to. Invitations
  // prefill a code; they never join or replace a room without a button press.
  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    const key = `ilm-room:${currentUserId}`
    async function restore() {
      try {
        const saved = sessionStorage.getItem(key)
        if (!saved) return
        const state = await getRoomState(saved)
        if (cancelled) return
        if (!state.players.some(p => p.userId === currentUserId)) {
          sessionStorage.removeItem(key)
          return
        }
        const invitation = parseRoomCode(new URLSearchParams(window.location.search).get("room"))
        if (invitation && invitation !== state.room.code) return
        questionsRef.current = state.questions
        roomRef.current = state.room
        setRoom(state.room)
        setRoomId(state.room.id)
        setRoomCode(state.room.code)
        setPlayers(state.players)
        setIsHost(state.room.hostId === currentUserId)
        setTotalQuestions(state.room.questionCount)
        setViewState(state.room.status === "finished" ? "results" : state.room.status === "in_progress" ? "quiz" : "lobby")
        setShowResults(state.room.status === "finished")
        applyActiveQuestion(state.room)
        const active = state.questions.find(q => q.orderNum === state.room.currentQuestion)
        if (active && state.room.status === "in_progress") {
          // Rendering the room must not allow a new submission before this
          // lookup resolves. A failed restore remains uncertain until retry.
          answerRecoveryRef.current = { questionId: active.id, selectedIndex: null }
          const answer = await getMyRoomAnswer(saved, active.id, currentUserId!)
          if (!cancelled && activeQuestionRef.current === active.id) {
            answerRecoveryRef.current = null
            if (answer) {
              setRestoredAnswer(answer); setLastAnswerCorrect(answer.isCorrect)
              setHasAnswered(true); answerLock.current = true
            }
          }
        }
      } catch {
        if (!cancelled) setErrorMessage(t("roomRefreshFailed"))
      } finally { if (!cancelled) setRestoring(false) }
    }
    void restore()
    return () => { cancelled = true }
  }, [currentUserId, applyActiveQuestion, t])

  useEffect(() => {
    if (!currentUserId || !roomId) return
    try { sessionStorage.setItem(`ilm-room:${currentUserId}`, roomId) } catch { /* Storage may be disabled. */ }
  }, [currentUserId, roomId])

  useEffect(() => { roomRef.current = room }, [room])

  const startCountdown = useCallback((startingRoom: QuizRoom) => {
    setCountdownFailed(false)
    if (countdownTimer.current) clearInterval(countdownTimer.current)
    const start = startingRoom.startsAt ? Date.parse(startingRoom.startsAt) : Date.now() + 5000
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((start - Date.now()) / 1000))
      setCountdown(remaining)
      if (remaining > 0) return
      if (countdownTimer.current) clearInterval(countdownTimer.current)
      countdownTimer.current = null
      void beginQuiz(startingRoom.id).catch(() => {
        if (roomRef.current?.id === startingRoom.id && roomRef.current.status === "starting") {
          setErrorMessage(t("failedStartQuiz"))
          setCountdownFailed(true)
          setConnection("error")
        }
      })
    }
    countdownTimer.current = setInterval(tick, 250)
    tick()
  }, [t])

  // Subscribe to room updates
  useEffect(() => {
    if (!roomId) return

    const unsubscribe = subscribeToRoom(roomId, {
      onRoomChange: (updatedRoom) => {
        roomRef.current = updatedRoom
        setRoom(updatedRoom)
        setIsHost(updatedRoom.hostId === currentUserId)
        setRoomCode(updatedRoom.code)
        if (updatedRoom.status !== "starting") setCountdownFailed(false)
        if (updatedRoom.status === "waiting") {
          if (viewStateRef.current !== "lobby") {
            activeQuestionRef.current = null
            setCurrentQuestion(null)
            setShowResults(false)
            setViewState("lobby")
          }
        }
        if (updatedRoom.status === "in_progress") setViewState("quiz")

        if (updatedRoom.status === "starting" && viewStateRef.current !== "countdown") {
          setViewState("countdown")
          viewStateRef.current = "countdown"
          startCountdown(updatedRoom)
        }

        if (updatedRoom.status === "finished") {
          setShowResults(true)
          setViewState("results")
        }

        applyActiveQuestion(updatedRoom)
      },
      onConnectionChange: setConnection,
      onPlayerChange: (updatedPlayers) => {
        setPlayers(updatedPlayers)
      },
      onQuestionChange: (updatedQuestions) => {
        questionsRef.current = updatedQuestions
        if (roomRef.current) applyActiveQuestion(roomRef.current)
      },
    })

    unsubscribeRef.current = unsubscribe

    return () => {
      unsubscribe()
    }
  }, [roomId, currentUserId, applyActiveQuestion, startCountdown])


  const handleCreateRoom = async (config: { difficulty: "easy" | "medium" | "hard"; maxPlayers: number; questionCount: number }) => {
    setErrorMessage(null)
    if (!currentUserId || !currentUserName) {
      setErrorMessage(t("loadingProfileWait"))
      return
    }

    try {
      const newRoom = await createRoom(config, currentUserId, currentUserName)
      setRoomId(newRoom.id)
      setRoom(newRoom)
      setRoomCode(newRoom.code)
      setIsHost(true)
      setTotalQuestions(config.questionCount)
      setViewState("lobby")

      // Refresh players
      const state = await getRoomState(newRoom.id)
      setPlayers(state.players)
    } catch (error) {
      console.error("Error creating room:", error)
      setErrorMessage(t("failedCreateRoom"))
    }
  }

  const handleJoinRoom = async () => {
    if (!/^[A-Z0-9]{6}$/.test(joinCode) || !currentUserId || !currentUserName || joinLock.current) return
    joinLock.current = true
    setJoining(true)
    setErrorMessage(null)

    try {
      const joinedRoom = await joinRoom({ roomCode: joinCode.toUpperCase() })
      setRoomId(joinedRoom.id)
      setRoom(joinedRoom)
      setRoomCode(joinedRoom.code)
      setIsHost(joinedRoom.hostId === currentUserId)
      setViewState("lobby")

      // Refresh players
      const state = await getRoomState(joinedRoom.id)
      setPlayers(state.players)
    } catch (error) {
      console.error("Error joining room:", error)
      setErrorMessage(error instanceof Error ? error.message : t("failedJoinRoom"))
    } finally { joinLock.current = false; setJoining(false) }
  }

  const handleStartQuiz = async () => {
    if (!roomId || !isHost) return
    if (roomActionLock.current) return
    roomActionLock.current = true
    setRoomActionPending(true)
    setErrorMessage(null)

    try {
      await startQuiz(roomId)
    } catch (error) {
      console.error("Error starting quiz:", error)
      setErrorMessage(t("failedStartQuiz"))
    } finally { roomActionLock.current = false; setRoomActionPending(false) }
  }

  const handleAnswer = async (selectedIndex: number, timeTaken: number): Promise<boolean> => {
    if (!roomId || !currentQuestion || hasAnswered || answerLock.current) return false
    answerLock.current = true
    setErrorMessage(null)
    const answeringQuestionId = currentQuestion.id
    const recovery = answerRecoveryRef.current
    const answerIndex = recovery?.questionId === answeringQuestionId ? recovery.selectedIndex ?? selectedIndex : selectedIndex
    let submissionAttempted = false

    try {
      setHasAnswered(true)
      // An earlier transport failure might still have committed. Resolve it
      // before submitting another choice, even when its first recovery failed.
      if (recovery?.questionId === answeringQuestionId) {
        const saved = await getMyRoomAnswer(roomId, answeringQuestionId, currentUserId!)
        if (activeQuestionRef.current !== answeringQuestionId) return false
        if (saved) {
          answerRecoveryRef.current = null
          setRestoredAnswer(saved)
          setLastAnswerCorrect(saved.isCorrect)
          return true
        }
      }
      submissionAttempted = true
      const result = await submitAnswer(
        {
          roomId,
          questionId: currentQuestion.id,
          selectedIndex: answerIndex,
          timeTaken,
        },
        currentUserId!
      )
      if (activeQuestionRef.current !== answeringQuestionId) return true
      answerRecoveryRef.current = null
      // A missing saved row cannot rule out the original RPC committing later.
      // Retry the original choice, and show it even if a different button was
      // pressed while the response was uncertain.
      if (answerIndex !== selectedIndex) setRestoredAnswer({ selectedIndex: answerIndex, isCorrect: result.isCorrect })
      setLastAnswerCorrect(result.isCorrect)
      setAnswerPoints(result.pointsEarned)
      return true
    } catch (error) {
      console.error("Error submitting answer:", error)
      if (activeQuestionRef.current !== answeringQuestionId) return false
      answerRecoveryRef.current = {
        questionId: answeringQuestionId,
        selectedIndex: submissionAttempted ? answerIndex : recovery?.selectedIndex ?? null,
      }
      // The server may have saved the answer before its response was lost.
      // Restore that exact choice instead of allowing a retry to show a
      // different choice beside the first answer's idempotent graded result.
      try {
        const saved = await getMyRoomAnswer(roomId, answeringQuestionId, currentUserId!)
        if (activeQuestionRef.current !== answeringQuestionId) return false
        if (saved) {
          answerRecoveryRef.current = null
          setRestoredAnswer(saved)
          setLastAnswerCorrect(saved.isCorrect)
          return true
        }
      } catch { /* Keep the question retryable if recovery is also offline. */ }
      if (activeQuestionRef.current !== answeringQuestionId) return false
      answerLock.current = false
      setHasAnswered(false)
      setErrorMessage(t("somethingWentWrong"))
      return false
    }
  }

  const handleNextQuestion = async () => {
    if (!roomId || !isHost) return
    if (roomActionLock.current) return
    roomActionLock.current = true
    setRoomActionPending(true)
    setErrorMessage(null)

    try {
      const finished = await nextQuestion(roomId, questionNumber)
      if (finished) {
        setShowResults(true)
        setViewState("results")
      }
    } catch (error) {
      console.error("Error moving to next question:", error)
      setErrorMessage(t("somethingWentWrong"))
    } finally { roomActionLock.current = false; setRoomActionPending(false) }
  }

  const handleLeave = async () => {
    if (roomActionLock.current) return
    roomActionLock.current = true
    setRoomActionPending(true)
    if (roomId && currentUserId) {
      try {
        await leaveRoom(roomId, currentUserId)
      } catch (error) {
        console.error("Error leaving room:", error)
        setErrorMessage(t("somethingWentWrong"))
        roomActionLock.current = false
        setRoomActionPending(false)
        return
      }
    }

    if (countdownTimer.current) clearInterval(countdownTimer.current)
    roomActionLock.current = false
    setRoomActionPending(false)
    try { sessionStorage.removeItem(`ilm-room:${currentUserId}`) } catch { /* Storage may be disabled. */ }
    unsubscribeRef.current?.()
    setViewState("home")
    setRoomId(null)
    setRoomCode("")
    setRoom(null)
    setPlayers([])
    setCurrentQuestion(null)
    activeQuestionRef.current = null
    answerLock.current = false
    setErrorMessage(null)
    setQuestionNumber(0)
    setShowResults(false)
    setCountdownFailed(false)
  }

  const handleToggleReady = async () => {
    if (!roomId || !currentUserId) return
    if (roomActionLock.current) return
    roomActionLock.current = true
    setRoomActionPending(true)
    setErrorMessage(null)

    try {
      await toggleReady(roomId, currentUserId)
    } catch (error) {
      console.error("Error toggling ready:", error)
      setErrorMessage(t("somethingWentWrong"))
    } finally { roomActionLock.current = false; setRoomActionPending(false) }
  }

  const handlePlayAgain = async () => {
    if (!roomId || !isHost) return
    if (roomActionLock.current) return
    roomActionLock.current = true
    setRoomActionPending(true)
    setErrorMessage(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.rpc("restart_room_rpc", { p_room_id: roomId })
      if (error) throw error

      setShowResults(false)
      activeQuestionRef.current = null
      answerLock.current = false
      setViewState("lobby")
    } catch (error) {
      console.error("Error resetting game:", error)
      setErrorMessage(t("somethingWentWrong"))
    } finally { roomActionLock.current = false; setRoomActionPending(false) }
  }

  return (
    <div dir={dir} className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader title={t("multiplayerQuiz")} subtitle={t("playTogetherHint")} icon={Swords} />

      {errorMessage && <p role="alert" className="mb-5 rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-error">{errorMessage}</p>}
      {restoring && <p role="status" className="mb-5 text-center text-on-surface-variant">{t("roomRestoring")}</p>}
      {!roomId && invited && !restoring && <p role="status" className="mb-5 rounded-xl border border-primary/30 bg-primary/10 p-4 text-primary">{t("roomInvited")}</p>}
      {roomId && <div role="status" className="mb-5 flex flex-wrap items-center justify-center gap-3 text-sm text-on-surface-variant">
        <span className={`h-2 w-2 rounded-full ${connection === "connected" ? "bg-tertiary" : "bg-amber-400"}`} aria-hidden="true" />
        <span>{t(connection === "connected" ? "roomConnected" : connection === "error" ? "roomRefreshFailed" : "roomReconnecting")}</span>
        {(connection !== "connected" || countdownFailed) && <PremiumButton variant="secondary" size="sm" disabled={roomActionPending} onClick={async () => {
          if (!roomId || roomActionLock.current) return
          roomActionLock.current = true; setRoomActionPending(true)
          try {
            let state = await getRoomState(roomId)
            if (state.room.status === "starting" && state.room.startsAt && Date.parse(state.room.startsAt) <= Date.now()) {
              await beginQuiz(roomId)
              state = await getRoomState(roomId)
            }
            setErrorMessage(null)
            questionsRef.current = state.questions; roomRef.current = state.room
            setRoom(state.room); setPlayers(state.players); setIsHost(state.room.hostId === currentUserId)
            applyActiveQuestion(state.room)
            if (state.room.status === "starting") {
              setViewState("countdown")
              viewStateRef.current = "countdown"
              startCountdown(state.room)
            } else {
              setCountdownFailed(false)
              setViewState(state.room.status === "finished" ? "results" : state.room.status === "in_progress" ? "quiz" : "lobby")
            }
            setShowResults(state.room.status === "finished")
            // Snapshot recovery does not establish a live Realtime connection.
          } catch {
            setConnection("error")
            if (roomRef.current?.status === "starting") setCountdownFailed(true)
          }
          finally { roomActionLock.current = false; setRoomActionPending(false) }
        }}>{t("tryAgain")}</PremiumButton>}
      </div>}
      {roomId && (viewState === "quiz" || viewState === "countdown") && <div className="mb-5 flex justify-end">
        <PremiumButton variant="secondary" size="sm" disabled={roomActionPending} onClick={handleLeave}>{t("leaveRoom")}</PremiumButton>
      </div>}
      {/* Home State */}
      {viewState === "home" && !restoring && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto grid gap-5 md:grid-cols-2"
        >
          {/* Create Room */}
          <PremiumCard hover className="p-6" onClick={() => setViewState("creating")}>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary-container/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-on-surface text-lg">{t("createRoom")}</h3>
                <p className="text-on-surface-variant">{t("hostQuiz")}</p>
              </div>
            </div>
          </PremiumCard>

          {/* Join Room */}
          <PremiumCard className="p-6">
            <h3 className="font-bold text-on-surface text-lg mb-4">{t("joinRoom")}</h3>
            <div className="flex gap-2">
              <input
                type="text"
                aria-label={t("roomCode")}
                autoComplete="off"
                placeholder={t("enterRoomCode")}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                className="min-w-0 flex-1 px-4 py-3 bg-surface-container-high rounded-lg border border-white/5 text-on-surface font-mono text-center text-lg tracking-widest placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                maxLength={6}
              />
              <PremiumButton
                variant="primary"
                onClick={handleJoinRoom}
                disabled={joinCode.length < 6 || !currentUserId || joining}
              >
                {joining ? t("processingLabel") : t("joinLabel")}
              </PremiumButton>
            </div>
          </PremiumCard>

          {/* Instructions */}
          <PremiumCard className="p-6">
            <h3 className="font-bold text-on-surface text-lg mb-4">{t("howToPlay")}</h3>
            <div className="space-y-3 text-on-surface-variant">
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">1.</span>
                <p>{t("step1CreateOrJoin")}</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">2.</span>
                <p>{t("step2WaitReady")}</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">3.</span>
                <p>{t("step3AnswerFast")}</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">4.</span>
                <p>{t("step4BuildStreaks")}</p>
              </div>
            </div>
          </PremiumCard>
        </motion.div>
      )}

      {/* Creating Room Modal */}
      <CreateRoomModal
        error={errorMessage}
        isOpen={viewState === "creating"}
        onClose={() => setViewState("home")}
        onCreateRoom={handleCreateRoom}
      />

      {/* Lobby */}
      {viewState === "lobby" && (
        <RoomLobby
          roomCode={roomCode}
          players={players.map((p) => ({
            id: p.userId,
            userName: p.userName,
            avatarId: p.avatarId,
            isHost: p.isHost,
            isReady: p.isReady,
            score: p.score,
          }))}
          currentUserId={currentUserId || ""}
          isHost={isHost}
          pending={roomActionPending}
          onStart={handleStartQuiz}
          onLeave={handleLeave}
          onToggleReady={handleToggleReady}
          isReady={players.find((p) => p.userId === currentUserId)?.isReady || false}
        />
      )}

      {/* Countdown */}
      {viewState === "countdown" && (
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center min-h-[60vh]"
        >
          <motion.div
            key={countdown}
            initial={reduce ? false : { scale: 0, opacity: 0 }}
            animate={reduce ? { scale: 1, opacity: 1 } : { scale: [0, 1.5, 1], opacity: [0, 1, 1] }}
            transition={{ duration: 0.5 }}
            className="text-8xl font-bold text-primary mb-4"
          >
            {countdown}
          </motion.div>
          <motion.p
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl text-on-surface-variant"
          >
            {t("getReady")}
          </motion.p>
        </motion.div>
      )}

      {/* Quiz */}
      {viewState === "quiz" && currentQuestion && (
        <LiveQuiz
          question={{
            id: currentQuestion.id,
            startedAt: currentQuestion.startedAt,
            questionText: currentQuestion.questionText,
            choices: currentQuestion.choices,
            timeLimit: currentQuestion.timeLimit,
          }}
          questionNumber={questionNumber}
          totalQuestions={totalQuestions}
          timeLimit={currentQuestion.timeLimit}
          players={players.map((p) => ({
            id: p.userId,
            userName: p.userName,
            score: p.score,
            correctAnswers: p.correctAnswers,
            streak: p.streak,
          }))}
          currentUserId={currentUserId || ""}
          onAnswer={handleAnswer}
          restoredAnswer={restoredAnswer}
          nextPending={roomActionPending}
          onNextQuestion={handleNextQuestion}
          isHost={isHost}
          showResults={showResults}
          lastAnswerCorrect={lastAnswerCorrect}
          answerPoints={answerPoints}
        />
      )}

      {/* Results */}
      {viewState === "results" && (
        <QuizResults
          players={players.map((p) => ({
            id: p.userId,
            userName: p.userName,
            avatarId: p.avatarId,
            score: p.score,
            correctAnswers: p.correctAnswers,
            totalAnswers: p.totalAnswers,
            streak: p.streak,
          }))}
          currentUserId={currentUserId || ""}
          pending={roomActionPending}
          onPlayAgain={handlePlayAgain}
          onLeave={handleLeave}
          isHost={isHost}
        />
      )}
    </div>
  )
}
