"use client";

import { useGameReducedMotion as useReducedMotion } from "@/contexts/GameExperienceContext";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, CheckCircle2, Play } from "lucide-react";
import { motion as m } from "framer-motion";
import { Button } from "@/components/ui/button";
import { RANKS } from "@/lib/constants";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CategoryLevel } from "@/lib/quiz-service";

interface LevelPathProps {
  categorySlug: string;
  categoryName: string;
  categoryDescription: string | null;
  categoryIcon: string | null;
  levels: CategoryLevel[];
}

/**
 * The adventure path: one category's nine tiers, laid out as a winding trail
 * of locked/unlocked/completed nodes instead of the old single "start" button
 * that dropped straight into an adaptive, every-tier-blended run.
 *
 * Each node is one of the nine ranks (Mubtadi through Mujaddid) — the same
 * ladder a seeker climbs profile-wide, here scoped to one category. Finishing
 * a level (answering every published question in that tier correctly at
 * least once — see `getCategoryLevels`) is what unlocks the next node; a
 * locked node is not a link.
 *
 * ── Why this screen got louder ────────────────────────────────────────────
 * No human has ever answered a tier-2 question. Nine levels were drawn as
 * nine near-identical rows: the one the player should tap next looked the
 * same as the eight they could not, said nothing about how far through it
 * they were, and carried no verb. Three changes, all aimed at that one
 * number:
 *
 *  - **The category states its own progress**, so the climb has a top.
 *  - **The trail fills to where the player actually is**, rather than fading
 *    out on a fixed gradient that implied progress nobody had made.
 *  - **Exactly one node is the hero.** The first unlocked, unfinished level
 *    is bigger, breathes, carries a progress bar and says "Continue" or
 *    "Start". Everything else recedes. A path with nine equal choices is not
 *    a path, it is a list.
 */
