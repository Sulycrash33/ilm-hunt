"use client"

import { useAsyncAction } from "@/hooks/use-async-action"

import { EmptyState } from "@/components/ui/empty-state"

import { useGameReducedMotion } from "@/contexts/GameExperienceContext"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { CheckCircle2, GraduationCap, ShieldAlert } from "lucide-react"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumButton } from "@/components/ui/premium-button"
import { PremiumBadge } from "@/components/ui/premium-badge"
import { PostControls } from "@/components/community/ForumTab"
import { useLanguage } from "@/contexts/LanguageContext"
import {
  acceptMentorAnswer,
  answerMentorQuestion,
  applyAsMentor,
  askMentorQuestion,
  getApprovedMentors,
  getMentorAnswers,
  getMentorQuestions,
  getMentorshipContext,
  type MentorAnswerView,
  type MentorProfileView,
  type MentorQuestionView,
  type MentorshipContext,
} from "@/app/(app)/community/mentor-actions"

/**
 * Mentorship, as public question-and-answer.
 *
 * There is no private thread anywhere in this component because there is no
 * private thread in the schema. A learner asks in the open, an approved mentor
 * answers in the open, and any reader can report either. That is a deliberate
 * limit, not an unfinished feature — see the header of migration 0014.
 */
export function MentorshipTab() {
  const { t } = useLanguage()
  const reduce = useGameReducedMotion()
  const [ctx, setCtx] = useState<MentorshipContext | null>(null)
  const [questions, setQuestions] = useState<MentorQuestionView[] | null>(null)
  const [mentors, setMentors] = useState<MentorProfileView[]>([])
  const [asking, setAsking] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useAsyncAction(() => setError(t("somethingWentWrong")))

  const load = () =>
    startTransition(async () => {
      const [c, q, m] = await Promise.all([getMentorshipContext(), getMentorQuestions(), getApprovedMentors()])
      setCtx(c)
      setQuestions(q)
      setMentors(m)
    })

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitQuestion = () => {
    setError(null)
    startTransition(async () => {
      const result = await askMentorQuestion({ title, body })
      if (!result.success) {
        setError(result.error ?? t("somethingWentWrong"))
        return
      }
      setTitle("")
      setBody("")
      setAsking(false)
      setQuestions(await getMentorQuestions())
    })
  }

  if (ctx === null) return error ? <div role="alert" className="glass-card p-5 space-y-3"><p className="text-error">{error}</p><PremiumButton onClick={() => { setError(null); load() }} disabled={isPending}>{t("tryAgain")}</PremiumButton></div> : <p role="status" className="text-center text-on-surface-variant">{t("loading")}</p>

  return (
    <div className="space-y-6">
      <div className="glass-card flex items-start gap-3 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-tertiary" aria-hidden="true" />
        <p className="text-sm text-on-surface-variant">{t("mentorshipIntro")}</p>
      </div>

      <MentorApplication ctx={ctx} onChanged={load} />

      {mentors.length > 0 && (
        <PremiumCard className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-bold text-on-surface">
            <GraduationCap className="h-4 w-4 text-tertiary" aria-hidden="true" />
            {t("mentorsHeading")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {mentors.map((m) => (
              <div key={m.userId} className="rounded-lg bg-surface-container p-3">
                <p className="text-sm font-medium text-on-surface">{m.displayName}</p>
                <p className="mt-1 line-clamp-3 text-xs text-on-surface-variant">{m.bio}</p>
                <p className="mt-1 text-xs text-tertiary">{t("mentorAnswersGiven", { count: m.answersGiven })}</p>
              </div>
            ))}
          </div>
        </PremiumCard>
      )}

      <div className="flex justify-end">
        <PremiumButton variant="primary" size="sm" onClick={() => setAsking((v) => !v)}>
          {asking ? t("cancel") : t("mentorAskQuestion")}
        </PremiumButton>
      </div>

      {asking && (
        <motion.div initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass-card space-y-3 p-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("mentorQuestionPlaceholder")}
                aria-label={t("mentorQuestionPlaceholder")}
            maxLength={160}
            className="w-full rounded-lg border border-white/10 bg-surface-container-high px-4 py-2 text-on-surface"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("mentorDetailPlaceholder")}
                aria-label={t("mentorDetailPlaceholder")}
            rows={4}
            maxLength={4000}
            className="w-full rounded-lg border border-white/10 bg-surface-container-high px-4 py-2 text-on-surface"
          />
          {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</p>}
          <PremiumButton variant="primary" onClick={submitQuestion} disabled={isPending || !title.trim() || !body.trim()}>
            {t("mentorAskQuestion")}
          </PremiumButton>
        </motion.div>
      )}

      {questions === null ? (
        <p className="text-center text-on-surface-variant">{t("loading")}</p>
      ) : questions.length === 0 ? (
        <EmptyState description={t("mentorNoQuestions")} icon={GraduationCap} action={<PremiumButton size="sm" onClick={() => setAsking(true)}>{t("mentorAskQuestion")}</PremiumButton>} />
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <QuestionCard key={q.id} question={q} ctx={ctx} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  )
}

function MentorApplication({ ctx, onChanged }: { ctx: MentorshipContext; onChanged: () => void }) {
  const { t } = useLanguage()
  const reduce = useGameReducedMotion()
  const [open, setOpen] = useState(false)
  const [bio, setBio] = useState(ctx.myApplication?.bio ?? "")
  const [credentials, setCredentials] = useState(ctx.myApplication?.credentials ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useAsyncAction(() => setError(t("somethingWentWrong")))

  const statusKey = {
    pending: "mentorStatusPending",
    approved: "mentorStatusApproved",
    rejected: "mentorStatusRejected",
    paused: "mentorStatusPaused",
  } as const

  const app = ctx.myApplication

  return (
    <PremiumCard className="p-5">
      {app ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <PremiumBadge variant={app.status === "approved" ? "success" : app.status === "rejected" ? "danger" : "secondary"} size="sm">
              {t(statusKey[app.status])}
            </PremiumBadge>
          </div>
          {app.reviewNote && (
            <p className="text-xs text-on-surface-variant">{t("mentorReviewNote", { note: app.reviewNote })}</p>
          )}
          <button type="button" onClick={() => setOpen((v) => !v)} className="min-h-11 text-xs text-primary hover:underline">
            {open ? t("cancel") : t("editLabel")}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen((v) => !v)} className="min-h-11 text-sm font-medium text-primary hover:underline">
          {open ? t("cancel") : t("mentorApply")}
        </button>
      )}

      {open && (
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="mentorBioLabel" className="mb-1 block text-sm text-on-surface-variant">{t("mentorBioLabel")}</label>
            <textarea id="mentorBioLabel"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t("mentorBioPlaceholder")}
rows={3}
              maxLength={2000}
              className="w-full rounded-lg border border-white/10 bg-surface-container-high px-3 py-2 text-sm text-on-surface"
            />
          </div>
          <div>
            <label htmlFor="mentorCredentialsLabel" className="mb-1 block text-sm text-on-surface-variant">{t("mentorCredentialsLabel")}</label>
            <input id="mentorCredentialsLabel"
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              placeholder={t("mentorCredentialsPlaceholder")}
maxLength={2000}
              className="w-full rounded-lg border border-white/10 bg-surface-container-high px-3 py-2 text-sm text-on-surface"
            />
          </div>
          {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</p>}
          <PremiumButton
            variant="primary"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await applyAsMentor({ bio, credentials })
                if (!result.success) {
                  setError(result.error ?? t("somethingWentWrong"))
                  return
                }
                setOpen(false)
                onChanged()
              })
            }
          >
            {t("mentorApplySubmit")}
          </PremiumButton>
        </div>
      )}
    </PremiumCard>
  )
}

