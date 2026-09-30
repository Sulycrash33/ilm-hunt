"use client"

import { Sparkles } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { useGameExperience } from "@/contexts/GameExperienceContext"
import { useLanguage } from "@/contexts/LanguageContext"

export function EffectsToggle() {
  const { calm, setCalm } = useGameExperience()
  const { t } = useLanguage()
  return <section className="glass-card flex items-center justify-between gap-5 p-5 sm:p-6">
    <div><h3 className="flex items-center gap-2 font-bold text-on-surface"><Sparkles aria-hidden="true" className="h-4 w-4 text-primary" />{t("calmEffects")}</h3>
      <p id="effects-help" className="mt-2 text-sm text-on-surface-variant">{t("calmEffectsHint")}</p></div>
    <Switch checked={calm} onCheckedChange={setCalm} aria-label={t("calmEffects")} aria-describedby="effects-help" />
  </section>
}
