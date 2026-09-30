"use client"

import type { ReactNode } from "react"
import { ArrowLeft, type LucideIcon } from "lucide-react"
import { PremiumButton } from "@/components/ui/premium-button"
import { useLanguage } from "@/contexts/LanguageContext"

export function PageHeader({ title, subtitle, icon: Icon, actions, backHref = "/home" }: {
  title: string; subtitle?: string; icon?: LucideIcon; actions?: ReactNode; backHref?: string
}) {
  const { t, dir } = useLanguage()
  return <header className="mb-7 space-y-4">
    <PremiumButton href={backHref} variant="ghost" size="sm">
      <ArrowLeft aria-hidden="true" className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`} />{t("back")}
    </PremiumButton>
    <div className="page-hero flex flex-wrap items-center justify-between gap-5 p-5 sm:p-7">
      <div className="min-w-0 flex-1">
        {Icon && <Icon aria-hidden="true" className="mb-3 h-7 w-7 text-primary" />}
        <h1 className="font-headline-lg text-3xl sm:text-4xl text-on-surface break-words">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm sm:text-base text-on-surface-variant leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  </header>
}
