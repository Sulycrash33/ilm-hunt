"use client"

import { BookOpen, Zap, Trophy, Target, Users, ArrowRight, ArrowLeft } from "lucide-react"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumButton } from "@/components/ui/premium-button"
import { PremiumBadge } from "@/components/ui/premium-badge"
import { useLanguage } from "@/contexts/LanguageContext"
import type { Translations } from "@/lib/i18n"

const modes: { id: string; name: keyof Translations; description: keyof Translations; icon: typeof BookOpen; difficulty: keyof Translations; href: string; tone: string }[] = [
  { id: "practice", name: "modePracticeName", description: "modePracticeDesc", icon: Target, difficulty: "difficultyBeginner", href: "/play/practice", tone: "text-tertiary bg-tertiary/10 border-tertiary/20" },
  { id: "classic", name: "modeClassicName", description: "modeClassicDesc", icon: BookOpen, difficulty: "difficultyAllLevels", href: "/quiz", tone: "text-primary bg-primary/10 border-primary/20" },
  { id: "timed", name: "modeSpeedName", description: "modeSpeedDesc", icon: Zap, difficulty: "difficultyIntermediate", href: "/play/timed", tone: "text-warning bg-warning/10 border-warning/20" },
  { id: "survival", name: "modeSurvivalName", description: "modeSurvivalDesc", icon: Trophy, difficulty: "difficultyAdvanced", href: "/play/survival", tone: "text-tertiary bg-tertiary/10 border-tertiary/20" },
  { id: "multiplayer", name: "multiplayerQuiz", description: "playTogetherHint", icon: Users, difficulty: "difficultyAllLevels", href: "/multiplayer", tone: "text-primary bg-primary/10 border-primary/20" },
]

export function GameModesPageClient({ totalAttempts, accuracyPct, totalXp }: { totalAttempts: number; accuracyPct: number; totalXp: number }) {
  const { t, dir } = useLanguage()
  const Back = dir === "rtl" ? ArrowRight : ArrowLeft
  return <main dir={dir} className="mx-auto min-h-[100dvh] max-w-7xl px-5 py-6 sm:py-10">
    <PremiumButton href="/home" variant="ghost" size="sm" className="mb-4"><Back size={18} aria-hidden="true" />{t("back")}</PremiumButton>
    <header className="page-hero mb-6"><p className="page-kicker">{t("allGameModesTitle")}</p><h1 className="mt-2 font-serif text-3xl text-on-surface sm:text-4xl">{t("gameModesTitle")}</h1><p className="mt-3 max-w-xl text-on-surface-variant">{t("choosePathToKnowledge")}</p></header>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{modes.map(mode =>
      <PremiumCard key={mode.id} animate={false} className="flex h-full flex-col p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${mode.tone}`}><mode.icon size={28} aria-hidden="true" /></div><PremiumBadge variant="secondary" size="sm">{t(mode.difficulty)}</PremiumBadge></div>
        <h2 className="mb-2 text-xl font-bold">{t(mode.name)}</h2>
        <p className="mb-6 flex-1 text-sm leading-relaxed text-on-surface-variant">{t(mode.description)}</p>
        <PremiumButton href={mode.href} fullWidth variant={mode.id === "practice" ? "primary" : "secondary"}>{t("playButton")}<ArrowRight size={18} className="rtl:rotate-180" aria-hidden="true" /></PremiumButton>
      </PremiumCard>
    )}</div>
    <section className="glass-card mt-8 p-6" aria-labelledby="game-stats"><h2 id="game-stats" className="mb-5 text-lg font-semibold">{t("yourStatsTitle")}</h2><div className="grid grid-cols-3 gap-3 text-center">
      <div><strong className="block text-2xl text-primary">{totalAttempts.toLocaleString()}</strong><p className="mt-1 text-xs text-on-surface-variant">{t("questionsAnswered")}</p></div>
      <div><strong className="block text-2xl text-secondary">{totalAttempts > 0 ? `${accuracyPct}%` : "—"}</strong><p className="mt-1 text-xs text-on-surface-variant">{t("accuracy")}</p></div>
      <div><strong className="block text-2xl text-primary">{totalXp.toLocaleString()}</strong><p className="mt-1 text-xs text-on-surface-variant">{t("totalXp")}</p></div>
    </div></section>
  </main>
}
