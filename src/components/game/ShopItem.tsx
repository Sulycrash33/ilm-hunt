"use client"

import { Coins, LifeBuoy, Zap, Brain, SkipForward, Gem, Timer, Sparkles, Package, UserRound, Palette, Award, LoaderCircle, Check, type LucideIcon } from "lucide-react"
import { PremiumButton } from "@/components/ui/premium-button"
import { PremiumBadge } from "@/components/ui/premium-badge"
import { useLanguage } from "@/contexts/LanguageContext"

interface ShopItemProps {
  name: string; nameKey?: string; description: string; price: number; icon: string;
  category: "avatar" | "theme" | "power-up" | "badge";
  isOwned?: boolean; onPurchase?: () => void; pending?: boolean; disabled?: boolean;
  inStock?: boolean; affordable?: boolean; quantity?: number; bundle?: boolean;
}

export function ShopItem({ name, nameKey, description, price, category, isOwned = false, onPurchase,
  pending = false, disabled = false, inStock = true, affordable = true, quantity = 0, bundle = false }: ShopItemProps) {
  const { t } = useLanguage()
  const icons: Record<ShopItemProps["category"], LucideIcon> = { avatar: UserRound, theme: Palette, "power-up": LifeBuoy, badge: Award }
  const lifelineIcons: Record<string, LucideIcon> = { lifelineFiftyFifty: Zap, lifelineAskImam: Brain, lifelineSkip: SkipForward, lifelineDoublePoints: Gem, lifelineTimeBoost: Timer }
  const Icon = bundle ? Package : (nameKey && lifelineIcons[nameKey]) || icons[category] || Sparkles
  const labels = { avatar: t("catAvatar"), theme: t("catTheme"), "power-up": t("catPowerUp"), badge: t("catBadge") }
  const actionLabel = pending ? t("processingLabel") : isOwned ? t("owned") : !inStock ? t("outOfStock") : !affordable ? t("notEnoughCoins") : t("buy")
  return <article aria-busy={pending} className="glass-card flex h-full flex-col p-5 sm:p-6">
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Icon aria-hidden="true" className="h-7 w-7" /></div>
      <PremiumBadge variant="tertiary" size="sm">{labels[category]}</PremiumBadge>
    </div>
    <h2 className="text-lg font-bold text-on-surface">{name}</h2>
    <p className="mt-2 flex-1 text-sm leading-relaxed text-on-surface-variant">{description}</p>
    {quantity > 0 && <p className="mt-4 flex items-center gap-2 text-xs text-tertiary"><Check aria-hidden="true" className="h-4 w-4" />{t("inventoryCount", { count: quantity })}</p>}
    <div className="mt-5 border-t border-white/10 pt-4">
      <p className="mb-3 flex items-center gap-2 font-bold tabular-nums text-tertiary"><Coins aria-hidden="true" className="h-4 w-4" />{price.toLocaleString()} {t("coinsWord")}</p>
      <PremiumButton aria-label={`${actionLabel}: ${name}`} aria-busy={pending} fullWidth variant={isOwned ? "secondary" : "primary"} size="sm" onClick={onPurchase}
        disabled={disabled || pending || isOwned || !inStock || !affordable || !onPurchase}>
        {pending && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}{actionLabel}
      </PremiumButton>
    </div>
  </article>
}
