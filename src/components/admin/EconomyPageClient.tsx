"use client"

import { useGameReducedMotion as useReducedMotion } from "@/contexts/GameExperienceContext";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, Save } from "lucide-react"
import { PremiumCard } from "@/components/ui/premium-card"
import { useToast } from "@/hooks/use-toast"
import {
  setLifelinePrice,
  setStoreItem,
  setSpinReward,
  setChest,
  setGameMode,
  type EconomySnapshot,
} from "@/app/(app)/admin/economy/actions"

/**
 * The numbers the game runs on, editable without a migration.
 *
 * Each row saves on its own. That is deliberate: a single "save everything"
 * button on a screen of prices means one typo rolls the whole economy, and
 * the audit log would record it as one indivisible change rather than the one
 * value that actually moved.
 *
 * The bounds shown here mirror the database's, which is where they are
 * actually enforced — these inputs are a courtesy, not the guard.
 *
 * Admin pages are outside the i18n bundle by convention, so the copy is
 * English.
 */
export function EconomyPageClient({ economy }: { economy: EconomySnapshot }) {
  const reduce = useReducedMotion()

  return (
    <div className="min-h-[100dvh] px-5 py-6 max-w-5xl mx-auto">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-primary mb-2">
          Economy
        </h1>
        <p className="text-on-surface-variant">
          Prices, rewards and multipliers. Every change is written to the audit log.
        </p>
      </motion.div>

      <PremiumCard className="mb-6 border-warning/30 bg-warning/5 p-4">
        <p className="text-sm text-on-surface">
          These take effect immediately for every player. XP multipliers are capped at
          2× in the database. Migration 0030 chose that ceiling so the compounded
          exposure stayed knowable, and this screen cannot raise it.
        </p>
      </PremiumCard>

      <Section title="Game modes" note="The XP a mode pays, as a ratio. Capped at 2×.">
        {economy.modes.map((m) => (
          <ModeRow key={m.mode} mode={m} />
        ))}
      </Section>

      <Section title="Lifelines" note="What a lifeline costs in coins when it is not owned from the store.">
        {economy.lifelines.map((l) => (
          <LifelineRow key={l.id} lifeline={l} />
        ))}
      </Section>

      <Section title="Store" note="Shelf prices and whether an item is stocked at all.">
        {economy.store.map((s) => (
          <StoreRow key={s.id} item={s} />
        ))}
      </Section>

      <Section title="Chests" note="What a chest costs and what it pays.">
        {economy.chests.map((c) => (
          <ChestRow key={c.tier} chest={c} />
        ))}
      </Section>

      <Section title="Spin wheel" note="Reward value and its relative weight on the wheel.">
        {economy.spin.map((s) => (
          <SpinRow key={s.id} reward={s} />
        ))}
      </Section>
    </div>
  )
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-1 font-headline text-xl text-on-surface">{title}</h2>
      <p className="mb-3 text-sm text-on-surface-variant">{note}</p>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

/** One row, one save. Shared shell so every row behaves identically. */
function Row({
  label,
  sub,
  children,
  onSave,
}: {
  label: string
  sub?: string
  children: React.ReactNode
  onSave: () => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function save() {
    if (busy) return
    setBusy(true)
    const r = await onSave()
    setBusy(false)
    if (!r.ok) {
      toast({ variant: "destructive", title: "Not saved", description: r.error })
      return
    }
    toast({ title: `Saved ${label}` })
    router.refresh()
  }

  return (
    <PremiumCard className="p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-on-surface truncate">{label}</p>
          {sub && <p className="text-xs text-on-surface-variant">{sub}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {children}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/40 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  : <Save className="h-4 w-4" aria-hidden="true" />}
            Save
          </button>
        </div>
      </div>
    </PremiumCard>
  )
}

function Num({
  value, onChange, label, min = 0, max = 1000000, width = "w-24",
}: {
  value: number; onChange: (n: number) => void; label: string; min?: number; max?: number; width?: string
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-on-surface-variant">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${width} rounded-lg border border-white/10 bg-surface-container px-2 py-1.5 text-sm text-on-surface`}
      />
    </label>
  )
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-on-surface-variant">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-white/20 bg-surface-container"
      />
      {label}
    </label>
  )
}

function ModeRow({ mode }: { mode: EconomySnapshot["modes"][number] }) {
  const [num, setNum] = useState(mode.xp_numerator)
  const [den, setDen] = useState(mode.xp_denominator)
  const ratio = den > 0 ? (num / den).toFixed(2) : "—"

  return (
    <Row
      label={mode.mode}
      sub={`pays ${ratio}× XP${mode.endless ? " · endless" : ""}${mode.lives ? ` · ${mode.lives} lives` : ""}`}
      onSave={() => setGameMode(mode.mode, num, den)}
    >
      <Num label="×" value={num} onChange={setNum} min={1} max={100} width="w-16" />
      <span className="text-on-surface-variant">/</span>
      <Num label="" value={den} onChange={setDen} min={1} max={100} width="w-16" />
    </Row>
  )
}

function LifelineRow({ lifeline }: { lifeline: EconomySnapshot["lifelines"][number] }) {
  const [cost, setCost] = useState(lifeline.cost)
  const [enabled, setEnabled] = useState(lifeline.enabled)

  return (
    <Row
      label={lifeline.id}
      sub={enabled ? "offered in the dock" : "hidden from the dock"}
      onSave={() => setLifelinePrice(lifeline.id, cost, enabled)}
    >
      <Num label="coins" value={cost} onChange={setCost} max={100000} />
      <Check label="enabled" checked={enabled} onChange={setEnabled} />
    </Row>
  )
}

function StoreRow({ item }: { item: EconomySnapshot["store"][number] }) {
  const [price, setPrice] = useState(item.price_coins)
  const [stock, setStock] = useState(item.in_stock)

  return (
    <Row
      label={`${item.icon ?? ""} ${item.name_key}`.trim()}
      sub={item.tab ? `${item.tab} tab` : undefined}
      onSave={() => setStoreItem(item.id, price, stock)}
    >
      <Num label="coins" value={price} onChange={setPrice} />
      <Check label="in stock" checked={stock} onChange={setStock} />
    </Row>
  )
}

function ChestRow({ chest }: { chest: EconomySnapshot["chests"][number] }) {
  const [price, setPrice] = useState(chest.price_coins)
  const [coins, setCoins] = useState(chest.reward_coins)
  const [xp, setXp] = useState(chest.reward_xp)

  return (
    <Row
      label={chest.tier}
      sub={`costs ${chest.price_coins}, pays ${chest.reward_coins} coins and ${chest.reward_xp} XP`}
      onSave={() => setChest(chest.tier, price, coins, xp)}
    >
      <Num label="price" value={price} onChange={setPrice} />
      <Num label="coins" value={coins} onChange={setCoins} />
      <Num label="XP" value={xp} onChange={setXp} />
    </Row>
  )
}

function SpinRow({ reward }: { reward: EconomySnapshot["spin"][number] }) {
  const [value, setValue] = useState(reward.value)
  const [weight, setWeight] = useState(reward.weight)

  return (
    <Row
      label={reward.label}
      sub={`${reward.type} · weight ${reward.weight}`}
      onSave={() => setSpinReward(reward.id, value, weight)}
    >
      <Num label="value" value={value} onChange={setValue} max={100000} />
      <Num label="weight" value={weight} onChange={setWeight} max={1000} width="w-20" />
    </Row>
  )
}
