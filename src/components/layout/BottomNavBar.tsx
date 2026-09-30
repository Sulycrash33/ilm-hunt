"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, BookOpen, Trophy, ShoppingBag, UserRound, MoreHorizontal, Zap, Users, Award, Gift, RotateCcw, ArrowUpRight } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import { useGameExperience } from "@/contexts/GameExperienceContext"
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import type { Translations } from "@/lib/i18n"

const primary: { href: string; icon: typeof Home; label: keyof Translations }[] = [
  { href: "/home", icon: Home, label: "home" },
  { href: "/quiz", icon: BookOpen, label: "learning" },
  { href: "/leaderboard", icon: Trophy, label: "rankings" },
  { href: "/store", icon: ShoppingBag, label: "shop" },
  { href: "/profile", icon: UserRound, label: "profile" },
]
const explore: typeof primary = [
  { href: "/challenges", icon: Zap, label: "gameModes" },
  { href: "/multiplayer", icon: Users, label: "multiplayerQuiz" },
  { href: "/community", icon: Users, label: "community" },
  { href: "/achievements", icon: Award, label: "achievements" },
  { href: "/rewards", icon: Gift, label: "rewardsCenter" },
  { href: "/review", icon: RotateCcw, label: "reviewTitle" },
]

export function BottomNavBar() {
  const pathname = usePathname()
  const { t, dir } = useLanguage()
  const { calm, setCalm } = useGameExperience()
  const [open, setOpen] = useState(false)
  const moreActive = explore.some(item => pathname === item.href || pathname.startsWith(item.href + "/"))
  return <nav dir={dir} aria-label={t("mainNavigation")} className="game-nav fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-surface/95 backdrop-blur-xl">
    <div className="mx-auto grid max-w-3xl grid-cols-6 gap-1 px-2 pt-2 pb-safe">
      {primary.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/")
        return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
          className={`nav-destination relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 ${active ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"}`}>
          <item.icon size={20} strokeWidth={active ? 2.5 : 1.8} aria-hidden="true" />
          <span className="w-full truncate text-center text-[10px] font-semibold sm:text-xs">{t(item.label)}</span>
          {active && <span aria-hidden="true" className="absolute bottom-0 h-0.5 w-5 rounded-full bg-primary" />}
        </Link>
      })}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild><button type="button" className={`nav-destination flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 ${moreActive ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-white/5"}`}>
          <MoreHorizontal size={20} aria-hidden="true" /><span className="w-full truncate text-[10px] font-semibold sm:text-xs">{t("moreEllipsis")}</span>
        </button></SheetTrigger>
        <SheetContent side={dir === "rtl" ? "left" : "right"} dir={dir} className="w-full max-w-md overflow-y-auto pb-safe sm:max-w-md">
          <SheetHeader className="mt-6 !text-start"><SheetTitle className="font-serif text-2xl text-primary">{t("moreWaysToGrow")}</SheetTitle><SheetDescription>{t("exploreMenuHint")}</SheetDescription></SheetHeader>
          <div className="my-6 space-y-2">{explore.map(item => <SheetClose asChild key={item.href}><Link href={item.href} className="interactive-card flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-surface-container p-4">
            <item.icon className="text-tertiary" size={22} aria-hidden="true" /><span className="flex-1 font-semibold">{t(item.label)}</span><ArrowUpRight size={16} className="text-on-surface-variant rtl:-scale-x-100" aria-hidden="true" />
          </Link></SheetClose>)}</div>
          <div className="rounded-2xl border border-tertiary/20 bg-tertiary/5 p-4">
            <div className="flex items-center justify-between gap-4"><label htmlFor="calm-effects" className="font-semibold">{t("calmEffects")}</label><Switch id="calm-effects" checked={calm} onCheckedChange={setCalm} aria-describedby="calm-hint" /></div>
            <p id="calm-hint" className="mt-2 text-sm leading-relaxed text-on-surface-variant">{t("calmEffectsHint")}</p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  </nav>
}
