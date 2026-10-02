"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import {
  getHadithTexts,
  saveHadith,
  deleteHadithLocale,
} from "@/app/(app)/admin/hadiths/actions"
import {
  HADITH_LOCALES,
  type HadithLocale,
  type HadithRow,
  type HadithText,
} from "@/app/(app)/admin/hadiths/hadith-locales"

const EMPTY: Record<string, HadithText> = {}

/**
 * The hadith importer.
 *
 * There is no "translate" button here, and that is the point. Questions are
 * machine-translated and published unreviewed; a narration is not, because it
 * is a claim about what the Prophet ﷺ said and published translations of the
 * collections already exist. Text arrives here by hand, from an edition, or it
 * does not arrive — and a language nobody has filled in shows English on the
 * card rather than a machine's guess at a hadith.
 */
export function HadithsPageClient({
  rows,
  listError,
}: {
  rows: HadithRow[]
  listError: string | null
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const operationLock = useRef(false)

  const [editing, setEditing] = useState<HadithRow | null>(null)
  const [reference, setReference] = useState("")
  const [position, setPosition] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [texts, setTexts] = useState<Record<string, HadithText>>(EMPTY)
  const [tab, setTab] = useState<HadithLocale>("en")

  const runOperation = async (operation: () => Promise<void>) => {
    if (operationLock.current) return
    operationLock.current = true
    setIsPending(true)
    setMessage(null)
    try {
      await operation()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not complete this request. Please try again.")
    } finally {
      operationLock.current = false
      setIsPending(false)
    }
  }

  const startNew = () => {
    if (operationLock.current) return
    setEditing(null)
    setReference("")
    setPosition(rows.length)
    setIsActive(true)
    setTexts(EMPTY)
    setTab("en")
    setMessage(null)
  }

  const startEdit = (row: HadithRow) => {
    return runOperation(async () => {
      const r = await getHadithTexts(row.id)
      if (!r.ok) {
        setMessage(r.error)
        return
      }
      setEditing(row)
      setReference(row.reference)
      setPosition(row.position)
      setIsActive(row.isActive)
      setTexts(r.texts as Record<string, HadithText>)
      setTab("en")
    })
  }

  const field = (locale: HadithLocale): HadithText =>
    texts[locale] ?? { text: "", attribution: "" }

  const setField = (locale: HadithLocale, patch: Partial<HadithText>) =>
    setTexts((prev) => ({ ...prev, [locale]: { ...field(locale), ...patch } }))

  const handleSave = () => {
    return runOperation(async () => {
      const r = await saveHadith({
        id: editing?.id,
        reference,
        position,
        isActive,
        texts: texts as Partial<Record<HadithLocale, HadithText>>,
      })
      setMessage(
        r.ok
          ? "Saved. Reload to see it in the list."
          : r.error,
      )
    })
  }

  const handleDeleteLocale = (locale: HadithLocale) => {
    if (!editing) return
    return runOperation(async () => {
      const r = await deleteHadithLocale(editing.id, locale)
      if (!r.ok) {
        setMessage(r.error)
        return
      }
      setTexts((prev) => {
        const next = { ...prev }
        delete next[locale]
        return next
      })
      setMessage(`Removed ${locale}. It falls back to English again.`)
    })
  }

  const activeCount = rows.filter((r) => r.isActive).length

  return (
    <div className="min-h-[100dvh] px-5 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link href="/admin" className="text-sm text-on-surface-variant hover:text-on-surface">
          ← Admin
        </Link>
        <h1 className="font-headline-md text-headline-md text-primary">Daily Hadith</h1>
        <span className="text-xs text-on-surface-variant">
          {activeCount} active — {activeCount === 1 ? "1 day" : `${activeCount} days`} of rotation
        </span>
      </div>

      {message && (
        <div role="status" className="glass-card p-3 mb-6 text-sm text-on-surface">{message}</div>
      )}
      {listError && (
        <div className="glass-card p-3 mb-6 text-sm text-error">{listError}</div>
      )}

      <div className="glass-card p-5 mb-6">
        <p className="text-sm text-on-surface">
          One narration is shown per day, chosen by the date, so every player sees the same one on
          the same day. With {activeCount} active {activeCount === 1 ? "hadith" : "hadiths"} the
          rotation repeats every {activeCount === 1 ? "day" : `${activeCount} days`}.
        </p>
        <p className="mt-3 text-xs text-on-surface-variant">
          Nothing on this page is machine-translated, and there is no button to do so. A hadith is a
          narration with a chain and a grading, and published translations of Bukhari and Muslim
          exist — paste from one. A language left empty shows the English text, which is better than
          showing a translation nobody has checked.
        </p>
      </div>

      <div className="glass-card p-5 mb-6 overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">Narrations</h2>
          <button
            onClick={startNew}
            disabled={isPending}
            className="rounded-lg bg-primary/20 border border-primary/40 px-4 py-2 text-sm text-primary"
          >
            Add a hadith
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-on-surface-variant">None yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-on-surface-variant">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Reference</th>
                <th className="py-2 pr-3">English</th>
                <th className="py-2 pr-3">Languages</th>
                <th className="py-2 pr-3">Active</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-outline/20 align-top">
                  <td className="py-2 pr-3 text-on-surface-variant">{row.position}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-on-surface">{row.reference}</td>
                  <td className="py-2 pr-3 text-on-surface-variant max-w-md">
                    {row.english ? `${row.english.slice(0, 90)}${row.english.length > 90 ? "…" : ""}` : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    {/* Six boxes, one per language, filled where text exists.
                        A row of codes reads faster than a count when what you
                        want to know is which language is missing. */}
                    <span className="font-mono text-xs">
                      {HADITH_LOCALES.map((l) => (
                        <span
                          key={l.code}
                          className={row.locales.includes(l.code) ? "text-primary" : "text-on-surface-variant/40"}
                        >
                          {l.code}{" "}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{row.isActive ? "Yes" : "No"}</td>
                  <td className="py-2">
                    <button
                      onClick={() => startEdit(row)}
                      disabled={isPending}
                      className="text-primary hover:underline disabled:opacity-50"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="glass-card p-5">
        <fieldset disabled={isPending}>
        <legend className="sr-only">Hadith editor</legend>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
          {editing ? `Editing ${editing.reference}` : "New hadith"}
        </h2>

        <div className="flex flex-wrap gap-4 mb-4">
          <label className="text-sm">
            <span className="block text-xs uppercase tracking-wide text-on-surface-variant mb-1">
              Reference
            </span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="bukhari:6029"
              className="rounded-lg bg-surface border border-outline/40 px-3 py-2 font-mono text-sm text-on-surface"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs uppercase tracking-wide text-on-surface-variant mb-1">
              Order
            </span>
            <input
              type="number"
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              className="w-24 rounded-lg bg-surface border border-outline/40 px-3 py-2 text-sm text-on-surface"
            />
          </label>
          <label className="text-sm flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span className="text-on-surface">In the rotation</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {HADITH_LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => setTab(l.code)}
              className={
                tab === l.code
                  ? "rounded-lg bg-primary/20 border border-primary/40 px-3 py-1.5 text-sm text-primary"
                  : "rounded-lg border border-outline/40 px-3 py-1.5 text-sm text-on-surface-variant"
              }
            >
              {l.label}
              {texts[l.code]?.text ? " ●" : ""}
            </button>
          ))}
        </div>

        {HADITH_LOCALES.filter((l) => l.code === tab).map((l) => (
          <div key={l.code} className="space-y-3">
            <label className="block">
              <span className="block text-xs uppercase tracking-wide text-on-surface-variant mb-1">
                {l.label} text
              </span>
              <textarea
                value={field(l.code).text}
                onChange={(e) => setField(l.code, { text: e.target.value })}
                rows={4}
                dir={l.dir}
                className="w-full rounded-lg bg-surface border border-outline/40 px-3 py-2 text-sm text-on-surface"
              />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wide text-on-surface-variant mb-1">
                {l.label} attribution
              </span>
              <input
                value={field(l.code).attribution}
                onChange={(e) => setField(l.code, { attribution: e.target.value })}
                dir={l.dir}
                placeholder={l.code === "en" ? "Sahih al-Bukhari 6029" : "as it is cited in this language"}
                className="w-full rounded-lg bg-surface border border-outline/40 px-3 py-2 text-sm text-on-surface"
              />
            </label>
            {/* The collection's name is translated too, so this is a field and
                not derived from the reference. "Sahih al-Bukhari 6029" under an
                Arabic quotation would be Latin script inside Arabic text — the
                same fault the rank titles still have. */}
            {editing && l.code !== "en" && texts[l.code]?.text && (
              <button
                onClick={() => handleDeleteLocale(l.code)}
                disabled={isPending}
                className="text-sm text-error hover:underline disabled:opacity-50"
              >
                Remove {l.label} — it falls back to English
              </button>
            )}
          </div>
        ))}

        <button
          onClick={handleSave}
          disabled={isPending}
          className="mt-5 rounded-lg bg-primary/20 border border-primary/40 px-4 py-2 text-sm text-primary disabled:opacity-50"
        >
          {isPending ? "Working…" : editing ? "Save changes" : "Add hadith"}
        </button>
        <p className="mt-2 text-xs text-on-surface-variant">
          A language left blank is left alone, not cleared — saving one tab cannot wipe another.
          Use the remove link to take a language out.
        </p>
        </fieldset>
      </div>
    </div>
  )
}
