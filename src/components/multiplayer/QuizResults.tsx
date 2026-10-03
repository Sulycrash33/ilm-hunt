"use client"

import { useEffect, useRef } from "react"
import { useGameReducedMotion } from "@/contexts/GameExperienceContext"

import { motion } from "framer-motion"
import { PremiumButton } from "@/components/ui/premium-button"
import { PremiumBadge } from "@/components/ui/premium-badge"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumAvatar } from "@/components/ui/premium-avatar"
import { useLanguage } from "@/contexts/LanguageContext"
import { rankPlayers } from "@/lib/multiplayer-experience"
import dynamic from "next/dynamic"

const Celebration = dynamic(() => import("@/components/game/Celebration").then(module => module.Celebration), { ssr: false })

interface Player {
  id: string
  userName: string
  /** The avatar chosen in onboarding, e.g. "m-3". `PremiumAvatar` draws
   * the art from it; there is no URL and never was. Until migration 0036
   * nothing wrote this at all, so every face in a room was the generic
   * silhouette. */
  avatarId?: string | null
  score: number
  correctAnswers: number
  totalAnswers: number
  streak: number
}

interface QuizResultsProps {
  pending?: boolean
  players: Player[]
  currentUserId: string
  onPlayAgain: () => void
  onLeave: () => void
  isHost?: boolean
}

