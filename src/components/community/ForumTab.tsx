"use client"

import { useAsyncAction } from "@/hooks/use-async-action"

import { EmptyState } from "@/components/ui/empty-state"

import { useGameReducedMotion } from "@/contexts/GameExperienceContext"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { BadgeCheck, EyeOff, MessageSquare, Pin, ShieldAlert } from "lucide-react"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumButton } from "@/components/ui/premium-button"
import { PremiumBadge } from "@/components/ui/premium-badge"
import { ReportButton } from "@/components/community/ReportButton"
import { useLanguage } from "@/contexts/LanguageContext"
import {
  createForumReply,
  createForumTopic,
  editOwnPost,
  getForumReplies,
  getForumTopics,
  moderateContent,
  verifyForumReply,
  type ForumReplyView,
  type ForumTopicView,
  type ForumViewerContext,
} from "@/app/(app)/community/forum-actions"

/**
 * The forum.
 *
 * The disclaimer at the top is not decoration. Nothing posted here is reviewed
 * before it is shown, and this app is used by children, so the first thing a
 * reader sees is what the forum is and is not.
 */
export function ForumTab({ viewer }: { viewer: ForumViewerContext }) {
  const { t } = useLanguage()
  const reduce = useGameReducedMotion()
  const [topics, setTopics] = useState<ForumTopicView[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useAsyncAction(() => setError(t("somethingWentWrong")))

  const refresh = () => { setError(null); startTransition(async () => setTopics(await getForumTopics())) }

  useEffect(() => {
    startTransition(async () => setTopics(await getForumTopics()))
  }, [])

  const submitTopic = () => {
    setError(null)
    startTransition(async () => {
      const result = await createForumTopic({ title, body })
      if (!result.success) {
        setError(result.error ?? t("somethingWentWrong"))
        return
      }
      setTitle("")
      setBody("")
      setComposing(false)
      setTopics(await getForumTopics())
    })
  }

  return (
    <div className="space-y-6">
      <div className="glass-card flex items-start gap-3 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-tertiary" aria-hidden="true" />
        <p className="text-sm text-on-surface-variant">{t("forumDisclaimer")}</p>
      </div>

      <div className="flex justify-end">
        <PremiumButton variant="primary" size="sm" onClick={() => setComposing((v) => !v)}>
          {composing ? t("cancel") : t("forumNewTopic")}
        </PremiumButton>
      </div>

      {composing && (
        <motion.div initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass-card space-y-3 p-6">
          <div>
            <label htmlFor="forumTitleLabel" className="mb-1 block text-sm text-on-surface-variant">{t("forumTitleLabel")}</label>
            <input id="forumTitleLabel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("forumTitlePlaceholder")}
maxLength={160}
              className="w-full rounded-lg border border-white/10 bg-surface-container-high px-4 py-2 text-on-surface"
            />
          </div>
          <div>
            <label htmlFor="forumBodyLabel" className="mb-1 block text-sm text-on-surface-variant">{t("forumBodyLabel")}</label>
            <textarea id="forumBodyLabel"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("forumBodyPlaceholder")}
rows={5}
              maxLength={8000}
              className="w-full rounded-lg border border-white/10 bg-surface-container-high px-4 py-2 text-on-surface"
            />
          </div>
          {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</p>}
          <PremiumButton variant="primary" onClick={submitTopic} disabled={isPending || !title.trim() || !body.trim()}>
            {isPending ? t("processingLabel") : t("forumPost")}
          </PremiumButton>
        </motion.div>
      )}

      {error && !composing && <div role="alert" className="rounded-xl border border-error/30 bg-error/10 p-4 space-y-3"><p>{error}</p><PremiumButton size="sm" onClick={refresh} disabled={isPending}>{t("tryAgain")}</PremiumButton></div>}

      {topics === null ? (
        <p className="text-center text-on-surface-variant">{t("loading")}</p>
      ) : topics.length === 0 ? (
        <EmptyState description={t("forumNoTopics")} icon={MessageSquare} action={<PremiumButton size="sm" onClick={() => setComposing(true)}>{t("forumNewTopic")}</PremiumButton>} />
      ) : (
        <div className="space-y-4">
          {topics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              viewer={viewer}
              expanded={openId === topic.id}
              onToggle={() => setOpenId((id) => (id === topic.id ? null : topic.id))}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TopicCard({
  topic,
  viewer,
  expanded,
  onToggle,
  onChanged,
}: {
  topic: ForumTopicView
  viewer: ForumViewerContext
  expanded: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const { t } = useLanguage()
  const reduce = useGameReducedMotion()
  const [replies, setReplies] = useState<ForumReplyView[] | null>(null)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useAsyncAction(() => setError(t("somethingWentWrong")))

  useEffect(() => {
    if (expanded && replies === null) {
      startTransition(async () => setReplies(await getForumReplies(topic.id)))
    }
  }, [expanded, replies, topic.id])

  const reload = () => startTransition(async () => setReplies(await getForumReplies(topic.id)))

  const submitReply = () => {
    setError(null)
    startTransition(async () => {
      const result = await createForumReply(topic.id, draft)
      if (!result.success) {
        setError(result.error ?? t("somethingWentWrong"))
        return
      }
      setDraft("")
      setReplies(await getForumReplies(topic.id))
      onChanged()
    })
  }

  return (
    <PremiumCard className="p-6">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onToggle} aria-expanded={expanded} className="min-h-11 flex-1 text-start">
          <div className="flex items-center gap-2">
            {topic.pinned && <Pin className="h-4 w-4 text-tertiary" aria-hidden="true" />}
            <h3 className="text-lg font-bold text-on-surface">{topic.title}</h3>
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">
            {topic.author.displayName}
            {topic.categoryName && <> · {topic.categoryName}</>}
            {" · "}
            {t("forumRepliesCount", { count: topic.replyCount })}
          </p>
        </button>
        {topic.status !== "visible" && (
          <PremiumBadge variant="warning" size="sm">
            {topic.status === "hidden" ? t("forumHiddenNotice") : t("forumRemovedNotice")}
          </PremiumBadge>
        )}
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          <p className="whitespace-pre-wrap text-sm text-on-surface-variant">{topic.body}</p>

          <PostControls
            kind="forum_topic"
            id={topic.id}
            isMine={topic.isMine}
            status={topic.status}
            isModerator={viewer.isModerator}
            onChanged={onChanged}
          />

          <div className="space-y-3 border-t border-outline-variant/30 pt-4">
            {replies === null ? (
              <p className="text-xs text-on-surface-variant">{t("loading")}</p>
            ) : (
              replies.map((reply) => (
                <div key={reply.id} className="rounded-lg bg-surface-container px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-on-surface">{reply.author.displayName}</span>
                    {reply.verifiedByName && (
                      <span className="inline-flex items-center gap-1 text-xs text-tertiary">
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("forumVerifiedBy", { name: reply.verifiedByName })}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-on-surface-variant">
                    {reply.status === "hidden"
                      ? t("forumHiddenNotice")
                      : reply.status === "removed"
                        ? t("forumRemovedNotice")
                        : reply.body}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <PostControls
                      kind="forum_reply"
                      id={reply.id}
                      isMine={reply.isMine}
                      status={reply.status}
                      isModerator={viewer.isModerator}
                      onChanged={reload}
                    />
                    {viewer.isModerator && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-tertiary hover:underline"
                        onClick={() =>
                          startTransition(async () => {
                            await verifyForumReply(reply.id, !reply.verifiedByName)
                            setReplies(await getForumReplies(topic.id))
                          })
                        }
                      >
                        <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                        {reply.verifiedByName ? t("modUnverify") : t("modVerify")}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {topic.status === "visible" && (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("forumReplyPlaceholder")}
                aria-label={t("forumReplyPlaceholder")}
                rows={3}
                maxLength={8000}
                className="w-full rounded-lg border border-white/10 bg-surface-container-high px-3 py-2 text-sm text-on-surface"
              />
              {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</p>}
              <PremiumButton variant="primary" size="sm" onClick={submitReply} disabled={isPending || !draft.trim()}>
                <MessageSquare className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                {t("forumReply")}
              </PremiumButton>
            </div>
          )}
        </div>
      )}
    </PremiumCard>
  )
}

/** Report / delete / moderate, shared by topics, replies, questions and answers. */
export function PostControls({
  kind,
  id,
  isMine,
  status,
  isModerator,
  onChanged,
}: {
  kind: "forum_topic" | "forum_reply" | "mentor_question" | "mentor_answer"
  id: string
  isMine: boolean
  status: "visible" | "hidden" | "removed"
  isModerator: boolean
  onChanged: () => void
}) {
  const { t } = useLanguage()
  const reduce = useGameReducedMotion()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useAsyncAction(() => setError(t("somethingWentWrong")))

  return (
    <div className="flex flex-wrap items-center gap-3">
      {error && <p role="alert" className="w-full text-sm text-error">{error}</p>}
      {!isMine && <ReportButton kind={kind} id={id} />}

      {isMine && status === "visible" && (
        <button
          type="button"
          disabled={isPending}
          className="min-h-11 text-xs text-on-surface-variant hover:text-error"
          onClick={() =>
            startTransition(async () => {
              const result = await editOwnPost({ kind, id, remove: true })
              if (!result.success) { setError(result.error ?? t("somethingWentWrong")); return }
              onChanged()
            })
          }
        >
          {t("deleteLabel")}
        </button>
      )}

      {isModerator && (
        <button
          type="button"
          disabled={isPending}
          className="inline-flex min-h-11 items-center gap-1 text-xs text-error hover:underline"
          onClick={() =>
            startTransition(async () => {
              const result = await moderateContent({ kind, id, status: status === "hidden" ? "visible" : "hidden" })
              if (!result.success) { setError(result.error ?? t("somethingWentWrong")); return }
              onChanged()
            })
          }
        >
          <EyeOff className="h-3 w-3" aria-hidden="true" />
          {status === "hidden" ? t("modRestore") : t("modHide")}
        </button>
      )}
    </div>
  )
}
