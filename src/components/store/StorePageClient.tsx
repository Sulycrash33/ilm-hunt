"use client"

import { useGameReducedMotion } from "@/contexts/GameExperienceContext"

import { PageHeader } from "@/components/layout/PageHeader"
import { ShoppingBag , Coins } from "lucide-react"

import { motion, AnimatePresence } from "framer-motion"
import { EmptyState } from "@/components/ui/empty-state"
import { PremiumModal } from "@/components/ui/premium-modal"
import { Search } from "lucide-react"
import { normalizeSubjectSearch } from "@/lib/subject-discovery"
import { useMemo, useState, useRef } from "react"
import { PremiumButton } from "@/components/ui/premium-button"
import { ShopItem } from "@/components/game/ShopItem"
import { purchaseStoreItem, type StoreCatalogueItem } from "@/app/(app)/store/actions"
import { useLanguage } from "@/contexts/LanguageContext"
import { CountUp } from "@/components/ui/count-up"
import { LifeBuoy, Zap, Sparkles, Package } from "lucide-react"
import type { Translations } from "@/lib/i18n"

type StoreTab = "lifelines" | "powerups" | "cosmetics" | "bundles"

/**
 * The catalogue is no longer hardcoded here.
 *
 * There used to be an inline `storeItems` map in this file AND a second one in
 * src/data/store-items.ts, and they disagreed: item "1" was 100 coins here and
 * 50 there. Worse, the price rendered here was the price sent to the server to
 * deduct. Both are fixed by reading the catalogue from `store_items` on the
 * server (see migration 0006) and sending only an item id when buying.
 */
interface StorePageClientProps {
  initialCoins: number
  catalogue: StoreCatalogueItem[]
}