function QuestionCard({
  question,
  ctx,
  onChanged,
}: {
  question: MentorQuestionView
  ctx: MentorshipContext
  onChanged: () => void
}) {
  const { t } = useLanguage()
  const reduce = useGameReducedMotion()
  const [open, setOpen] = useState(false)
  const [answers, setAnswers] = useState<MentorAnswerView[] | null>(null)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useAsyncAction(() => setError(t("somethingWentWrong")))

  useEffect(() => {
    if (open && answers === null) {
      startTransition(async () => setAnswers(await getMentorAnswers(question.id)))
    }
  }, [open, answers, question.id])

  const reload = () => startTransition(async () => setAnswers(await getMentorAnswers(question.id)))

  return (
    <PremiumCard className="p-6">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="min-h-11 w-full text-start">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-on-surface">{question.title}</h3>
          <PremiumBadge variant={question.answered ? "success" : "secondary"} size="sm">
            {question.answered ? t("mentorAnswersCount", { count: question.answerCount }) : t("mentorAwaiting")}
          </PremiumBadge>
        </div>
        <p className="mt-1 text-xs text-on-surface-variant">
          {question.askerName}
          {question.categoryName && <> · {question.categoryName}</>}
        </p>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <p className="whitespace-pre-wrap text-sm text-on-surface-variant">{question.body}</p>

          <PostControls
            kind="mentor_question"
            id={question.id}
            isMine={question.isMine}
            status={question.status}
            isModerator={ctx.isModerator}
            onChanged={onChanged}
          />

          <div className="space-y-3 border-t border-outline-variant/30 pt-4">
            {answers === null ? (
              <p className="text-xs text-on-surface-variant">{t("loading")}</p>
            ) : (
              answers.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-lg px-3 py-2 ${a.accepted ? "bg-tertiary/10 ring-1 ring-tertiary/30" : "bg-surface-container"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-on-surface">
                      <GraduationCap className="h-3.5 w-3.5 text-tertiary" aria-hidden="true" />
                      {a.mentorName}
                    </span>
                    {a.accepted && (
                      <span className="inline-flex items-center gap-1 text-xs text-tertiary">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("mentorAccepted")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-on-surface-variant">
                    {a.status === "visible" ? a.body : t("forumHiddenNotice")}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <PostControls
                      kind="mentor_answer"
                      id={a.id}
                      isMine={a.isMine}
                      status={a.status}
                      isModerator={ctx.isModerator}
                      onChanged={reload}
                    />
                    {question.isMine && !a.accepted && a.status === "visible" && (
                      <button
                        type="button"
                        className="text-xs text-tertiary hover:underline"
                        onClick={() =>
                          startTransition(async () => {
                            await acceptMentorAnswer(a.id)
                            setAnswers(await getMentorAnswers(question.id))
                          })
                        }
                      >
                        {t("mentorAcceptAnswer")}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {question.status === "visible" &&
            (ctx.canAnswer ? (
              <div className="space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t("mentorAnswerPlaceholder")}
                aria-label={t("mentorAnswerPlaceholder")}
                  rows={4}
                  maxLength={8000}
                  className="w-full rounded-lg border border-white/10 bg-surface-container-high px-3 py-2 text-sm text-on-surface"
                />
                {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</p>}
                <PremiumButton
                  variant="primary"
                  size="sm"
                  disabled={isPending || !draft.trim()}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await answerMentorQuestion(question.id, draft)
                      if (!result.success) {
                        setError(result.error ?? t("somethingWentWrong"))
                        return
                      }
                      setDraft("")
                      setAnswers(await getMentorAnswers(question.id))
                      onChanged()
                    })
                  }
                >
                  {t("mentorAnswerSubmit")}
                </PremiumButton>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant">{t("mentorOnlyApproved")}</p>
            ))}
        </div>
      )}
    </PremiumCard>
  )
}
