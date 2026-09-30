"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import type { TranslationWorkerStatus } from "@/app/(app)/admin/translations/worker-status"
import {
  enqueueEverything,
  getTranslations,
  saveTranslation,
} from "@/app/(app)/admin/translations/actions"
import {
  LOCALES,
  type Locale,
  type QueueCell,
  type FailedRow,
  type TranslationRow,
} from "@/app/(app)/admin/translations/locales"

const STATUSES = ["queued", "in_progress", "done", "failed"] as const

export function TranslationsPageClient({
  progress,
  progressError,
  failures,
  publishedQuestions,
  translationsWritten,
  workerStatus,
  workerError,
}: {
  progress: QueueCell[]
  progressError: string | null
  failures: FailedRow[]
  publishedQuestions: number
  translationsWritten: number
  workerStatus: TranslationWorkerStatus | null
  workerError: string | null
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [lookupId, setLookupId] = useState("")
  const [rows, setRows] = useState<TranslationRow[] | null>(null)
  const [draft, setDraft] = useState<Record<string, TranslationRow>>({})

  const cell = (locale: string, status: string) =>
    progress.find((p) => p.locale === locale && p.status === status)?.count ?? 0

  /** Every published question in five languages. */
  const target = publishedQuestions * LOCALES.length

  const handleEnqueue = () => {
    startTransition(async () => {
      const r = await enqueueEverything()
      setMessage(r.ok ? `Queued ${r.queued.toLocaleString()} translations.` : r.error)
    })
  }

  const handleLookup = () => {
    startTransition(async () => {
      const r = await getTranslations(lookupId.trim())
      if (!r.ok) {
        setMessage(r.error)
        setRows(null)
        return
      }
      setRows(r.rows)
      setDraft(Object.fromEntries(r.rows.map((t) => [t.locale, { ...t, choices: [...t.choices] }])))
      setMessage(r.rows.length === 0 ? "No translations for that question yet." : null)
    })
  }

  const handleSave = (locale: string) => {
    const d = draft[locale]
    if (!d) return
    startTransition(async () => {
      const r = await saveTranslation({
        questionId: lookupId.trim(),
        locale: locale as Locale,
        questionText: d.questionText,
        choices: d.choices,
        explanation: d.explanation,
      })
      setMessage(r.ok ? `Saved ${locale}. It will not be overwritten by a machine pass.` : r.error)
    })
  }

  return (
    <div className="min-h-[100dvh] px-5 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link href="/admin" className="text-sm text-on-surface-variant hover:text-on-surface">
          ← Admin
        </Link>
        <h1 className="font-headline-md text-headline-md text-primary">Translations</h1>
        <span className="text-xs text-on-surface-variant">{LOCALES.length} target languages</span>
      </div>

      {message && (
        <div role="status" className="glass-card p-3 mb-6 text-sm text-on-surface">{message}</div>
      )}
      {progressError && (
        <div className="glass-card p-3 mb-6 text-sm text-error">{progressError}</div>
      )}

      <div className="glass-card p-5 mb-6" role="status">
        <h2 className="font-headline-md text-headline-md text-on-surface mb-3">Latest translation batch</h2>
        {workerError ? (
          <p className="text-sm text-error">Could not read worker status: {workerError}</p>
        ) : workerStatus ? (
          <>
            <p className="text-sm text-on-surface">
              {workerStatus.written} written · {workerStatus.rateLimited} rate-limited · {workerStatus.failed} failed
              {" "}out of {workerStatus.claimed} claimed jobs.
            </p>
            <p className="mt-2 text-xs text-on-surface-variant">
              Batch reported {new Date(workerStatus.observedAt).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")} (HTTP {workerStatus.httpStatus}).
            </p>
            {workerStatus.rateLimited > 0 && (
              <p className="mt-3 text-sm text-primary">
                The provider is limiting translation requests. Check this Gemini API key’s quota and billing
                before increasing worker concurrency. Untranslated questions continue to use English.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">No recent batch summary is available. This does not confirm that the worker is healthy.</p>
        )}
      </div>

      <div className="glass-card p-5 mb-6">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <p className="text-2xl font-bold text-primary">{translationsWritten.toLocaleString()}</p>
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">Translations live</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-on-surface">{target.toLocaleString()}</p>
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">
              {publishedQuestions.toLocaleString()} questions × {LOCALES.length} languages
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-on-surface-variant">
          Anything not yet translated shows in English for that language, per question. A partly
          translated bank is a working bank.
        </p>
      </div>

      <div className="glass-card p-5 mb-6 overflow-x-auto">
        <h2 className="font-headline-md text-headline-md text-on-surface mb-3">Queue</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-on-surface-variant">
              <th className="py-1 pr-4 font-normal">Language</th>
              {STATUSES.map((s) => (
                <th key={s} className="py-1 pr-4 font-normal">{s.replace("_", " ")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LOCALES.map(({ code, label }) => (
              <tr key={code} className="border-t border-white/5">
                <td className="py-1.5 pr-4 text-on-surface">{label}</td>
                {STATUSES.map((s) => (
                  <td
                    key={s}
                    className={`py-1.5 pr-4 tabular-nums ${
                      s === "failed" && cell(code, s) > 0 ? "text-error" : "text-on-surface-variant"
                    }`}
                  >
                    {cell(code, s).toLocaleString()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <button
          onClick={handleEnqueue}
          disabled={isPending}
          className="mt-4 rounded-lg bg-primary/20 border border-primary/40 px-4 py-2 text-sm text-primary disabled:opacity-50"
        >
          {isPending ? "Working…" : "Queue every published question"}
        </button>
        <p className="mt-2 text-xs text-on-surface-variant">
          Safe to run more than once. It resets queued and failed rows and skips any translation
          edited by hand. The cron job drains the queue every five minutes.
        </p>
      </div>

      <div className="glass-card p-5 mb-6">
        <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Needs a look</h2>
        <p className="text-xs text-on-surface-variant mb-3">
          Refused by the checks after three attempts, so these questions stay English in that
          language. Not an outage — a queue of improvements.
        </p>
        {failures.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Nothing refused.</p>
        ) : (
          <ul className="space-y-2">
            {failures.map((f) => (
              <li key={`${f.questionId}-${f.locale}`} className="border-t border-white/5 pt-2 text-sm">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-xs uppercase text-primary">{f.locale}</span>
                  <span className="text-on-surface">{f.questionText.slice(0, 90)}</span>
                </div>
                <p className="text-xs text-error mt-0.5">{f.lastError} · {f.attempts} attempts</p>
                <button
                  onClick={() => { setLookupId(f.questionId); setMessage(null) }}
                  className="mt-1 text-xs text-primary underline"
                >
                  Load into the editor
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass-card p-5">
        <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Edit a translation</h2>
        <p className="text-xs text-on-surface-variant mb-3">
          Saving marks a translation as yours. No machine pass will ever overwrite it, and if the
          English changes later it is flagged stale rather than rewritten.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="Question id (uuid)"
            className="flex-1 min-w-[18rem] rounded-lg bg-surface-container-high border border-white/10 px-3 py-2 text-sm text-on-surface"
          />
          <button
            onClick={handleLookup}
            disabled={isPending || !lookupId.trim()}
            className="rounded-lg bg-primary/20 border border-primary/40 px-4 py-2 text-sm text-primary disabled:opacity-50"
          >
            Load
          </button>
        </div>

        {rows?.map((t) => {
          const d = draft[t.locale] ?? t
          return (
            <div key={t.locale} className="border-t border-white/5 py-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-xs uppercase text-primary">{t.locale}</span>
                <span className="text-xs text-on-surface-variant">{t.source}</span>
                {t.isStale && (
                  <span className="rounded bg-warning/15 px-1.5 py-0.5 text-xs text-warning">
                    English changed since this was written
                  </span>
                )}
              </div>

              <textarea
                value={d.questionText}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, [t.locale]: { ...d, questionText: e.target.value } }))
                }
                rows={2}
                className="w-full rounded-lg bg-surface-container-high border border-white/10 px-3 py-2 text-sm text-on-surface mb-2"
              />

              {d.choices.map((c, i) => (
                <input
                  key={i}
                  value={c}
                  onChange={(e) =>
                    setDraft((p) => {
                      const next = [...d.choices]
                      next[i] = e.target.value
                      return { ...p, [t.locale]: { ...d, choices: next } }
                    })
                  }
                  className="w-full rounded-lg bg-surface-container-high border border-white/10 px-3 py-1.5 text-sm text-on-surface mb-1.5"
                />
              ))}

              <textarea
                value={d.explanation ?? ""}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, [t.locale]: { ...d, explanation: e.target.value } }))
                }
                rows={3}
                placeholder="Explanation"
                className="w-full rounded-lg bg-surface-container-high border border-white/10 px-3 py-2 text-sm text-on-surface mt-1"
              />

              <button
                onClick={() => handleSave(t.locale)}
                disabled={isPending}
                className="mt-2 rounded-lg bg-primary/20 border border-primary/40 px-4 py-1.5 text-sm text-primary disabled:opacity-50"
              >
                Save {t.locale}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
