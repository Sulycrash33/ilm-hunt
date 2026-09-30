"use client"

import { useGameReducedMotion as useReducedMotion } from "@/contexts/GameExperienceContext";

import { Lock } from "lucide-react"
import { motion } from "framer-motion";
import { cn } from "@/lib/utils"
import { RARITY_STYLES, type AchievementRarity } from "@/lib/design-tokens"
import { useLanguage } from "@/contexts/LanguageContext"
import type { AchievementView } from "@/lib/profile-stats"

const RARITY_LABEL = {
  common: "rarityCommon",
  uncommon: "rarityUncommon",
  rare: "rarityRare",
  epic: "rarityEpic",
  legendary: "rarityLegendary",
} as const satisfies Record<AchievementRarity, string>

/**
 * One achievement as a hexagonal plate.
 *
 * The gallery used to draw all thirteen as identical cards in a flat grid, so
 * a legendary rank achievement and "answer one question" were the same size,
 * the same colour and the same weight. Rarity now does the work it was always
 * meant to: `RARITY_STYLES` has existed in `design-tokens.ts` since early on
 * with five tiers and, until now, no consumer anywhere in the app.
 *
 * A locked badge keeps its name and its shape and loses its colour. It is not
 * blurred or hidden: knowing what is out there is the thing that makes someone
 * go and get it, and the app has no secret achievements to hide.
 */
export function AchievementBadge({ achievement }: { achievement: AchievementView }) {
  const { t } = useLanguage()
  const reduce = useReducedMotion()
  const style = RARITY_STYLES[achievement.rarity]
  const unlocked = achievement.unlocked
  const pct =
    achievement.target === 0
      ? 0
      : Math.min((achievement.progress / achievement.target) * 100, 100)

  return (
    <motion.div
      className="flex flex-col items-center gap-1.5"
      whileTap={reduce ? undefined : { scale: 0.94 }}
      // The whole plate is one labelled unit: a screen reader gets the name,
      // its rarity and whether it is earned, rather than an emoji and a
      // decorative hexagon.
      role="group"
      aria-label={`${achievement.name}. ${t(RARITY_LABEL[achievement.rarity])}. ${
        unlocked ? t("unlockedLabel") : `${achievement.progress} / ${achievement.target}`
      }`}
    >
      <div
        className={cn(
          "hexagon flex h-24 w-20 items-center justify-center p-0.5 transition-colors",
          unlocked ? style.plate : "bg-surface-container-highest",
        )}
      >
        <div
          className={cn(
            "hexagon flex h-full w-full items-center justify-center bg-surface-container",
            !unlocked && "opacity-60",
          )}
        >
          {unlocked ? (
            <span className="text-3xl" aria-hidden="true">
              {achievement.icon}
            </span>
          ) : (
            <Lock className="h-6 w-6 text-on-surface-variant" aria-hidden="true" />
          )}
        </div>
      </div>

      <span
        className={cn(
          "font-label-caps text-label-caps uppercase tracking-widest",
          unlocked ? style.text : "text-on-surface-variant",
        )}
      >
        {t(RARITY_LABEL[achievement.rarity])}
      </span>

      <span
        className={cn(
          "max-w-[7rem] text-center text-xs font-bold leading-tight",
          unlocked ? "text-on-surface" : "text-on-surface-variant",
        )}
      >
        {achievement.name}
      </span>

      {/* Only where it says something. A finished badge is already coloured,
          and one nobody has started has nothing to report. */}
      {!unlocked && achievement.progress > 0 && (
        <div
          className="h-1 w-14 overflow-hidden rounded-full bg-surface-container-highest"
          aria-hidden="true"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      )}
    </motion.div>
  )
}
