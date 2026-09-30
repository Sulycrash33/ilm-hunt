"use client"

import { useGameReducedMotion as useReducedMotion } from "@/contexts/GameExperienceContext";

import { motion } from "framer-motion";
import { useEffect, useState, useTransition } from "react"
import { BadgeCheck, ChevronLeft, ChevronRight, Loader2, Pencil, X } from "lucide-react"
import { PremiumCard } from "@/components/ui/premium-card"
import { useToast } from "@/hooks/use-toast"
import {
  editQuestion,
  listQuestions,
  setQuestionExplanation,
  reviewQuestion,
  type AdminQuestion,
  type QuestionSummary,
} from "@/app/(app)/admin/questions/actions"

const PAGE_SIZE = 25

interface Props {
  initialQuestions: AdminQuestion[]
  initialTotal: number
  summary: QuestionSummary | null
}

const statusColors: Record<string, string> = {
  published: "bg-success/10 text-success",
  ai_drafted: "bg-info/10 text-info",
  draft: "bg-info/10 text-info",
  rejected: "bg-danger/10 text-danger",
}

/**
 * The question console: all 5,220, not the first 1,000.
 *
 * Every filter and the paging are applied in the database rather than to an
 * array in the browser — the previous version fetched everything and filtered
 * client-side, which is exactly how it ended up showing a fifth of the bank
 * and calling it the whole thing.
 *
 * "Scholar approved" is shown and set separately from the publication status.
 * They are different facts: a question is published so it can be played, and
 * separately vouched for by a person. Conflating them would take the question
 * out of the game the moment it was approved.
 */
