"use client"

import { useGameReducedMotion as useReducedMotion } from "@/contexts/GameExperienceContext";

import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext"
import type { CategoryStat } from "@/lib/profile-stats"

/**
 * Where a seeker's knowledge sits, category by category.
 *
 * This is the "Category Performance" card, extracted and given the ordering the
 * Stitch design implies. The data was always drawn, contrary to a first reading
 * of this page: `categories` already fed two cards, one showing volume on the
 * overview tab and this one showing accuracy on statistics. So this replaces
 * the inline block rather than becoming a third rendering of the same numbers,
 * which is exactly the duplication this project has been clearing out.
 *
 * What it adds over the inline version it replaces:
 *
 *  - **Sorted by mastery**, so the list says something at a glance rather than
 *    arriving in whatever order the query returned.
 *  - **Capped**, because a seeker with twenty categories in play wants to know
 *    where they are strong, not to scroll a wall of bars. The weakest is kept
 *    on screen underneath regardless, because that is the one worth acting on.
 *
 * Percentages are correct answers over questions *attempted* in that category,
 * which is the only mastery figure available here: the count of published
 * questions per category is not part of `CategoryStat`, and inventing a
 * denominator would put a confident wrong number on the page.
 */
export function KnowledgeBreakdown({ stats }: { stats: CategoryStat[] }) {
  const { t } = useLanguage()
  const reduce = useReducedMotion()

  const played = stats.filter((c) => c.attempted > 0)
  if (played.length === 0) return null

  const scored = played
    .map((c) => ({ ...c, pct: Math.round((c.correct / c.attempted) * 100) }))
    .sort((a, b) => b.pct - a.pct)

  // Top five, plus the weakest if it is not already among them.
  const top = scored.slice(0, 5)
  const weakest = scored[scored.length - 1]
  const rows = top.some((c) => c.categoryId === weakest.categoryId) ? top : [...top, weakest]

  return (
    <section className="glass-card rounded-2xl p-6">
      <h3 className="mb-5 font-headline-md text-headline-md text-on-surface">
        {t("knowledgeBreakdown")}
      </h3>

      <div className="space-y-5">
        {rows.map((c, i) => (
          <div key={c.categoryId} className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <span className="min-w-0 truncate font-semibold text-on-surface">{c.name}</span>
              <span className="shrink-0 text-sm font-bold tabular-nums text-primary">{c.pct}%</span>
            </div>

            <div
              className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={c.pct}
              aria-label={c.name}
            >
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${c.pct}%` }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 120, damping: 24, delay: 0.05 * i }
                }
              />
            </div>

            <p className="text-xs tabular-nums text-on-surface-variant">
              {t("continueAnswered", { answered: c.correct, total: c.attempted })}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
