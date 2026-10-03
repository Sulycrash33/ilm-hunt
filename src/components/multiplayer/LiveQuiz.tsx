"use client"

import { useGameReducedMotion } from "@/contexts/GameExperienceContext"

import { questionDeadline, rankPlayers } from "@/lib/multiplayer-experience"
import { playCue } from "@/lib/sound"
import { motion } from "framer-motion"
import { useState, useEffect, useCallback, useRef } from "react"
import { PremiumButton } from "@/components/ui/premium-button"
import { PremiumBadge } from "@/components/ui/premium-badge"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumProgress } from "@/components/ui/premium-progress"
import { useLanguage } from "@/contexts/LanguageContext"

interface Question {
  id: string
  questionText: string
  choices: string[]
  timeLimit: number
  startedAt?: string | null
}

interface Player {
  id: string
  userName: string
  score: number
  correctAnswers: number
  streak: number
}

interface LiveQuizProps {
  answerPoints?: number | null
  restoredAnswer?: { selectedIndex: number; isCorrect: boolean } | null
  nextPending?: boolean
  question: Question
  questionNumber: number
  totalQuestions: number
  timeLimit: number
  players: Player[]
  currentUserId: string
  onAnswer: (selectedIndex: number, timeTaken: number) => (Promise<boolean>)
  onNextQuestion: () => void
  isHost: boolean
  showResults: boolean
  /** Real graded result for the answer just submitted - server-authoritative,
   * so this component never has to guess (or fake) which choice is correct. */
  lastAnswerCorrect: boolean | null
}

