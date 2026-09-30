"use client"

import { usePathname } from "next/navigation"
import { useLanguage } from "@/contexts/LanguageContext"
import { AppBackdrop } from "@/components/layout/AppBackdrop"
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar"
import { TimezoneSync } from "@/components/layout/TimezoneSync"
import { BottomNavBar } from "@/components/layout/BottomNavBar"

function isRunRoute(pathname: string) {
  return pathname.startsWith("/play/") || pathname === "/review" ||
    pathname.startsWith("/review/") || /^\/quiz\/[^/]+\/[^/]+/.test(pathname)
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { dir } = useLanguage()
  const inRun = isRunRoute(pathname)
  return <div dir={dir} className="relative min-h-[100dvh] bg-background">
    <ServiceWorkerRegistrar /><TimezoneSync /><AppBackdrop />
    <div className={`relative z-10 ${inRun ? "pb-8" : "pb-nav-safe"}`}>{children}</div>
    {!inRun && <BottomNavBar />}
  </div>
}