export function StorePageClient({ initialCoins, catalogue }: StorePageClientProps) {
  const { t, dir } = useLanguage()
  const reduce = useGameReducedMotion()
  const purchaseLock = useRef(false)
  const [query, setQuery] = useState("")
  const [selectedItem, setSelectedItem] = useState<StoreCatalogueItem | null>(null)
  const [activeTab, setActiveTab] = useState<StoreTab>("lifelines")
  const [coins, setCoins] = useState(initialCoins)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  // Owned counts start from the server and are bumped locally on a successful
  // purchase, so an item flips to "Owned" without a round trip.
  const [owned, setOwned] = useState<Record<string, number>>(() =>
    Object.fromEntries(catalogue.map((i) => [i.id, i.owned])),
  )

  const visibleItems = useMemo(
    () => catalogue.filter((item) => item.tab === activeTab && normalizeSubjectSearch(`${t(item.nameKey as keyof Translations)} ${t(item.descKey as keyof Translations)}`).includes(normalizeSubjectSearch(query))),
    [catalogue, activeTab, query, t],
  )

  const tabs: { id: StoreTab; label: string; icon: React.ReactNode }[] = [
    // Line icons rather than emoji, to match the quick actions on the home
    // screen. Emoji render differently on every platform and sit at a
    // different weight to the text beside them; these inherit the tab's own
    // colour, so a selected tab's icon goes gold with its label.
    { id: "lifelines", label: t("lifelines"), icon: <LifeBuoy className="h-4 w-4" aria-hidden="true" /> },
    { id: "powerups", label: t("powerups"), icon: <Zap className="h-4 w-4" aria-hidden="true" /> },
    { id: "cosmetics", label: t("cosmetics"), icon: <Sparkles className="h-4 w-4" aria-hidden="true" /> },
    { id: "bundles", label: t("bundles"), icon: <Package className="h-4 w-4" aria-hidden="true" /> },
  ]

  const handlePurchase = async (id: string, name: string) => {
    if (purchaseLock.current) return
    purchaseLock.current = true
    setPendingId(id)
    setMessage(null)
    // Only the id goes to the server. It decides the price.
    try {
    const result = await purchaseStoreItem(id)

    if (result.success && result.newBalance !== undefined) {
      setCoins(result.newBalance)
      setOwned((prev) => ({ ...prev, [id]: result.quantity ?? (prev[id] ?? 0) + 1 }))
      // Report the price the server charged, not the one this page displayed.
      setMessage(t("purchasedMsg", { name, price: result.price ?? 0 }))
    } else {
      if (result.newBalance !== undefined) setCoins(result.newBalance)
      setMessage(result.error ?? t("purchaseFailedMsg"))
    }
    } catch { setMessage(t("purchaseFailedMsg")) }
    finally { purchaseLock.current = false; setPendingId(null); setSelectedItem(null) }
  }

  return (
    <div dir={dir} className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader title={t("ilmStore")} subtitle={t("enhanceLearning")} icon={ShoppingBag} actions={<div className="flex items-center gap-2 rounded-xl border border-tertiary/30 bg-tertiary/10 px-4 py-3 text-tertiary"><Coins aria-hidden="true" className="h-5 w-5" /><CountUp value={coins} />{t("coinsWord")}</div>} />

      {message && (
        <motion.div role="status" aria-live="polite" initial={reduce ? false : { opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 text-center text-sm text-on-surface-variant">
          {message}
        </motion.div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="flex min-h-12 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-surface-container-high px-4">
          <Search aria-hidden="true" className="h-5 w-5 text-on-surface-variant" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t("storeSearch")} placeholder={t("storeSearch")} className="min-w-0 w-full bg-transparent py-3 text-on-surface outline-none" />
        </label>
        <PremiumButton href="/rewards" variant="secondary" size="sm">{t("rewardsCenter")}</PremiumButton>
      </div>
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

      {visibleItems.length === 0 && <EmptyState description={t("shopEmpty")} icon={ShoppingBag} />}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {visibleItems.map((item, index) => {
            const isOwned = !item.consumable && (owned[item.id] ?? 0) > 0
            return (
            <motion.div key={item.id} initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <ShopItem
                nameKey={item.nameKey}
                name={t(item.nameKey as keyof Translations)}
                description={t(item.descKey as keyof Translations)}
                price={item.price}
                icon={item.icon}
                category={item.category}
                isOwned={isOwned}
                pending={pendingId === item.id}
                disabled={pendingId !== null}
                affordable={coins >= item.price}
                inStock={item.inStock}
                quantity={owned[item.id] ?? 0}
                bundle={item.tab === "bundles"}
                onPurchase={
                  isOwned || !item.inStock
                    ? undefined
                    : () => setSelectedItem(item)
                }
              />


            </motion.div>
            )
          })}
        </motion.div>
      </AnimatePresence>

      <PremiumModal isOpen={selectedItem !== null} onClose={() => { if (!purchaseLock.current) setSelectedItem(null) }} title={t("confirm")}>
        {selectedItem && <div className="space-y-5">
          <h3 className="text-lg font-bold text-on-surface">{t(selectedItem.nameKey as keyof Translations)}</h3>
          <p className="text-sm text-on-surface-variant">{t(selectedItem.descKey as keyof Translations)}</p>
          <p className="font-bold text-tertiary">{selectedItem.price.toLocaleString()} {t("coinsWord")}</p>
          <p className="text-xs text-on-surface-variant">{t("storeFootnote")}</p>
          <div className="flex flex-wrap gap-3">
            <PremiumButton variant="secondary" disabled={pendingId !== null} onClick={() => setSelectedItem(null)}>{t("cancel")}</PremiumButton>
            <PremiumButton disabled={pendingId !== null} onClick={() => handlePurchase(selectedItem.id, t(selectedItem.nameKey as keyof Translations))}>{pendingId ? t("processingLabel") : t("buy")}</PremiumButton>
          </div>
        </div>}
      </PremiumModal>
      <p className="text-xs text-on-surface-variant text-center mt-8">
        {t("storeFootnote")}
      </p>
    </div>
  )
}