export function LiveQuiz({
  question,
  answerPoints = null,
  restoredAnswer,
  nextPending = false,
  questionNumber,
  totalQuestions,
  timeLimit,
  players,
  currentUserId,
  onAnswer,
  onNextQuestion,
  isHost,
  showResults,
  lastAnswerCorrect,
}: LiveQuizProps) {
  const { t } = useLanguage()
  const reduce = useGameReducedMotion()
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(timeLimit)
  const [hasAnswered, setHasAnswered] = useState(false)

  const answerLock = useRef(false)
  const activeQuestion = useRef(question.id)
  const deadline = useRef(0)
  const [submitting, setSubmitting] = useState(false)
  const feedbackPlayed = useRef<string | null>(null)
  const questionHeading = useRef<HTMLHeadingElement>(null)
  const answerFeedback = useRef<HTMLHeadingElement>(null)

  useEffect(() => { questionHeading.current?.focus() }, [question.id])
  useEffect(() => {
    if (hasAnswered && lastAnswerCorrect !== null) answerFeedback.current?.focus()
  }, [hasAnswered, lastAnswerCorrect])

  useEffect(() => {
    activeQuestion.current = question.id
    answerLock.current = !!restoredAnswer
    setSubmitting(false)
    setSelectedChoice(restoredAnswer?.selectedIndex ?? null)
    setHasAnswered(!!restoredAnswer)
  }, [question.id, restoredAnswer])

  useEffect(() => {
    deadline.current = questionDeadline(question.startedAt, timeLimit)
    setTimeRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)))
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))
      setTimeRemaining(remaining)
      if (remaining === 0) { setHasAnswered(true); clearInterval(timer) }
    }, 250)
    return () => clearInterval(timer)
  }, [question.id, question.startedAt, timeLimit])

  useEffect(() => {
    if (restoredAnswer || selectedChoice === null || lastAnswerCorrect === null || feedbackPlayed.current === question.id) return
    feedbackPlayed.current = question.id
    playCue(lastAnswerCorrect ? "correct" : "wrong")
  }, [question.id, selectedChoice, lastAnswerCorrect, restoredAnswer])

  const handleAnswer = useCallback(async (index: number) => {
    if (hasAnswered || answerLock.current || Date.now() >= deadline.current) return
    const questionId = question.id
    answerLock.current = true
    setSubmitting(true)
    setSelectedChoice(index)
    setHasAnswered(true)
    let accepted = false
    try {
      accepted = await onAnswer(index, Math.floor(Math.min(timeLimit, Math.max(0, (Date.now() - (deadline.current - timeLimit * 1000)) / 1000))))
    } catch {
      accepted = false
    } finally {
      if (activeQuestion.current === questionId) {
        setSubmitting(false)
        if (!accepted) {
          answerLock.current = false
          setHasAnswered(Date.now() >= deadline.current)
          setSelectedChoice(null)
          // Disabling the pressed answer drops keyboard focus. Give the
          // current question a stable place to retry after a failed request.
          if (document.activeElement === document.body || document.activeElement?.matches("button:disabled[aria-keyshortcuts]")) {
            questionHeading.current?.focus()
          }
        }
      }
    }
  }, [hasAnswered, question.id, timeLimit, onAnswer])

  const sortedPlayers = rankPlayers(players)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <PremiumBadge variant="primary" size="md">
            {t("questionNumber", { current: questionNumber, total: totalQuestions })}
          </PremiumBadge>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-tertiary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
            </svg>
            <span className={`font-bold text-lg ${timeRemaining <= 10 ? "text-error" : "text-on-surface"}`}>
              {timeRemaining}s
            </span>
          </div>
        </div>
        <PremiumBadge variant="warning" size="md">
          {t("liveBadge")}
        </PremiumBadge>
      </div>

      {/* Timer Bar */}
      <div className="mb-6">
        <PremiumProgress
          label={t("timeRemaining")}
          value={timeRemaining}
          max={timeLimit}
          size="md"
          variant={timeRemaining <= 10 ? "primary" : "secondary"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Question & Choices */}
        <div className="min-w-0 lg:col-span-2">
          <motion.div
            key={question.id}
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 mb-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            tabIndex={0}
            role="group"
            aria-label={t("battleKeyboardHint")}
            onKeyDown={(event) => {
              if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || !/^[1-4]$/.test(event.key)) return
              const index = Number(event.key) - 1
              if (index < question.choices.length) { event.preventDefault(); void handleAnswer(index) }
            }}
          >
            <h2 ref={questionHeading} tabIndex={-1} className="font-headline-md text-headline-md [overflow-wrap:anywhere] text-on-surface mb-6">
              {question.questionText}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {question.choices.map((choice, index) => {
                const isSelected = selectedChoice === index
                // We only know whether the SELECTED choice was correct (from
                // the server's graded result) - we deliberately never learn
                // which other option was correct, since that would leak the
                // answer key to the client. So only the chosen option gets a
                // correct/wrong treatment; unselected options just dim.
                const selectedWasCorrect = isSelected && hasAnswered && lastAnswerCorrect === true
                const selectedWasWrong = isSelected && hasAnswered && lastAnswerCorrect === false

                return (
                  <motion.button
                    key={index}
                    whileHover={!reduce && !hasAnswered ? { scale: 1.02 } : {}}
                    whileTap={!reduce && !hasAnswered ? { scale: 0.98 } : {}}
                    onClick={() => handleAnswer(index)}
                    disabled={hasAnswered || timeRemaining <= 0}
                    aria-pressed={isSelected}
                    aria-keyshortcuts={String(index + 1)}
                    className={`
                      min-w-0 p-4 rounded-xl border text-start transition-all
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                      ${selectedWasCorrect
                        ? "bg-success/20 border-success"
                        : selectedWasWrong
                        ? "bg-danger/20 border-danger"
                        : isSelected
                        ? "bg-primary/20 border-primary"
                        : "bg-surface-container-high border-white/5 hover:bg-surface-container-highest"
                      }
                      ${hasAnswered && !isSelected ? "opacity-50" : ""}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`
                          w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold
                          ${selectedWasCorrect
                            ? "bg-success text-white"
                            : selectedWasWrong
                            ? "bg-danger text-white"
                            : isSelected
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container-highest text-on-surface-variant"
                          }
                        `}
                      >
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className="min-w-0 [overflow-wrap:anywhere] text-on-surface">{choice}</span>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
          <p className="mb-3 text-xs text-on-surface-variant">{t("battleKeyboardHint")}</p>
          <div role="status" aria-atomic="true" className="mb-4 rounded-xl border border-white/10 bg-surface-container-high p-4">
            <h3 ref={answerFeedback} tabIndex={-1} className={`font-bold ${lastAnswerCorrect === true ? "text-tertiary" : "text-on-surface"}`}>
              {selectedChoice !== null ? lastAnswerCorrect === null ? t("checkingAnswer") : lastAnswerCorrect ? t("correct") : t("incorrect") : timeRemaining === 0 ? t("battleTimeUp") : t("battleChooseAnswer")}
            </h3>
            {answerPoints !== null && lastAnswerCorrect === true && <p className="mt-1 text-sm text-primary">{t("battleSpeedPoints", { count: answerPoints })}</p>}
            {!isHost && hasAnswered && !submitting && <p className="mt-1 text-sm text-on-surface-variant">{t("battleWaitingHost")}</p>}
          </div>

          {/* Next Question Button (Host Only) */}
          {isHost && hasAnswered && !submitting && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <PremiumButton variant="primary" fullWidth disabled={nextPending} aria-busy={nextPending} onClick={onNextQuestion}>
                {nextPending ? t("processingLabel") : questionNumber >= totalQuestions ? t("seeResultsButton") : t("nextQuestionButton")}
              </PremiumButton>
            </motion.div>
          )}
        </div>

        {/* Live Leaderboard */}
        <div>
          <PremiumCard className="p-4">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-3">
              {t("liveLeaderboard")}
            </h3>
            <div className="space-y-2">
              {sortedPlayers.map((player) => (
                <motion.div
                  key={player.id}
                  layout
                  className={`
                    flex items-center justify-between p-2 rounded-lg
                    ${player.id === currentUserId
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-surface-container-high"
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-6 text-center font-bold ${
                      player.rank === 1 ? "text-medal-gold" : player.rank === 2 ? "text-medal-silver" : player.rank === 3 ? "text-medal-bronze" : "text-on-surface-variant"
                    }`}>
                      {player.rank}
                    </span>
                    <span className="text-sm text-on-surface truncate max-w-[100px]">
                      {player.userName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {player.streak >= 3 && (
                      <span className="text-xs text-tertiary">🔥{player.streak}</span>
                    )}
                    <span className="font-bold text-primary text-sm">
                      {player.score}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  )
}
