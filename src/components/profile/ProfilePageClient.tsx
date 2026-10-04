"use client"

import { useGameReducedMotion } from "@/contexts/GameExperienceContext"

import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { PageHeader } from "@/components/layout/PageHeader"
import { EmptyState } from "@/components/ui/empty-state"
import { EffectsToggle } from "@/components/profile/EffectsToggle"
import { LayoutDashboard, Trophy, ChartNoAxesColumn, History, UserRound, CalendarDays } from "lucide-react"
import { useState } from "react"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumButton } from "@/components/ui/premium-button"
import { PremiumBadge } from "@/components/ui/premium-badge"
import { PremiumAvatar } from "@/components/ui/premium-avatar"
import { CountUp } from "@/components/ui/count-up"
import { PremiumProgress } from "@/components/ui/premium-progress"
import { PremiumStat } from "@/components/ui/premium-stat"
import { AchievementCard } from "@/components/game/AchievementCard"
import { LogoutButton } from "@/components/layout/LogoutButton"
import { ResetProgressCard } from "@/components/profile/ResetProgressCard"
import { GameMasterCard } from "@/components/profile/GameMasterCard"
import { SoundToggle } from "@/components/profile/SoundToggle"
import { HapticsToggle } from "@/components/profile/HapticsToggle"
import { VolumeSlider } from "@/components/profile/VolumeSlider"
import { KnowledgeBreakdown } from "@/components/profile/KnowledgeBreakdown"
import { StreakReminderToggle } from "@/components/profile/StreakReminderToggle"
import { emblemForRank } from "@/components/icons/RankEmblems"
import { useLanguage } from "@/contexts/LanguageContext"
import type { Locale, Translations } from "@/lib/i18n"
import type { ProfileStats } from "@/lib/profile-stats"

type Tab = "overview" | "achievements" | "statistics" | "activity"

const LANGUAGE_OPTIONS: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ha", label: "Hausa" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "id", label: "Bahasa Indonesia" },
]

/** Relative time, localised. Takes `t` because it is a plain function, not a
 * component, so it cannot reach the language context on its own. */