export function QuestionsPageClient({ initialQuestions, initialTotal, summary }: Props) {
  const reduce = useReducedMotion()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()

  const [questions, setQuestions] = useState(initialQuestions)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [tier, setTier] = useState("")
  const [status, setStatus] = useState("")
  const [source, setSource] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  /** The question being corrected, held as a draft so an abandoned edit
   *  changes nothing and a saved one replaces the row in place. */
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<{
    text: string
    choices: string[]
    correctIndex: number
    explanation: string
    citation: string
    tier: string
  } | null>(null)

  // Typing a search term should not fire a query per keystroke against a
  // 5,220-row table.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const filterKey = `${debounced}|${categoryId}|${tier}|${status}|${source}`

  // Any change of filter puts us back on the first page: staying on page 40
  // of a result set that now has three pages shows nothing and looks broken.
  useEffect(() => {
    setPage(0)
  }, [filterKey])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listQuestions({
      search: debounced,
      categoryId: categoryId || undefined,
      tier: tier ? Number(tier) : undefined,
      status: status || undefined,
      source: source || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }).then((r) => {
      if (cancelled) return
      setLoading(false)
      if (!r.ok) {
        toast({ variant: "destructive", title: "Could not load questions", description: r.error })
        return
      }
      setQuestions(r.questions)
      setTotal(r.total)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, page])

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const scholarDone = summary
    ? summary.categories.reduce((n, c) => n + c.scholar_approved, 0)
    : 0

  async function act(q: AdminQuestion, opts: { status?: "published" | "rejected"; scholarApproved?: boolean }) {
    if (busy) return
    setBusy(q.id)
    const r = await reviewQuestion(q.id, opts)
    setBusy(null)
    if (!r.ok) {
      toast({ variant: "destructive", title: "That did not work", description: r.error })
      return
    }
    setQuestions((prev) =>
      prev.map((x) =>
        x.id === q.id
          ? {
              ...x,
              status: opts.status ?? x.status,
              scholarApproved: opts.scholarApproved ?? x.scholarApproved,
            }
          : x,
      ),
    )
    startTransition(() => {})
  }

  function beginEdit(q: AdminQuestion) {
    setEditing(q.id)
    setExpanded(q.id)
    setDraft({
      text: q.text,
      choices: [...q.choices],
      correctIndex: q.correctIndex,
      explanation: q.explanation ?? "",
      citation: q.citation ?? "",
      tier: q.tier != null ? String(q.tier) : "",
    })
  }

  async function saveEdit(q: AdminQuestion) {
    if (!draft || busy) return
    setBusy(q.id)

    // Which of the two paths this is depends on what actually changed. If only
    // the explanation or the citation moved, the narrow function is used and
    // scholar approval survives; approval is about the question and its
    // answer, and neither has been touched. Anything else goes through the
    // full editor, which withdraws approval on purpose.
    const onlyProse =
      draft.text === q.text &&
      draft.correctIndex === q.correctIndex &&
      draft.choices.length === q.choices.length &&
      draft.choices.every((c, i) => c === q.choices[i]) &&
      (!draft.tier || Number(draft.tier) === q.tier)

    const r = onlyProse
      ? await setQuestionExplanation(q.id, draft.explanation, draft.citation)
      : await editQuestion({
          id: q.id,
          text: draft.text,
          choices: draft.choices,
          correctIndex: draft.correctIndex,
          explanation: draft.explanation,
          citation: draft.citation,
          tier: draft.tier ? Number(draft.tier) : undefined,
        })
    setBusy(null)
    if (!r.ok) {
      // The database validates this too, and its message names the actual
      // problem — an index past the last choice, a blank option, a tier
      // outside 1 to 9 — so it is shown rather than replaced with a generic.
      toast({ variant: "destructive", title: "That did not save", description: r.error })
      return
    }
    setQuestions((prev) =>
      prev.map((x) =>
        x.id === q.id
          ? {
              ...x,
              text: draft.text,
              choices: draft.choices,
              correctIndex: draft.correctIndex,
              explanation: draft.explanation || null,
              citation: draft.citation || null,
              tier: draft.tier ? Number(draft.tier) : x.tier,
              // Editing the question withdraws scholar approval, because what
              // was vouched for is no longer what the question says. Rewriting
              // only the explanation does not. The server decides this; the row
              // is updated to match, not to decide it.
              scholarApproved: onlyProse ? x.scholarApproved : false,
            }
          : x,
      ),
    )
    setEditing(null)
    setDraft(null)
    toast({ title: "Question saved" })
    startTransition(() => {})
  }

  return (
    <div className="min-h-[100dvh] px-5 py-6 max-w-7xl mx-auto">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-primary mb-2">
          Question Bank
        </h1>
        <p className="text-on-surface-variant">
          {summary ? `${summary.total} questions` : `${total} questions`}
          {summary && ` · ${scholarDone} scholar approved`}
        </p>
      </motion.div>

      {summary && scholarDone === 0 && (
        <PremiumCard className="mb-6 border-warning/30 bg-warning/5 p-4">
          <p className="text-sm text-on-surface">
            No question has been approved by a scholar yet. Filter to{" "}
            <strong>Awaiting review</strong> and work a category at a time. Approving a
            question keeps it published and playable; it only records that a person
            vouched for it.
          </p>
        </PremiumCard>
      )}

      <div className="mb-6 grid gap-3 md:grid-cols-5">
        <input
          type="text"
          placeholder="Search text, explanation or citation..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="md:col-span-2 px-4 py-2 bg-surface-container border border-white/10 rounded-lg text-on-surface placeholder:text-on-surface-variant/50"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Filter by category"
          className="px-4 py-2 bg-surface-container border border-white/10 rounded-lg text-on-surface"
        >
          <option value="">All categories</option>
          {summary?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.scholar_approved}/{c.total})
            </option>
          ))}
        </select>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          aria-label="Filter by tier"
          className="px-4 py-2 bg-surface-container border border-white/10 rounded-lg text-on-surface"
        >
          <option value="">All tiers</option>
          {Array.from({ length: 9 }, (_, i) => i + 1).map((t) => (
            <option key={t} value={t}>Tier {t}</option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="Filter by review state"
          className="px-4 py-2 bg-surface-container border border-white/10 rounded-lg text-on-surface"
        >
          <option value="">Reviewed or not</option>
          <option value="unreviewed">Awaiting review</option>
          <option value="scholar">Scholar approved</option>
        </select>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-on-surface-variant">
          {loading ? "Loading..." : `${total} matching · page ${page + 1} of ${pages}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-white/5 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1 || loading}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-white/5 disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {questions.length === 0 ? (
          <PremiumCard className="p-8 text-center">
            <p className="text-on-surface-variant">Nothing matches those filters.</p>
          </PremiumCard>
        ) : (
          questions.map((q) => (
            <motion.div key={q.id} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <PremiumCard className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                      className="text-left"
                    >
                      <p className="font-medium text-on-surface">{q.text}</p>
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-on-surface-variant">{q.category ?? "Uncategorised"}</span>
                      <span className="text-on-surface-variant/60">·</span>
                      <span className="text-on-surface-variant">Tier {q.tier ?? "—"}</span>
                      <span className="text-on-surface-variant/60">·</span>
                      <span className="text-on-surface-variant">{q.difficulty}</span>
                      <span className={`rounded px-2 py-0.5 ${statusColors[q.status] ?? "bg-white/5 text-on-surface-variant"}`}>
                        {q.status}
                      </span>
                      {q.scholarApproved && (
                        <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-success">
                          <BadgeCheck className="h-3 w-3" aria-hidden="true" /> scholar approved
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => (editing === q.id ? (setEditing(null), setDraft(null)) : beginEdit(q))}
                      aria-label="Edit this question"
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-white/5 disabled:opacity-50"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      {editing === q.id ? "Cancel" : "Edit"}
                    </button>

                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => act(q, { scholarApproved: !q.scholarApproved })}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                        q.scholarApproved
                          ? "border-white/15 text-on-surface-variant hover:bg-white/5"
                          : "border-success/40 text-success hover:bg-success/10"
                      }`}
                    >
                      {busy === q.id
                        ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        : <BadgeCheck className="h-4 w-4" aria-hidden="true" />}
                      {q.scholarApproved ? "Withdraw approval" : "Approve"}
                    </button>

                    {q.status !== "rejected" && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => act(q, { status: "rejected" })}
                        aria-label="Reject this question"
                        className="inline-flex items-center gap-2 rounded-lg border border-error/40 px-3 py-2 text-sm font-semibold text-error transition-colors hover:bg-error/15 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" aria-hidden="true" /> Reject
                      </button>
                    )}
                  </div>
                </div>

                {expanded === q.id && editing !== q.id && (
                  <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-surface-container/50 p-4">
                    <ol className="space-y-1">
                      {q.choices.map((c, i) => (
                        <li
                          key={i}
                          className={`text-sm ${i === q.correctIndex ? "font-semibold text-success" : "text-on-surface-variant"}`}
                        >
                          {String.fromCharCode(65 + i)}. {c}
                          {i === q.correctIndex && " ✓"}
                        </li>
                      ))}
                    </ol>
                    {q.explanation && (
                      <p className="text-sm text-on-surface-variant">
                        <span className="text-on-surface">Explanation: </span>{q.explanation}
                      </p>
                    )}
                    {q.citation && (
                      <p className="text-sm text-on-surface-variant">
                        <span className="text-on-surface">Citation: </span>{q.citation}
                      </p>
                    )}
                  </div>
                )}

                {editing === q.id && draft && (
                  <div className="mt-4 space-y-4 rounded-lg border border-primary/30 bg-surface-container/50 p-4">
                    <label className="block text-sm">
                      <span className="mb-1 block text-on-surface-variant">Question</span>
                      <textarea
                        value={draft.text}
                        onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                        rows={2}
                        className="w-full rounded-lg border border-white/10 bg-surface-container-high px-3 py-2 text-on-surface"
                      />
                    </label>

                    <div className="space-y-2">
                      <span className="block text-sm text-on-surface-variant">
                        Choices. The selected one is the correct answer.
                      </span>
                      {draft.choices.map((c, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={draft.correctIndex === i}
                            onChange={() => setDraft({ ...draft, correctIndex: i })}
                            aria-label={`Mark choice ${String.fromCharCode(65 + i)} correct`}
                            className="h-4 w-4 accent-success"
                          />
                          <span className="w-5 text-sm text-on-surface-variant">
                            {String.fromCharCode(65 + i)}
                          </span>
                          <input
                            value={c}
                            onChange={(e) => {
                              const next = [...draft.choices]
                              next[i] = e.target.value
                              setDraft({ ...draft, choices: next })
                            }}
                            className="flex-1 rounded-lg border border-white/10 bg-surface-container-high px-3 py-2 text-sm text-on-surface"
                          />
                          <button
                            type="button"
                            aria-label={`Remove choice ${String.fromCharCode(65 + i)}`}
                            disabled={draft.choices.length <= 2}
                            title={draft.choices.length <= 2 ? "A question needs at least two choices" : "Remove this choice"}
                            onClick={() => {
                              const next = draft.choices.filter((_, j) => j !== i)
                              // Removing a choice shifts every later one down,
                              // so the correct index moves with it or it ends
                              // up pointing at the wrong answer.
                              const correct =
                                draft.correctIndex === i
                                  ? 0
                                  : draft.correctIndex > i
                                    ? draft.correctIndex - 1
                                    : draft.correctIndex
                              setDraft({ ...draft, choices: next, correctIndex: correct })
                            }}
                            className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-on-surface-variant hover:bg-white/5 disabled:opacity-30"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, choices: [...draft.choices, ""] })}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-on-surface-variant hover:bg-white/5"
                      >
                        Add a choice
                      </button>
                    </div>

                    <label className="block text-sm">
                      <span className="mb-1 block text-on-surface-variant">Explanation</span>
                      <textarea
                        value={draft.explanation}
                        onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
                        rows={3}
                        className="w-full rounded-lg border border-white/10 bg-surface-container-high px-3 py-2 text-on-surface"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm">
                        <span className="mb-1 block text-on-surface-variant">Citation</span>
                        <input
                          value={draft.citation}
                          onChange={(e) => setDraft({ ...draft, citation: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-surface-container-high px-3 py-2 text-on-surface"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-on-surface-variant">Tier (1 to 9)</span>
                        <select
                          value={draft.tier}
                          onChange={(e) => setDraft({ ...draft, tier: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-surface-container-high px-3 py-2 text-on-surface"
                        >
                          <option value="">Leave unchanged</option>
                          {Array.from({ length: 9 }, (_, i) => i + 1).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <p className="text-xs text-on-surface-variant">
                      {draft.text === q.text &&
                      draft.correctIndex === q.correctIndex &&
                      draft.choices.length === q.choices.length &&
                      draft.choices.every((c, i) => c === q.choices[i]) &&
                      (!draft.tier || Number(draft.tier) === q.tier)
                        ? "Only the explanation or citation has changed, so scholar approval is kept: approval is about the question and its answer, and neither has moved."
                        : "Changing the question, its choices, the correct answer or the tier withdraws scholar approval, because what was approved is no longer what the question says."}
                      {" The question stays published and playable throughout."}
                    </p>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => saveEdit(q)}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
                      >
                        {busy === q.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        Save changes
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditing(null); setDraft(null) }}
                        className="rounded-lg border border-white/10 px-4 py-2 text-sm text-on-surface-variant hover:bg-white/5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </PremiumCard>
            </motion.div>
          ))
        )}
      </div>

      {pending && <span className="sr-only">Saving</span>}
    </div>
  )
}
