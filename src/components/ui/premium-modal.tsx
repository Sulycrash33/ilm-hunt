"use client"

import { useRef, type ReactNode } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useLanguage } from "@/contexts/LanguageContext"

export function PremiumModal({ isOpen, onClose, children, title, size = "md" }: {
  isOpen: boolean; onClose: () => void; children: ReactNode; title?: string; size?: "sm" | "md" | "lg" | "xl"
}) {
  const { t, dir } = useLanguage()
  const opener = useRef<HTMLElement | null>(null)
  const sizes = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl" }
  return <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogContent onOpenAutoFocus={() => { opener.current = document.activeElement as HTMLElement | null }} onCloseAutoFocus={(event) => { event.preventDefault(); opener.current?.focus() }} dir={dir} aria-describedby={undefined} className={`glass-card ${sizes[size]} max-h-[85dvh] overflow-y-auto rounded-2xl p-5 sm:p-6`}>
      <DialogTitle className={title ? "pe-10 text-xl font-bold text-on-surface" : "sr-only"}>{title ?? t("settings")}</DialogTitle>
      {children}
    </DialogContent>
  </Dialog>
}
