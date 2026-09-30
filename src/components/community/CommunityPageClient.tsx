"use client"

import { useAsyncAction } from "@/hooks/use-async-action"

import { EmptyState } from "@/components/ui/empty-state"

import { useGameReducedMotion } from "@/contexts/GameExperienceContext"

import { PageHeader } from "@/components/layout/PageHeader"
import { Users } from "lucide-react"

import { motion } from "framer-motion"
import Link from "next/link"
import { useState } from "react"
import { PremiumButton } from "@/components/ui/premium-button"
import { CircleCard } from "@/components/community/CircleCard"
import { ForumTab } from "@/components/community/ForumTab"
import { MentorshipTab } from "@/components/community/MentorshipTab"
import type { ForumViewerContext } from "@/app/(app)/community/forum-actions"
import { useLanguage } from "@/contexts/LanguageContext"
import {
  createStudyCircle,
  joinStudyCircle,
  leaveStudyCircle,
  type StudyCircleView,
} from "@/app/(app)/community/actions"

type Tab = "circles" | "forum" | "mentorship"

export function CommunityPageClient({
  circles,
  viewer,
}: {
  circles: StudyCircleView[]
  viewer: ForumViewerContext
}) {
  const { t, dir } = useLanguage()
  const reduce = useGameReducedMotion()
  const [activeTab, setActiveTab] = useState<Tab>("circles")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [maxMembers, setMaxMembers] = useState(20)
  const [weeklyGoal, setWeeklyGoal] = useState(500)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useAsyncAction(() => setError(t("somethingWentWrong")))

  const handleCreate = () => {
    setError(null)
    startTransition(async () => {
      const result = await createStudyCircle({ name, description, maxMembers, weeklyGoal })
      if (result.success) {
        setShowCreateForm(false)
        setName("")
        setDescription("")
        setMaxMembers(20)
        setWeeklyGoal(500)
      } else {
        setError(result.error ?? t("somethingWentWrong"))
      }
    })
  }

  const handleToggleMembership = (circle: StudyCircleView) => {
    if (isPending) return
    setError(null)
    setPendingId(circle.id)
    startTransition(async () => {
      try {
        const result = circle.isMember ? await leaveStudyCircle(circle.id) : await joinStudyCircle(circle.id)
        if (!result.success) setError(result.error ?? t("somethingWentWrong"))
      } finally { setPendingId(null) }
    })
  }

  return (
    <div dir={dir} className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
      <PageHeader title={t("communityTitle")} subtitle={t("communitySubtitle")} icon={Users} />

      <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(["circles", "forum", "mentorship"] as Tab[]).map((tab) => (
          <button
            key={tab}
            aria-pressed={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`min-h-11 shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
              activeTab === tab ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            {tab === "circles" ? t("studyCirclesTab") : tab === "forum" ? t("forum") : t("mentorship")}
          </button>
        ))}
      </motion.div>

      {error && !showCreateForm && <p role="alert" className="mb-4 rounded-xl border border-error/30 bg-error/10 p-4 text-error">{error}</p>}
      {activeTab === "forum" ? (
        <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <ForumTab viewer={viewer} />
        </motion.div>
      ) : activeTab === "mentorship" ? (
        <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <MentorshipTab />
        </motion.div>
      ) : (
        <>
          <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex justify-end mb-6">
            <PremiumButton variant="primary" size="sm" onClick={() => setShowCreateForm((v) => !v)}>
              {showCreateForm ? t("cancel") : t("createACircle")}
            </PremiumButton>
          </motion.div>

          {showCreateForm && (
            <motion.div initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass-card p-6 mb-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="circleNameLabel" className="text-sm text-on-surface-variant mb-1 block">{t("circleNameLabel")}</label>
                  <input id="circleNameLabel"
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("circleNamePlaceholder")}
                    className="w-full px-4 py-2 rounded-lg bg-surface-container-high border border-white/10 text-on-surface"
                  />
                </div>
                <div>
                  <label htmlFor="descriptionLabel" className="text-sm text-on-surface-variant mb-1 block">{t("descriptionLabel")}</label>
                  <input id="descriptionLabel"
                    maxLength={500}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("circleDescPlaceholder")}
                    className="w-full px-4 py-2 rounded-lg bg-surface-container-high border border-white/10 text-on-surface"
                  />
                </div>
                <div>
                  <label htmlFor="maxMembersLabel" className="text-sm text-on-surface-variant mb-1 block">{t("maxMembersLabel")}</label>
                  <input id="maxMembersLabel"
                    type="number"
                    min={2}
                    max={200}
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(Number(e.target.value))}
                    className="w-32 px-4 py-2 rounded-lg bg-surface-container-high border border-white/10 text-on-surface"
                  />
                </div>
                <div>
                  <label htmlFor="circleGoalLabel" className="text-sm text-on-surface-variant mb-1 block">{t("circleGoalLabel")}</label>
                  <input id="circleGoalLabel"
                    type="number"
                    min={100}
                    max={100000}
                    step={50}
                    value={weeklyGoal}
                    onChange={(e) => setWeeklyGoal(Number(e.target.value))}
                    className="w-32 px-4 py-2 rounded-lg bg-surface-container-high border border-white/10 text-on-surface"
                  />
                </div>
                {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</p>}
                <PremiumButton variant="primary" onClick={handleCreate} disabled={isPending || !name.trim() || maxMembers < 2 || maxMembers > 200 || weeklyGoal < 100 || weeklyGoal > 100000}>
                  {isPending ? t("creatingLabel") : t("createCircleButton")}
                </PremiumButton>
              </div>
            </motion.div>
          )}

          {circles.length === 0 ? (
            <EmptyState description={t("noCirclesYet")} icon={Users} action={<PremiumButton size="sm" onClick={() => setShowCreateForm(true)}>{t("createACircle")}</PremiumButton>} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {circles.map((circle, index) => (
                <motion.div key={circle.id} initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                  <CircleCard
                    circle={circle}
                    pending={isPending && pendingId !== null}
                    onToggleMembership={handleToggleMembership}
                    onError={setError}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