export function LevelPath({
  categorySlug,
  categoryName,
  categoryDescription,
  categoryIcon,
  levels,
}: LevelPathProps) {
  const { t, dir } = useLanguage();
  const reduce = useReducedMotion();

  const clearedCount = levels.filter((l) => l.completed).length;
  const playableCount = levels.filter((l) => l.publishedCount > 0).length || levels.length;
  const categoryPct = playableCount === 0 ? 0 : (clearedCount / playableCount) * 100;

  /**
   * The one node that is the call to action: the first level that is unlocked,
   * has questions, and is not finished. There is deliberately at most one. A
   * screen that highlights three "you could do this" nodes highlights none.
   */
  const currentTier =
    levels.find((l) => l.unlocked && !l.completed && l.publishedCount > 0)?.tier ?? null;

  return (
    <div dir={dir} className="container mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/quiz">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("backToCategories")}
          </Link>
        </Button>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 space-y-2 text-center"
      >
        <div className="text-5xl" aria-hidden="true">
          {categoryIcon ?? "📚"}
        </div>
        <h1 className="font-headline text-3xl text-primary">{categoryName}</h1>
        {categoryDescription && (
          <p className="mx-auto max-w-prose text-on-surface-variant">{categoryDescription}</p>
        )}

        {/* The climb has a top, and the player can see where they are on it.
            Without this the nine rows were an undifferentiated list; a seeker
            three levels in had no way to feel three levels in. */}
        <div className="mx-auto max-w-xs space-y-1.5 pt-2">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={playableCount}
            aria-valuenow={clearedCount}
            aria-label={t("levelsCleared", { done: clearedCount, total: playableCount })}
          >
            <m.div
              className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${categoryPct}%` }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 22, delay: 0.15 }}
            />
          </div>
          <p className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
            {t("levelsCleared", { done: clearedCount, total: playableCount })}
          </p>
        </div>
      </motion.div>

      <ol className="relative space-y-4 pb-8">
        {/* The connecting trail. A simple vertical line is enough to read as
            a path without needing per-node offset math to stay legible on
            narrow screens. */}
        <div
          aria-hidden="true"
          className="absolute left-6 top-6 bottom-6 w-0.5 bg-surface-container-highest"
        />
        {/* The lit section of the trail, as tall as the progress made. The old
            line was a fixed gradient that faded out near the bottom on every
            screen, so a player who had cleared nothing saw the same trail as
            one who had cleared eight. */}
        <m.div
          aria-hidden="true"
          className="absolute left-6 top-6 w-0.5 origin-top bg-gradient-to-b from-primary to-primary/40"
          style={{ bottom: "1.5rem" }}
          initial={reduce ? false : { scaleY: 0 }}
          animate={{ scaleY: playableCount === 0 ? 0 : clearedCount / playableCount }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 110, damping: 24, delay: 0.2 }}
        />

        {levels.map((level, index) => {
          const rank = RANKS[index] ?? RANKS[RANKS.length - 1];
          const Icon = rank.icon;
          const state: "locked" | "unlocked" | "completed" = level.completed
            ? "completed"
            : level.unlocked
              ? "unlocked"
              : "locked";
          const isCurrent = level.tier === currentTier;
          const pct =
            level.publishedCount === 0
              ? 0
              : (level.correctCount / level.publishedCount) * 100;

          const node = (
            <div
              className={`flex items-center gap-4 rounded-xl border transition-colors ${
                isCurrent ? "border-2 border-primary bg-primary/10 p-5" : "p-4"
              } ${
                state === "locked"
                  ? "border-white/5 bg-surface-container/60 opacity-60"
                  : state === "completed"
                    ? "border-primary/30 bg-primary/10"
                    : isCurrent
                      ? ""
                      : "border-white/10 bg-surface-container hover:bg-surface-container-high"
              } ${isCurrent && !reduce ? "animate-pulse-slow" : ""}`}
            >
              <div
                className={`relative z-10 flex shrink-0 items-center justify-center rounded-full border-2 ${
                  isCurrent ? "h-14 w-14" : "h-12 w-12"
                } ${
                  state === "locked"
                    ? "border-white/10 bg-surface-container-high text-on-surface-variant"
                    : state === "completed"
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-primary/60 bg-primary/10 text-primary"
                }`}
              >
                {state === "locked" ? (
                  <Lock className="h-5 w-5" aria-hidden="true" />
                ) : state === "completed" ? (
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <Icon className="h-6 w-6" aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0 flex-1 text-left">
                <p className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                  {t("levelLabel")} {level.tier}
                </p>
                <p className="truncate font-semibold text-on-surface">{rank.title}</p>
                {state === "locked" ? (
                  <p className="text-xs text-on-surface-variant">{t("completeLevelToUnlock")}</p>
                ) : level.publishedCount > 0 ? (
                  <>
                    <p className="text-xs text-on-surface-variant">
                      {t("continueAnswered", {
                        answered: level.correctCount,
                        total: level.publishedCount,
                      })}
                    </p>
                    {/* A bar only where it says something: a finished level is
                        already marked by its tick, and an untouched one has
                        nothing to report. */}
                    {!level.completed && level.correctCount > 0 && (
                      <div
                        className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-container-highest"
                        aria-hidden="true"
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-on-surface-variant">{t("comingSoon")}</p>
                )}
              </div>

              {isCurrent ? (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-label-caps text-label-caps uppercase tracking-widest text-on-primary">
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  {level.correctCount > 0 ? t("continue") : t("startQuiz")}
                </span>
              ) : (
                state !== "locked" &&
                level.publishedCount > 0 && (
                  <Play
                    className={`h-5 w-5 shrink-0 ${state === "completed" ? "text-primary" : "text-on-surface-variant"}`}
                    aria-hidden="true"
                  />
                )
              )}
            </div>
          );

          return (
            <motion.li
              key={level.tier}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative"
            >
              {state === "locked" || level.publishedCount === 0 ? (
                <div aria-disabled="true">{node}</div>
              ) : (
                <Link href={`/quiz/${categorySlug}/${level.tier}`}>{node}</Link>
              )}
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
