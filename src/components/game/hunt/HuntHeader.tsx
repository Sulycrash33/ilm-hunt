"use client";

import { Heart, Coins, Flame } from "lucide-react";
import { useGameReducedMotion } from "@/contexts/GameExperienceContext";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { comboMultiplier, HUNT_RULES, type Difficulty } from "@/lib/hunt-engine";
import { TimerRing } from "./TimerRing";

interface HuntHeaderProps {
  stage: number;
  totalStages: number;
  lives: number;
  coins: number;
  combo: number;
  tier: Difficulty;
  remaining: number;
  timeLimit: number;
  frozen: boolean;
  /**
   * What the clock is counting.
   *
   * "question" is the classic per-question countdown. "run" is Speed Round's
   * single clock for the whole run. "none" is Practice, which has no clock at
   * all — and showing a ring stopped at 25 was worse than showing nothing,
   * because a frozen countdown reads as a bug rather than as an absence.
   */
  clock?: "question" | "run" | "none";
  /**
   * How many hearts to draw, or null in a mode with no lives. It was hardcoded
   * to three, which drew three hearts for Practice and Speed Round — modes a
   * wrong answer cannot end.
   */
  maxLives?: number | null;
}

const TIER_STYLE: Record<Difficulty, string> = {
  Beginner: "border-primary/40 text-primary",
  Intermediate: "border-secondary/40 text-secondary",
  Advanced: "border-tertiary/40 text-tertiary",
};

/**
 * Everything the player needs mid-question without looking away from it:
 * how far into the run they are, what's left of the clock, and what a miss
 * would cost. Lives are drawn as discrete hearts rather than a number because
 * the count is small and losing one should be legible instantly.
 */
export function HuntHeader({
  stage,
  totalStages,
  lives,
  coins,
  combo,
  tier,
  remaining,
  timeLimit,
  frozen,
  clock = "question",
  maxLives = HUNT_RULES.startingLives,
}: HuntHeaderProps) {
  const { t } = useLanguage();
  const reduce = useGameReducedMotion();
  const multiplier = comboMultiplier(combo);
  const progress = totalStages === 0 ? 0 : (stage / totalStages) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-label-caps uppercase tracking-wider text-on-surface-variant">
            {t("progress")}
          </p>
          <p className="truncate text-headline-md text-primary">
            {t("huntStage", { current: Math.min(stage + 1, totalStages), total: totalStages })}
          </p>
          <span
            className={cn(
              "inline-block rounded-full border px-2 py-0.5 text-label-caps uppercase tracking-wider",
              TIER_STYLE[tier],
            )}
          >
            {t(tier === "Beginner" ? "difficultyBeginner" : tier === "Intermediate" ? "difficultyIntermediate" : "difficultyAdvanced")}
          </span>
        </div>

        {clock !== "none" && (
          <TimerRing remaining={remaining} total={timeLimit} frozen={frozen} />
        )}
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest"
        role="progressbar"
        aria-label={t("progress")}
        aria-valuemin={0}
        aria-valuemax={totalStages}
        aria-valuenow={stage}
      >
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 180, damping: 24 }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {maxLives !== null && (
          <span className="flex items-center gap-1.5" aria-label={`${lives} ${t("livesLabel")}`}>
            {Array.from({ length: maxLives }).map((_, i) => (
              <Heart
                key={i}
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 transition-colors",
                  i < lives ? "fill-error text-error" : "text-surface-container-highest",
                )}
              />
            ))}
          </span>
        )}

        {/* Gold, matching the coin counter in the home header. Coins were
            `tertiary` mint here and `primary-fixed` gold there, so the same
            currency changed colour depending on which screen you were on. */}
        <span className="flex items-center gap-1.5 text-primary-fixed">
          <Coins className="h-4 w-4" aria-hidden="true" />
          <span className="tabular-nums font-semibold">{coins}</span>
          <span className="sr-only">{t("coinsWord")}</span>
        </span>

        {/* The combo escalates instead of holding still.
            It used to read the same at a run of two and a run of eight: same
            size, same flame, same glow. A streak that is building should look
            like it is building, so each new answer punches the badge and the
            heat behind the flame rises with the multiplier — capped, so a long
            run stays readable rather than turning into a lamp. */}
        {combo > 0 && (
          <motion.span
            key={combo}
            initial={reduce ? false : { scale: 0.8, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { scale: [0.8, 1.18, 1], opacity: 1 }}
            transition={{ duration: 0.34, ease: "easeOut" }}
            /* Heat, and only heat.
               The flame was `tertiary` mint at multiplier 2 and above while its
               halo was hardcoded orange, so a building combo drew a green flame
               giving off orange light. It runs the warm ramp now, gold into the
               `warning` orange, and the glow is `currentColor` so the halo can
               never disagree with the flame again. */
            className={cn(
              "flex items-center gap-1.5 font-semibold",
              multiplier > 1 ? "text-warning" : "text-primary",
            )}
            style={{
              filter: `drop-shadow(0 0 ${Math.min(4 + combo * 1.6, 14)}px currentColor)`,
            }}
          >
            <Flame
              className="h-4 w-4"
              style={{ transform: `scale(${Math.min(1 + combo * 0.05, 1.35)})` }}
              aria-hidden="true"
            />
            {multiplier > 1 ? t("comboX", { multiplier }) : `${combo} ${t("comboLabel")}`}
          </motion.span>
        )}
      </div>
    </div>
  );
}
