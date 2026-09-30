"use client"

import Link from "next/link"
import { BookOpen, Users, Trophy, ArrowRight } from "lucide-react"
import { NamesOfAllahBackdrop } from "@/components/layout/NamesOfAllahBackdrop"
import { IlmHuntMark } from "@/components/icons/IlmHuntMark"
import { useLanguage } from "@/contexts/LanguageContext"

export default function LandingScreen() {
  const { t, dir } = useLanguage()
  return <div dir={dir} className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background">
    <NamesOfAllahBackdrop />
    <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-8 px-6 py-10 md:grid md:grid-cols-[1.15fr_1fr] md:items-center md:gap-16 md:py-16">
      <div className="rise-in">
        <div className="mb-8 flex items-center gap-3"><IlmHuntMark className="h-12 w-12 text-primary" /><span className="text-xl font-bold tracking-tight text-primary">ILM Hunt</span></div>
        <p className="page-kicker">{t("digitalSanctuary")}</p>
        <h1 className="mt-4 max-w-xl font-serif text-4xl leading-[1.15] text-on-surface sm:text-5xl lg:text-6xl">{t("smallSteps")}</h1>
        <p className="mt-5 max-w-lg text-lg leading-relaxed text-on-surface-variant">{t("journeyInvitation")}</p>
        <div className="mt-7 flex flex-wrap gap-2">{[{ icon: BookOpen, key: "learning" }, { icon: Users, key: "community" }, { icon: Trophy, key: "achievements" }].map(item =>
          <span key={item.key} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-surface-container/80 px-4 py-2 text-sm text-on-surface-variant"><item.icon size={16} className="text-tertiary" aria-hidden="true" />{t(item.key as "learning" | "community" | "achievements")}</span>
        )}</div>
      </div>
      <div className="glass-card welcome-card settle-in flex flex-col items-center gap-6 px-6 py-8 text-center sm:px-10 sm:py-10">
        <div className="hidden h-48 w-48 items-center justify-center rounded-full border border-primary/25 bg-primary/5 shadow-[0_0_60px_-20px_rgba(240,205,109,0.4)] md:flex"><IlmHuntMark className="h-36 w-36 text-primary" /></div>
        <h2 className="font-serif text-2xl text-primary">{t("welcome")}</h2>
        <Link href="/language" className="btn-primary game-button inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl px-5 py-4 text-base font-bold">{t("beginYourJourney")}<ArrowRight size={20} className="rtl:rotate-180" aria-hidden="true" /></Link>
        <p className="text-sm leading-relaxed text-on-surface-variant">{t("alreadyHaveAccount")} <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">{t("signIn")}</Link></p>
      </div>
    </main>
  </div>
}
