"use client"

import { useGameReducedMotion as useReducedMotion } from "@/contexts/GameExperienceContext";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils"
import { RARITY_STYLES } from "@/lib/design-tokens"
import { useLanguage } from "@/contexts/LanguageContext"
import type { AchievementView } from "@/lib/profile-stats"

/**
 * A milestone achievement, given room.
 *
 * Only the epic and legendary tiers reach this rail. That is the point: three
 * of thirteen, so the rail stays a highlight rather than a second copy of the
 * grid below it. Which three is decided by `achievementRarity`, scored from the
 * same criteria the database awards on.
 *
 * The Stitch design put a rendered 3D trophy image on each of these. Those were
 * generated placeholders on URLs that will rot, and the achievements already
 * carry their own emoji in the database, so the real icon is drawn large
 * instead. It is the actual data, it costs no request, and it cannot 404.
 */
export function TrophyCard({ achievement }: { achievement: AchievementView }) {
  const { t } = useLanguage()
  const reduce = useReducedMotion()
  const style = RARITY_STYLES[achievement.rarity]
  const unlocked = achievement.unlocked
  const pct =
    achievement.target === 0
      ? 0
      : Math.min((achievement.progress / achievement.target) * 100, 100)

  return (
    <motion.article
      whileTap={reduce ? undefined : { scale: 0.97 }}
      className={cn(
        "relative flex w-[17rem] shrink-0 snap-center flex-col items-center overflow-hidden rounded-2xl border p-6 glass-card",
        unlocked ? style.border : "border-white/5",
      )}
    >
      {/* The bloom behind an earned trophy, in its own rarity colour. Absent
          when locked, so the rail reads at a glance as what has been won. */}
      {unlocked && (
        <div
          className={cn(
            "pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-3xl",
            style.plate,
          )}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          "relative mb-4 flex h-24 w-24 items-center justify-center rounded-2xl",
          unlocked ? style.bg : "bg-surface-container-highest",
          !unlocked && "opacity-50 grayscale",
        )}
      >
        <span className="text-5xl" aria-hidden="true">
          {achievement.icon}
        </span>
      </div>

      <span
        className={cn(
          "mb-1 font-label-caps text-label-caps uppercase tracking-widest",
          unlocked ? style.text : "text-on-surface-variant",
        )}
      >
        {t(achievement.rarity === "legendary" ? "rarityLegendary" : "rarityEpic")}
      </span>

      <h3 className="mb-1 text-center font-headline-md text-headline-md text-on-surface">
        {achievement.name}
      </h3>
      <p className="text-center text-sm text-on-surface-variant">{achievement.description}</p>

      <div
        className="mt-5 h-2 w-full overflow-hidden rounded-full bg-surface-container-highest"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={achievement.target}
        aria-valuenow={achievement.progress}
        aria-label={achievement.name}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-700", unlocked ? "bg-primary" : "bg-outline")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="mt-1.5 self-end text-xs tabular-nums text-on-surface-variant">
        {achievement.progress} / {achievement.target}
      </span>
    </motion.article>
  )
}