function timeAgo(iso: string, t: (k: keyof Translations, p?: Record<string, string | number>) => string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return t("justNow")
  if (minutes < 60) return t("minutesAgoShort", { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t("hoursAgoShort", { n: hours })
  const days = Math.floor(hours / 24)
  return t("daysAgoShort", { n: days })
}

export function ProfilePageClient({
  stats,
  email,
  joinedAt,
  isAdmin = false,
}: {
  stats: ProfileStats
  email: string | null
  joinedAt: string
  /** Decides whether the way in to `/admin` is drawn. Passed from the server
   * page, which already knows the role — `ProfileStats` does not carry it and
   * widening it for one card would touch every caller. */
  isAdmin?: boolean
}) {
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const { locale, setLocale, t, dir } = useLanguage()
  const reduce = useGameReducedMotion()
  const { profile, currentRank, nextRank, totalAttempts, correctCount, accuracyPct, categories, achievements, globalRank, recentAttempts } = stats
  const RankEmblem = emblemForRank(currentRank?.slug)

  const unlockedAchievements = achievements.filter((a) => a.unlocked)
  const xpIntoCurrentRank = currentRank ? profile.totalXp - currentRank.minXp : profile.totalXp
  const xpNeededForNextRank = nextRank ? nextRank.minXp - (currentRank?.minXp ?? 0) : null

  const joinDate = new Date(joinedAt).toLocaleDateString(locale, { month: "short", year: "numeric" })

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: t("overview"), icon: <LayoutDashboard aria-hidden="true" className="h-4 w-4" /> },
    { id: "achievements", label: t("achievements"), icon: <Trophy aria-hidden="true" className="h-4 w-4" /> },
    { id: "statistics", label: t("statistics"), icon: <ChartNoAxesColumn aria-hidden="true" className="h-4 w-4" /> },
    { id: "activity", label: t("activity"), icon: <History aria-hidden="true" className="h-4 w-4" /> },
  ]

  return (
    <div dir={dir} className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader title={t("yourJourney")} subtitle={t("smallSteps")} icon={UserRound} actions={<div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            {/* `hidden sm:inline` removed the word entirely on phones, which
                also removed the select's accessible name — and `sm` is 640px, so
                that meant every phone. `sr-only` keeps the label for assistive
                technology while still freeing the space visually. */}
            <span className="sr-only sm:not-sr-only sm:inline">{t("language")}</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              className="bg-surface-container-high border border-white/10 rounded-xl min-h-11 px-3 py-2 text-on-surface text-sm"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>{opt.label}</option>
              ))}
            </select>
          </label>
          <LogoutButton showLabel className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface-container-high px-3 py-1.5 text-sm text-on-surface-variant transition-colors hover:bg-error/15 hover:text-error" />
        </div>} />

      {/* Profile Card */}
      <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="page-hero p-5 sm:p-8 mb-7">
        <div className="flex flex-col md:flex-row items-center gap-5 sm:gap-8">
          {/* The rank sits **under** the face, not on it.

              It was absolutely positioned at `-top-2 -right-2`, which put the
              chip over the top-right of the avatar — across the shoulder of
              every one of the drawn faces, and across the ear of several. The
              owner's report was that the rank "is entering the avatar, which
              is not supposed to; it should be above or below". Right: a badge
              overlapping a portrait is a notification dot's job, and this is
              a title. A title goes under the picture, the way it does on every
              identity card ever printed.

              Stacking it also gives the chip room to carry its emblem and its
              name at a legible size instead of being squeezed to `sm` so as
              not to cover more of the face. */}
          <div className="flex flex-col items-center gap-3">
            <PremiumAvatar size="xl" ring ringColor="primary" avatarId={profile.avatarId} />
            {currentRank && (
              <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <PremiumBadge variant="warning" size="md">
                  {RankEmblem && <RankEmblem className="h-4 w-4 shrink-0" />}
                  {currentRank.name.toUpperCase()}
                </PremiumBadge>
              </motion.div>
            )}
          </div>

          <div className="flex-1 text-center md:text-start">
            <h2 className="font-headline-lg text-2xl sm:text-3xl text-primary mb-2 break-words">
              {profile.displayName ?? t("learnerFallback")}
            </h2>

            <div className="flex items-center gap-4 justify-center md:justify-start mb-4 text-on-surface-variant">
              <span className="flex items-center gap-1">
                <CalendarDays aria-hidden="true" className="h-4 w-4" />
                {t("joinedOn", { date: joinDate })}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {/* The two figures a player actually watches climb. The rank and
                  accuracy beside them are not counts — a rank counting up from
                  zero would read as losing places — so they arrive as they are. */}
              <PremiumStat label={t("totalXp")} value={<CountUp value={profile.totalXp} />} />
              <PremiumStat label={t("dayStreak")} value={<CountUp value={profile.streakCount} />} />
              <PremiumStat label={t("globalRank")} value={globalRank ? `#${globalRank}` : "—"} />
              <PremiumStat
                label={t("accuracy")}
                value={totalAttempts > 0 ? `${accuracyPct}%` : "—"}
                hint={totalAttempts > 0 ? t("correctOfAttempts", { correct: correctCount, total: totalAttempts }) : undefined}
              />
            </div>

            {currentRank && (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-on-surface-variant">
                    {nextRank ? t("progressToRank", { rank: nextRank.name }) : t("highestRankReachedName", { rank: currentRank.name })}
                  </span>
                  {nextRank && xpNeededForNextRank !== null && (
                    <span className="font-bold text-on-surface">{xpIntoCurrentRank}/{xpNeededForNextRank} {t("barakahShort")}</span>
                  )}
                </div>
                {nextRank && xpNeededForNextRank !== null && (
                  <PremiumProgress label={t("progressToRank", { rank: nextRank.name })} value={xpIntoCurrentRank} max={xpNeededForNextRank} size="lg" />
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            aria-pressed={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 min-h-11 shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-colors whitespace-nowrap ${
              activeTab === tab.id ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div key="overview" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PremiumCard className="p-6">
              <h3 className="font-headline-md text-headline-md text-primary mb-4">{t("learningProgress")}</h3>
              {categories.length === 0 ? (
                <EmptyState description={t("noQuizzesYet")} action={<PremiumButton href="/quiz" size="sm">{t("exploreSubject")}</PremiumButton>} />
              ) : (
                <div className="space-y-4">
                  {categories.map((category) => (
                    <div key={category.slug}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-on-surface">{category.name}</span>
                        <span className="text-on-surface-variant">{t("questionsCount", { count: category.attempted })}</span>
                      </div>
                      <PremiumProgress value={category.correct} max={category.attempted} size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </PremiumCard>

            <PremiumCard className="p-6">
              <h3 className="font-headline-md text-headline-md text-primary mb-4">{t("recentAchievements")}</h3>
              {unlockedAchievements.length === 0 ? (
                <EmptyState description={t(achievements.length === 0 ? "noAchievementsYet" : "noAchievementsUnlockedYet")} action={<PremiumButton href="/achievements" size="sm" variant="secondary">{t("achievements")}</PremiumButton>} />
              ) : (
                <div className="space-y-3">
                  {unlockedAchievements.slice(0, 3).map((achievement) => (
                    <div key={achievement.slug} className="flex items-center gap-3 p-3 bg-surface-container-high/50 rounded-lg">
                      <span className="text-2xl">{achievement.icon}</span>
                      <div className="flex-1">
                        <p className="font-bold text-on-surface">{achievement.name}</p>
                        <p className="text-sm text-on-surface-variant">{achievement.description}</p>
                      </div>
                      {achievement.earnedAt && (
                        <PremiumBadge variant="success" size="sm">
                          {new Date(achievement.earnedAt).toLocaleDateString(locale, { month: "short", day: "numeric" })}
                        </PremiumBadge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </PremiumCard>

            {/* Spans both columns: this is an account-level action, not a
                stat card sitting alongside the others. */}
            <div className="md:col-span-2 space-y-6">
              {isAdmin && <GameMasterCard />}
              <h2 className="font-headline-md text-xl text-on-surface">{t("settings")}</h2>
              <EffectsToggle />
              <SoundToggle />
              <VolumeSlider />
              <HapticsToggle />
              <StreakReminderToggle />
              <ResetProgressCard />
            </div>
          </motion.div>
        )}

        {activeTab === "achievements" && (
          <motion.div key="achievements" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {achievements.length === 0 && <EmptyState description={t("noAchievementsYet")} action={<PremiumButton href="/quiz" size="sm">{t("exploreSubject")}</PremiumButton>} />}
            {achievements.map((achievement) => (
              <AchievementCard
                key={achievement.slug}
                title={achievement.name}
                description={achievement.description}
                icon={achievement.icon}
                progress={achievement.progress}
                maxProgress={achievement.target}
                reward=""
                isUnlocked={achievement.unlocked}
                unlockedAt={achievement.earnedAt ? new Date(achievement.earnedAt).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" }) : undefined}
              />
            ))}
          </motion.div>
        )}

        {activeTab === "statistics" && (
          <motion.div key="statistics" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categories.length === 0 ? (
              <PremiumCard className="p-6">
                <h3 className="font-headline-md text-headline-md text-primary mb-4">{t("categoryPerformance")}</h3>
                <p className="text-on-surface-variant text-sm">{t("noAccuracyYet")}</p>
              </PremiumCard>
            ) : (
              <KnowledgeBreakdown stats={categories} />
            )}

            <PremiumCard className="p-6">
              <h3 className="font-headline-md text-headline-md text-primary mb-4">{t("learningStreaks")}</h3>
              <div className="text-center mb-6">
                <p className="font-bold text-5xl text-primary mb-2">{profile.streakCount}</p>
                <p className="text-on-surface-variant">{t("currentStreak")}</p>
              </div>
              <div className="grid grid-cols-7 gap-2 mb-6">
                {[...Array(7)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={reduce ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className={`h-10 rounded-lg ${i < Math.min(profile.streakCount, 7) ? "bg-primary/60" : "bg-surface-container-highest"}`}
                  />
                ))}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">{t("longestStreak")}</span>
                  <span className="font-bold text-on-surface">{t("daysCount", { count: profile.longestStreak })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">{t("questionsAnswered")}</span>
                  <span className="font-bold text-on-surface">{totalAttempts}</span>
                </div>
              </div>
            </PremiumCard>
          </motion.div>
        )}

        {activeTab === "activity" && (
          <motion.div key="activity" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <PremiumCard className="p-6">
              <h3 className="font-headline-md text-headline-md text-primary mb-4">{t("recentActivity")}</h3>
              {recentAttempts.length === 0 ? (
                <EmptyState description={t("noActivityYet")} action={<PremiumButton href="/quiz" size="sm">{t("exploreSubject")}</PremiumButton>} />
              ) : (
                <div className="space-y-3">
                  {recentAttempts.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-surface-container-high/50 rounded-lg">
                      <span className="text-xl">{a.isCorrect ? "✅" : "❌"}</span>
                      <div className="flex-1">
                        <p className="text-on-surface text-sm">{a.questionText}</p>
                        <p className="text-xs text-on-surface-variant">{a.categoryName} · {timeAgo(a.createdAt, t)}</p>
                      </div>
                      {a.xpEarned > 0 && <PremiumBadge variant="primary" size="sm">+{a.xpEarned} {t("barakahShort")}</PremiumBadge>}
                    </div>
                  ))}
                </div>
              )}
            </PremiumCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
