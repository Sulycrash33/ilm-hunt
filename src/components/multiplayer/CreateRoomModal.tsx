"use client"

import { PremiumModal } from "@/components/ui/premium-modal"
import { useState } from "react"
import { PremiumButton } from "@/components/ui/premium-button"
import { PremiumBadge } from "@/components/ui/premium-badge"
import { PremiumCard } from "@/components/ui/premium-card"
import { useLanguage } from "@/contexts/LanguageContext"

interface CreateRoomModalProps {
  error?: string | null
  isOpen: boolean
  onClose: () => void
  onCreateRoom: (config: {
    difficulty: "easy" | "medium" | "hard"
    maxPlayers: number
    questionCount: number
  }) => (Promise<void>)
}

export function CreateRoomModal({ isOpen, onClose, onCreateRoom, error }: CreateRoomModalProps) {
  const { t } = useLanguage()
  const difficultyLabels: Record<"easy" | "medium" | "hard", string> = { easy: t("easy"), medium: t("medium"), hard: t("hard") }
  const [pending, setPending] = useState(false)
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium")
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [questionCount, setQuestionCount] = useState(10)

  return (
    <PremiumModal isOpen={isOpen} onClose={() => { if (!pending) onClose() }} title={t("createQuizRoomTitle")} size="md">
        {/* No subject to pick.

            A battle used to ask the host to choose a category, which is the
            opposite of what it is for: the questions should arrive
            unannounced, out of a bank the categories never teach. Difficulty
            stays, because that is the one dial that decides whether the match
            is winnable — and both players face the identical set either way,
            seeded once into `quiz_room_questions` when the host starts.

            Anyone who wants to study a particular subject has the categories,
            which are untouched. */}

        {/* Difficulty */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-on-surface mb-2">{t("difficultyLabel")}</label>
          <div className="grid grid-cols-3 gap-2">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <button
                key={d}
                disabled={pending}
                aria-pressed={difficulty === d}
                onClick={() => setDifficulty(d)}
                className={`min-h-11 p-2 rounded-xl border text-center capitalize transition-all ${
                  difficulty === d
                    ? d === "easy"
                      ? "bg-success/20 border-success text-success"
                      : d === "medium"
                      ? "bg-warning/20 border-warning text-warning"
                      : "bg-danger/20 border-danger text-danger"
                    : "bg-surface-container-high border-white/5 text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                {difficultyLabels[d]}
              </button>
            ))}
          </div>
        </div>

        {/* Max Players */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-on-surface mb-2">{t("maxPlayersLabel")}</label>
          <div className="flex gap-2">
            {[2, 4, 6, 8].map((num) => (
              <button
                key={num}
                disabled={pending}
                aria-pressed={maxPlayers === num}
                onClick={() => setMaxPlayers(num)}
                className={`flex-1 min-h-11 p-2 rounded-xl border text-center transition-all ${
                  maxPlayers === num
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-surface-container-high border-white/5 text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Question Count */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-on-surface mb-2">{t("questions")}</label>
          <div className="flex gap-2">
            {[5, 10, 15, 20].map((num) => (
              <button
                key={num}
                disabled={pending}
                aria-pressed={questionCount === num}
                onClick={() => setQuestionCount(num)}
                className={`flex-1 min-h-11 p-2 rounded-xl border text-center transition-all ${
                  questionCount === num
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-surface-container-high border-white/5 text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="mb-4 rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</p>}
        {/* Actions */}
        <div className="flex gap-3">
          <PremiumButton variant="secondary" fullWidth disabled={pending} onClick={onClose}>
            {t("cancel")}
          </PremiumButton>
          <PremiumButton
            variant="primary"
            fullWidth
            disabled={pending}
            onClick={async () => { if (pending) return; setPending(true); try { await onCreateRoom({ difficulty, maxPlayers, questionCount }) } finally { setPending(false) } }}
          >
            {pending ? t("creatingLabel") : t("createRoom")}
          </PremiumButton>
        </div>
    </PremiumModal>
  )
}
