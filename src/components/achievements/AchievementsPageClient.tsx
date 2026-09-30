"use client"

import { useGameReducedMotion } from "@/contexts/GameExperienceContext"

import { PageHeader } from "@/components/layout/PageHeader"
import { Trophy, Zap, CalendarDays } from "lucide-react"

import { motion } from "framer-motion"
import Link from "next/link"
import { useState } from "react"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumButton } from "@/components/ui/premium-button"
import { PremiumBadge } from "@/components/ui/premium-badge"
import { AchievementBadge } from "@/components/achievements/AchievementBadge"
import { TrophyCard } from "@/components/achievements/TrophyCard"
import { RARITY_POINTS, isMilestone } from "@/lib/achievement-rarity"
import { PremiumProgress } from "@/components/ui/premium-progress"
import { useLanguage } from "@/contexts/LanguageContext"
import type { AchievementView } from "@/lib/profile-stats"
import { EarnedChestShelf } from "@/components/achievements/EarnedChestShelf"
import type { EarnedChest } from "@/app/(app)/rewards/actions"

type Tab = "achievements" | "challenges"

interface TodayChallenge {
  categoryName: string
  questionCount: number
  rewardCoins: number
  rewardXp: number
  completed: boolean
}

export function AchievementsPageClient({
  achievements,
  todayChallenge,
  earnedChests,
}: {
  achievements: AchievementView[]
  todayChallenge: TodayChallenge | null
  /** Chests earned and not yet opened. They live here, with the other things
   *  that had to be earned, and deliberately not on `/rewards` where every
   *  other panel is something you get for showing up. See migration 0061. */
  earnedChests: EarnedChest[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>("achievements")
  const { t, dir } = useLanguage()
  const reduce = useGameReducedMotion()

  const unlockedCount = achievements.filter((a) => a.unlocked).length

  /**
   * The gallery in three bands, which is what the flat grid was missing: it
   * drew a legendary rank achievement and "answer one question" at identical
   * size and weight, so nothing on the screen said what was worth chasing.
   *
   * Milestones are the epic and legendary tiers only, three of the thirteen
   * live achievements. Keeping the rail that short is the point.
   */
  const milestones = achievements.filter((a) => isMilestone(a.rarity))
  const badges = achievements.filter((a) => !isMilestone(a.rarity))

  /** Earned points only, so the number moves when the player does something. */
  const points = achievements
    .filter((a) => a.unlocked)
    .reduce((sum, a) => sum + RARITY_POINTS[a.rarity], 0)

  return (
    <div dir={dir} className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
      <PageHeader title={t("achievementsAndChallenges")} subtitle={t("trackProgress")} icon={Trophy} />

      <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6 mb-8">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="font-bold text-3xl text-primary">{unlockedCount}/{achievements.length}</p>
            <p className="font-label-caps text-label-caps text-on-surface-variant">{t("unlockedLabel")}</p>
          </div>
          <div>
            {/* Weighted by rarity, so finishing something hard moves it more
                than finishing something easy. A flat count of unlocks is
                already the number to its left. */}
            <p className="font-bold text-3xl text-warning tabular-nums">{points}</p>
            <p className="font-label-caps text-label-caps text-on-surface-variant">{t("achievementPoints")}</p>
          </div>
        </div>
        <div className="mt-4">
          <PremiumProgress value={unlockedCount} max={Math.max(achievements.length, 1)} showLabel label={t("overallProgress")} />
        </div>
      </motion.div>

      <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(["achievements", "challenges"] as Tab[]).map((tab) => (
          <button
            key={tab}
            aria-pressed={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 min-h-11 shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
              activeTab === tab ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            {tab === "achievements" ? <Trophy aria-hidden="true" className="h-4 w-4" /> : <Zap aria-hidden="true" className="h-4 w-4" />}
            {tab === "achievements" ? t("achievements") : t("challenges")}
          </button>
        ))}
      </motion.div>

      {activeTab === "achievements" ? (
        <>
        {/* The chests, above the trophies, because an unopened one is the only
            thing on this page that asks the player to do something. */}
        <EarnedChestShelf chests={earnedChests} />
        {achievements.length === 0 ? (
          <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 text-center">
            <p className="text-on-surface-variant">{t("noAchievementsYet")}</p>
          </motion.div>
        ) : (
          <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-10">
            {milestones.length > 0 && (
              <section className="space-y-4">
                <h2 className="font-headline-md text-headline-md text-on-surface">{t("milestoneTrophies")}</h2>
                {/* A rail rather than a grid: these are meant to be looked
                    through one at a time, and on a phone a grid of three of
                    these would shrink each below the size that makes it feel
                    like a trophy. `snap-x` keeps them landing squarely. */}
                <div className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-4">
                  {milestones.map((a) => (
                    <TrophyCard key={a.slug} achievement={a} />
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-4">
              <h2 className="font-headline-md text-headline-md text-on-surface">{t("collectionBadges")}</h2>
              <div className="grid grid-cols-2 min-[380px]:grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-6">
                {badges.map((a) => (
                  <AchievementBadge key={a.slug} achievement={a} />
                ))}
              </div>
            </section>
          </motion.div>
        )}
        </>
      ) : (
        <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          {!todayChallenge ? (
            <div className="glass-card p-8 text-center">
              <p className="text-on-surface-variant">{t("noDailyChallengeToday")}</p>
            </div>
          ) : (
            <PremiumCard className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-tertiary/20 to-tertiary-container/20 flex items-center justify-center">
                    <CalendarDays aria-hidden="true" className="h-8 w-8 text-tertiary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-on-surface text-lg">{t("todaysChallenge")}</h3>
                    <p className="text-on-surface-variant">{todayChallenge.questionCount} {t("questions").toLowerCase()} · {todayChallenge.categoryName}</p>
                  </div>
                </div>
                {todayChallenge.completed && <PremiumBadge variant="success" size="sm">{t("completedLabel")}</PremiumBadge>}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-tertiary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.85c0 1.89-1.44 2.98-3.12 3.19z" />
                  </svg>
                  <span className="font-bold text-tertiary">+{todayChallenge.rewardCoins} {t("coinsWord").toLowerCase()}, +{todayChallenge.rewardXp} {t("barakahShort")}</span>
                </div>
                {!todayChallenge.completed && (
                  <PremiumButton href="/play/daily" variant="primary" size="sm">{t("startChallenge")}</PremiumButton>
                )}
              </div>
            </PremiumCard>
          )}
        </motion.div>
      )}
    </div>
  )
}
