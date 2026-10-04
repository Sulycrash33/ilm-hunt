"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, BookOpen, Search, Shuffle, X, CheckCircle2 } from "lucide-react"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumButton } from "@/components/ui/premium-button"
import { useLanguage } from "@/contexts/LanguageContext"
import type { QuizCategory } from "@/lib/quiz-service"
import { filterSubjects, type SubjectFilter } from "@/lib/subject-discovery"

export function QuizCategoriesGrid({ categories }: { categories: QuizCategory[] }) {
  const { t, dir } = useLanguage()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<SubjectFilter>("all")
  const results = useMemo(() => filterSubjects(categories, query, filter), [categories, query, filter])
  const totalAnswered = categories.reduce((sum, category) => sum + category.answeredCount, 0)
  const playable = results.filter(category => category.publishedCount > 0)
  const filters = [{ value: "all", label: "allSubjects" }, { value: "started", label: "startedSubjects" }, { value: "new", label: "newSubjects" }] as const

  return <main dir={dir} className="mx-auto min-h-[100dvh] max-w-7xl px-5 py-6 sm:py-10">
    <header className="page-hero mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="page-kicker">{t("knowledgeCategories")}</p><h1 className="mt-2 max-w-2xl font-serif text-3xl leading-tight text-on-surface sm:text-4xl">{t("discoverSubjects")}</h1></div>
        <div className="flex gap-4 rounded-2xl border border-white/10 bg-background/40 px-5 py-3">
          <div><strong className="block text-xl text-primary">{categories.length}</strong><span className="text-xs text-on-surface-variant">{t("categories")}</span></div>
          <div className="border-s border-white/10 ps-4"><strong className="block text-xl text-tertiary">{totalAnswered.toLocaleString()}</strong><span className="text-xs text-on-surface-variant">{t("questionsAnswered")}</span></div>
        </div>
      </div>
      <Link href="/onboarding/how-it-works" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline">{t("howItWorksLink")}<ArrowRight className="ms-2 rtl:rotate-180" size={16} aria-hidden="true" /></Link>
    </header>
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search size={20} aria-hidden="true" className="pointer-events-none absolute start-4 top-3.5 text-on-surface-variant" />
          <label htmlFor="subject-search" className="sr-only">{t("searchSubjects")}</label>
          <input id="subject-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("searchSubjects")}
            className="h-12 w-full rounded-xl border border-white/15 bg-surface-container ps-12 pe-12 text-on-surface placeholder:text-on-surface-variant" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label={t("clearSearch")} className="absolute end-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10"><X size={18} aria-hidden="true" /></button>}
        </div>
        <PremiumButton variant="secondary" size="sm" disabled={!playable.length} onClick={() => {
          const category = playable[Math.floor(Math.random() * playable.length)]
          if (category) router.push(`/quiz/${category.slug}`)
        }}><Shuffle size={18} aria-hidden="true" />{t("surpriseSubject")}</PremiumButton>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("allSubjects")}>{filters.map(item =>
        <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`filter-chip min-h-11 rounded-full border px-4 py-2 text-sm font-semibold ${filter === item.value ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10 bg-surface-container text-on-surface-variant hover:border-white/30"}`}>{t(item.label)}</button>
      )}</div>
      <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-on-surface-variant">{t("categories")}: {results.length}</p>
    </div>
    {results.length === 0 ? <div className="glass-card p-8 text-center">
      <BookOpen size={36} className="mx-auto mb-4 text-primary" aria-hidden="true" />
      <p className="mb-4 text-on-surface-variant">{categories.length ? t("noSubjectsFound") : t("comingSoon")}</p>
      {!!categories.length && <PremiumButton variant="secondary" onClick={() => { setQuery(""); setFilter("all") }}>{t("clearSearch")}</PremiumButton>}
    </div> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {results.map(category => {
        const available = category.publishedCount > 0
        const content = <PremiumCard animate={false} hover={available} className={`subject-card h-full p-5 sm:p-6 ${!available ? "opacity-60" : ""}`}>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${category.answeredCount > 0 ? "border-tertiary/25 bg-tertiary/10 text-tertiary" : "border-primary/25 bg-primary/10 text-primary"}`}><BookOpen size={24} aria-hidden="true" /></div>
            {category.answeredCount > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary/10 px-3 py-1 text-xs text-tertiary"><CheckCircle2 size={13} aria-hidden="true" />{t("startedSubjects")}</span>}
          </div>
          <h2 className="mb-2 text-lg font-bold text-on-surface">{category.name}</h2>
          <p className="min-h-10 text-sm leading-relaxed text-on-surface-variant">{category.description}</p>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <span className="text-sm font-semibold text-primary">{available ? t(category.answeredCount ? "continue" : "exploreSubject") : t("comingSoon")}</span>
            {available && <ArrowRight size={18} className="subject-arrow text-primary rtl:rotate-180" aria-hidden="true" />}
          </div>
          {category.answeredCount > 0 && <p className="mt-2 text-xs text-on-surface-variant">{category.answeredCount.toLocaleString()} {t("questionsAnswered")}</p>}
        </PremiumCard>
        return available ? <Link key={category.id} href={`/quiz/${category.slug}`} className="group block rounded-2xl">{content}</Link> : <div key={category.id}>{content}</div>
      })}
    </div>}
  </main>
}
