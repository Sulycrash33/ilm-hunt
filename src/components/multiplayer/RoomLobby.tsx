"use client"

import { useGameReducedMotion } from "@/contexts/GameExperienceContext"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { motion } from "framer-motion"
import { PremiumButton } from "@/components/ui/premium-button"
import { PremiumBadge } from "@/components/ui/premium-badge"
import { PremiumAvatar } from "@/components/ui/premium-avatar"
import { PremiumCard } from "@/components/ui/premium-card"
import { useLanguage } from "@/contexts/LanguageContext"

interface Player {
  id: string
  userName: string
  /** The avatar chosen in onboarding, e.g. "m-3". `PremiumAvatar` draws
   * the art from it; there is no URL and never was. Until migration 0036
   * nothing wrote this at all, so every face in a room was the generic
   * silhouette. */
  avatarId?: string | null
  isHost: boolean
  isReady: boolean
  score: number
}

interface RoomLobbyProps {
  pending?: boolean
  roomCode: string
  players: Player[]
  currentUserId: string
  isHost: boolean
  onStart: () => void
  onLeave: () => void
  onToggleReady: () => void
  isReady: boolean
}

export function RoomLobby({
  roomCode,
  pending = false,
  players,
  currentUserId,
  isHost,
  onStart,
  onLeave,
  onToggleReady,
  isReady,
}: RoomLobbyProps) {
  const { t } = useLanguage()
  const reduce = useGameReducedMotion()
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(null)
  const allReady = players.every((p) => p.isReady || p.isHost)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Room Code */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <p className="text-on-surface-variant mb-2">{t("roomCode")}</p>
        <div className="inline-flex items-center gap-3 bg-surface-container-high px-6 py-3 rounded-xl border border-white/10">
          <span className="font-mono text-3xl font-bold text-primary tracking-widest">
            {roomCode}
          </span>
          <button
            aria-label={t("copyRoomCode")}
            onClick={async () => { try { await navigator.clipboard.writeText(roomCode); setCopyStatus("copied") } catch { setCopyStatus("failed") } }}
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/10 transition-colors"
          >
            {copyStatus === "copied" ? <Check aria-hidden="true" className="h-5 w-5 text-tertiary" /> : <Copy aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
        <p className="text-sm text-on-surface-variant mt-2">
          {t("shareCode")}
        </p>
      </motion.div>

      <p role="status" className="mb-4 text-center text-sm text-tertiary">{copyStatus === "copied" ? t("roomCodeCopied") : copyStatus === "failed" ? t("shareFailed") : ""}</p>
      {/* Players */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <PremiumCard className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline-md text-headline-md text-on-surface">
              {t("players")} ({players.length})
            </h3>
            <PremiumBadge variant="primary" size="sm">
              {t("waitingBadge")}
            </PremiumBadge>
          </div>
          <div className="space-y-3">
            {players.map((player, index) => (
              <motion.div
                key={player.id}
                initial={reduce ? false : { opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  player.id === currentUserId
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-surface-container-high"
                }`}
              >
                <div className="flex items-center gap-3">
                  <PremiumAvatar avatarId={player.avatarId} size="sm" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold break-all text-on-surface">{player.userName}</span>
                      {player.isHost && (
                        <PremiumBadge variant="warning" size="sm">{t("hostBadge")}</PremiumBadge>
                      )}
                      {player.id === currentUserId && (
                        <PremiumBadge variant="secondary" size="sm">{t("youBadge")}</PremiumBadge>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  {player.isReady || player.isHost ? (
                    <PremiumBadge variant="success" size="sm">{t("readyBadge")}</PremiumBadge>
                  ) : (
                    <PremiumBadge variant="secondary" size="sm">{t("notReadyBadge")}</PremiumBadge>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </PremiumCard>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap sm:flex-nowrap gap-3"
      >
        <PremiumButton variant="secondary" fullWidth disabled={pending} onClick={onLeave}>
          {t("leaveRoom")}
        </PremiumButton>
        {!isHost && (
          <PremiumButton
            variant={isReady ? "secondary" : "primary"}
            fullWidth
            disabled={pending}
            aria-busy={pending}
            onClick={onToggleReady}
          >
            {isReady ? t("notReady") : t("readyUp")}
          </PremiumButton>
        )}
        {isHost && (
          <PremiumButton
            variant="primary"
            fullWidth
            onClick={onStart}
            aria-busy={pending}
            disabled={pending || !allReady || players.length < 2}
          >
            {pending ? t("processingLabel") : players.length < 2 ? t("needPlayers") : t("startQuizButton")}
          </PremiumButton>
        )}
      </motion.div>
    </div>
  )
}
