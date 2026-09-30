"use client"

import { useGameReducedMotion as useReducedMotion } from "@/contexts/GameExperienceContext";

import { motion } from "framer-motion";
import { useState } from "react"
import { PremiumCard } from "@/components/ui/premium-card"
import type { AuditEntry } from "@/app/(app)/admin/audit/actions"

/** What each action reads as, and how alarming it should look. An entry the
 * eye slides past is an entry nobody audits. */
const ACTIONS: Record<string, { label: string; tone: "danger" | "warn" | "info" }> = {
  "user.delete": { label: "Removed an account", tone: "danger" },
  "user.suspend": { label: "Suspended an account", tone: "warn" },
  "user.restore": { label: "Restored an account", tone: "info" },
  "user.role": { label: "Changed a role", tone: "warn" },
  "question.review": { label: "Reviewed a question", tone: "info" },
  "economy.lifeline": { label: "Changed a lifeline price", tone: "warn" },
  "economy.store": { label: "Changed a store price", tone: "warn" },
  "economy.spin": { label: "Changed a spin reward", tone: "warn" },
  "economy.chest": { label: "Changed a chest", tone: "warn" },
  "economy.mode": { label: "Changed a mode multiplier", tone: "warn" },
}

const TONES: Record<string, string> = {
  danger: "border-error/40 bg-error/5",
  warn: "border-warning/30 bg-warning/5",
  info: "border-white/10 bg-surface-container/50",
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

/** Renders the before-and-after pairs the RPCs record, so a row says what
 * changed rather than only that something did. */
function describe(detail: Record<string, unknown>): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  for (const key of Object.keys(detail)) {
    const m = key.match(/^(.*)_(from|to)$/)
    if (!m) continue
    const base = m[1]
    if (seen.has(base)) continue
    seen.add(base)
    const from = detail[`${base}_from`]
    const to = detail[`${base}_to`]
    if (from === undefined && to === undefined) continue
    out.push(`${base.replace(/_/g, " ")}: ${String(from)} → ${String(to)}`)
  }

  if ("from" in detail && "to" in detail && !seen.has("")) {
    out.push(`${String(detail.from)} → ${String(detail.to)}`)
  }
  for (const [k, v] of Object.entries(detail)) {
    if (/_(from|to)$/.test(k) || k === "from" || k === "to") continue
    out.push(`${k.replace(/_/g, " ")}: ${String(v)}`)
  }
  return out
}

/**
 * The audit log.
 *
 * Deliberately has no filter that can hide a destructive action and no way to
 * delete an entry — the value of this page is that it cannot be curated.
 * Admin pages are outside the i18n bundle by convention, so the copy is
 * English.
 */
export function AuditLogClient({ entries, total }: { entries: AuditEntry[]; total: number }) {
  const reduce = useReducedMotion()
  const [filter, setFilter] = useState("all")

  const shown = filter === "all"
    ? entries
    : entries.filter((e) => e.action.startsWith(filter))

  return (
    <div className="min-h-[100dvh] px-5 py-6 max-w-5xl mx-auto">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-primary mb-2">
          Audit Log
        </h1>
        <p className="text-on-surface-variant">
          {total === 0
            ? "Nothing has been recorded yet."
            : `${total} recorded ${total === 1 ? "action" : "actions"}, newest first`}
        </p>
      </motion.div>

      <div className="mb-6 flex justify-center">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter by kind of action"
          className="px-4 py-2 bg-surface-container border border-white/10 rounded-lg text-on-surface"
        >
          <option value="all">Everything</option>
          <option value="user.">Accounts</option>
          <option value="question.">Questions</option>
          <option value="economy.">Economy</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <PremiumCard className="p-8 text-center">
          <p className="text-on-surface-variant">
            {total === 0
              ? "Every account removal, role change, suspension, question review and economy change will appear here."
              : "Nothing of that kind has been recorded."}
          </p>
        </PremiumCard>
      ) : (
        <ul className="space-y-3">
          {shown.map((entry) => {
            const meta = ACTIONS[entry.action] ?? { label: entry.action, tone: "info" as const }
            const lines = describe(entry.detail)
            return (
              <motion.li
                key={entry.id}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl border p-4 ${TONES[meta.tone]}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-on-surface">{meta.label}</p>
                  <p className="text-xs text-on-surface-variant">{when(entry.createdAt)}</p>
                </div>
                {entry.targetLabel && (
                  <p className="mt-1 text-sm text-on-surface-variant break-words">
                    {entry.targetLabel}
                  </p>
                )}
                {lines.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {lines.map((l, i) => (
                      <li key={i} className="text-xs text-on-surface-variant/80">{l}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-on-surface-variant/60">
                  by {entry.actorEmail ?? "an account since removed"}
                </p>
              </motion.li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