export function QuizResults({ players, pending = false, currentUserId, onPlayAgain, onLeave, isHost = false }: QuizResultsProps) {
  const { t } = useLanguage()
  const reduce = useGameReducedMotion()
  const sortedPlayers = rankPlayers(players)
  const winner = sortedPlayers[0]
  const resultsHeading = useRef<HTMLHeadingElement>(null)
  const hasWinner = Boolean(winner)
  useEffect(() => { if (hasWinner) resultsHeading.current?.focus() }, [hasWinner])
  const leaders = sortedPlayers.filter(player => player.rank === 1)
  const currentUser = sortedPlayers.find((p) => p.id === currentUserId)
  const currentUserRank = currentUser?.rank ?? 0

  const getMedal = (rank: number) => {
    switch (rank) {
      case 1: return "🥇"
      case 2: return "🥈"
      case 3: return "🥉"
      default: return `#${rank}`
    }
  }

  if (!winner) return <PremiumCard className="p-6"><p>{t("loading")}</p><PremiumButton disabled={pending} onClick={onLeave}>{t("leaveRoom")}</PremiumButton></PremiumCard>

  return (
    <div className="max-w-2xl mx-auto">
      {currentUser?.rank === 1 && currentUser.score > 0 && <Celebration active pieces={100} />}
      {/* Winner Celebration */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center mb-8"
      >
        <motion.div
          animate={reduce ? undefined : { rotate: [0, -10, 10, 0] }}
          transition={{ duration: 0.5, repeat: 2 }}
          className="text-6xl mb-4"
        >
          🏆
        </motion.div>
        <h1 ref={resultsHeading} tabIndex={-1} className="font-display-lg-mobile text-display-lg-mobile text-primary mb-2">
          {t("quizComplete")}
        </h1>
        <p className="break-words text-on-surface-variant">
          {leaders.length > 1 ? t("battleSharedWin", { score: winner.score }) : t("winsWithMsg", { name: winner.userName, score: winner.score })}
        </p>
      </motion.div>

      {/* Podium */}
      {leaders.length > 1 ? <PremiumCard className="mb-8 p-5">
        <h2 className="mb-4 text-center font-bold text-primary">{t("battleJointLeaders")}</h2>
        <div className="grid grid-cols-2 gap-4">
          {leaders.map(player => <div key={player.id} className="min-w-0 text-center">
            <PremiumAvatar avatarId={player.avatarId} size="lg" />
            <p className="mt-2 break-all font-bold text-on-surface">{player.userName}</p>
            <p className="text-sm text-primary">{player.score} {t("score")}</p>
          </div>)}
        </div>
      </PremiumCard> : <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex justify-center items-end gap-2 sm:gap-4 mb-8"
      >
        {/* 2nd Place */}
        {sortedPlayers[1] && (
          <div className="min-w-0 flex-1 text-center">
            <PremiumAvatar avatarId={sortedPlayers[1].avatarId} size="lg" />
            <p className="break-all font-bold text-on-surface mt-2 text-sm">{sortedPlayers[1].userName}</p>
            <p className="text-xs text-on-surface-variant">{sortedPlayers[1].score} {t("score")}</p>
            <div className="w-20 h-20 bg-gradient-to-b from-medal-silver/20 to-transparent rounded-t-xl mt-2 flex items-center justify-center">
              <span className="text-3xl">{getMedal(sortedPlayers[1].rank)}</span>
            </div>
          </div>
        )}

        {/* 1st Place */}
        <div className="min-w-0 flex-1 text-center">
          <motion.div
            animate={reduce ? undefined : { y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <PremiumAvatar avatarId={winner.avatarId} size="xl" ring ringColor="primary" />
          </motion.div>
          <p className="break-all font-bold text-on-surface mt-2">{winner.userName}</p>
          <p className="text-sm text-primary font-bold">{winner.score} {t("score")}</p>
          <div className="w-24 h-28 bg-gradient-to-b from-warning/20 to-transparent rounded-t-xl mt-2 flex items-center justify-center">
            <span className="text-4xl">🥇</span>
          </div>
        </div>

        {/* 3rd Place */}
        {sortedPlayers[2] && (
          <div className="min-w-0 flex-1 text-center">
            <PremiumAvatar avatarId={sortedPlayers[2].avatarId} size="lg" />
            <p className="break-all font-bold text-on-surface mt-2 text-sm">{sortedPlayers[2].userName}</p>
            <p className="text-xs text-on-surface-variant">{sortedPlayers[2].score} {t("score")}</p>
            <div className="w-20 h-16 bg-gradient-to-b from-warning-container/20 to-transparent rounded-t-xl mt-2 flex items-center justify-center">
              <span className="text-3xl">{getMedal(sortedPlayers[2].rank)}</span>
            </div>
          </div>
        )}
      </motion.div>}

      {/* Full Leaderboard */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <PremiumCard className="p-6 mb-6">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-4">
            {t("finalRankingsTitle")}
          </h3>
          <div className="space-y-3">
            {sortedPlayers.map((player, index) => (
              <motion.div
                key={player.id}
                initial={reduce ? false : { opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.05 }}
                className={`
                  flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg
                  ${player.id === currentUserId
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-surface-container-high"
                  }
                `}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="text-2xl w-10 shrink-0 text-center">{getMedal(player.rank)}</span>
                  <PremiumAvatar avatarId={player.avatarId} size="sm" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-all font-bold text-on-surface">{player.userName}</span>
                      {player.id === currentUserId && (
                        <PremiumBadge variant="secondary" size="sm">{t("youBadge")}</PremiumBadge>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {player.correctAnswers}/{player.totalAnswers} {t("correctSuffix")}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-end">
                  <p className="font-bold text-primary">{player.score} {t("score")}</p>
                  {player.streak >= 3 && (
                    <p className="text-xs text-tertiary">🔥 {t("bestStreakLabel", { streak: player.streak })}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </PremiumCard>
      </motion.div>

      {/* Your Performance */}
      {currentUser && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <PremiumCard className="p-6 mb-6">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-4">
              {t("yourPerformanceTitle")}
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="font-bold text-3xl text-primary">{currentUserRank}</p>
                <p className="text-sm text-on-surface-variant">{t("rankWord")}</p>
              </div>
              <div>
                <p className="font-bold text-3xl text-tertiary">{currentUser.score}</p>
                <p className="text-sm text-on-surface-variant">{t("score")}</p>
              </div>
              <div>
                <p className="font-bold text-3xl text-secondary">
                  {currentUser.totalAnswers > 0
                    ? Math.round((currentUser.correctAnswers / currentUser.totalAnswers) * 100)
                    : 0}%
                </p>
                <p className="text-sm text-on-surface-variant">{t("accuracy")}</p>
              </div>
            </div>
          </PremiumCard>
        </motion.div>
      )}

      {/* Actions */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex flex-wrap sm:flex-nowrap gap-3"
      >
        <PremiumButton variant="secondary" fullWidth disabled={pending} onClick={onLeave}>
          {t("leaveRoom")}
        </PremiumButton>
        {isHost && <PremiumButton variant="primary" fullWidth disabled={pending} aria-busy={pending} onClick={onPlayAgain}>
          {pending ? t("processingLabel") : t("playAgain")}
        </PremiumButton>}
      </motion.div>
    </div>
  )
}
