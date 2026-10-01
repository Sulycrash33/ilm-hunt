"use client";

import { useGameReducedMotion } from "@/contexts/GameExperienceContext";
import { PremiumButton } from "@/components/ui/premium-button";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, CalendarCheck, Repeat2, Clock, LoaderCircle, AlertCircle, BookOpen } from "lucide-react";
import { getReviewSession, type ReviewSession } from "@/app/(app)/review/actions";
import type { ModeRules } from "@/lib/hunt-engine";
import { HuntView } from "./hunt/HuntView";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReviewRunnerProps {
  initialSession: ReviewSession | null;
}

const REVIEW_RULES: ModeRules = { lives: null, runSeconds: null, perQuestionTimer: false, endless: false };

/**
 * The gate in front of a review session, and the empty state when nothing is
 * due. The empty state matters more than it looks: "nothing due" is the correct,
 * healthy outcome of spaced practice, so it should read as finished rather than
 * broken.
 */
export function ReviewRunner({ initialSession }: ReviewRunnerProps) {
  const [started, setStarted] = useState(false);
  const [session, setSession] = useState(initialSession);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(initialSession === null);
  const requestEpoch = useRef(0);
  const requestInFlight = useRef(false);
  const { t, dir, locale } = useLanguage();
  const reduce = useGameReducedMotion();

  useEffect(() => () => { requestEpoch.current++; }, []);

  async function refreshQueue() {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    const epoch = requestEpoch.current;
    setLoading(true);
    setFailed(false);
    try {
      const next = await getReviewSession();
      if (requestEpoch.current === epoch) setSession(next);
    } catch {
      if (requestEpoch.current === epoch) setFailed(true);
    } finally {
      if (requestEpoch.current === epoch) {
        requestInFlight.current = false;
        setLoading(false);
      }
    }
  }

  function returnToQueue() {
    setStarted(false);
    void refreshQueue();
  }
  const questions = session?.questions ?? [];
  const status = session?.status;

  if (started && session) {
    return (
      <div dir={dir} className="container mx-auto max-w-3xl px-4 py-6">
        <HuntView
          questions={questions}
          categoryTitle={t("reviewTitle")}
          categoryId={null}
          lifelinePrices={[]}
          fixedLadder
          preserveQuestionOrder
          modeRules={REVIEW_RULES}
          allowReplay={false}
          exitLabelKey="reviewBackToQueue"
          onExit={returnToQueue}
        />
      </div>
    );
  }

  const nothingDue = questions.length === 0;
  const queueChanged = nothingDue && (status?.due ?? 0) > 0;
  const nextDate = status?.nextDueOn
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" })
        .format(new Date(`${status.nextDueOn}T12:00:00Z`))
    : null;

  return (
    <div dir={dir} className="container mx-auto max-w-3xl px-4 py-6">
      <header className="mb-8">
        <Button asChild variant="ghost" size="sm">
          <Link href="/home">
            <ArrowLeft className={`me-2 h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
            {t("backToDashboard")}
          </Link>
        </Button>
      </header>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-hero space-y-6 p-5 sm:p-8 text-center"
      >
        <div className="space-y-3">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary"
            aria-hidden="true"
          >
            {loading ? <LoaderCircle className="h-8 w-8 animate-spin motion-reduce:animate-none" /> : failed || queueChanged ? <AlertCircle className="h-8 w-8" /> : nothingDue ? <CalendarCheck className="h-8 w-8" /> : <Repeat2 className="h-8 w-8" />}
          </div>
          <h1 className="font-headline text-3xl text-primary">{t("reviewTitle")}</h1>
          <p role={loading ? "status" : failed || queueChanged ? "alert" : undefined} className="mx-auto max-w-prose text-on-surface-variant">
            {loading ? t("reviewLoading") : failed ? t("reviewLoadFailed") : queueChanged ? t("reviewQueueChanged") : nothingDue ? t("reviewAllCaughtUp") : t("reviewIntro")}
          </p>
        </div>

        {loading ? null : failed || queueChanged ? (
          <Button onClick={() => void refreshQueue()}>{t("tryAgain")}</Button>
        ) : status && <>
        {nothingDue && <div className="space-y-3"><p className="text-sm text-on-surface-variant">{t("reviewFreshStart")}</p><PremiumButton href="/quiz">{t("exploreSubject")}</PremiumButton></div>}
        <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
          <Stat value={status.due} label={t("reviewDue")} tone="primary" />
          <Stat value={status.scheduled} label={t("reviewScheduled")} tone="muted" />
        </div>

        {nothingDue ? (
          nextDate && (
            <p className="flex items-center justify-center gap-1.5 text-sm text-on-surface-variant">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {t("reviewNextDue", { date: nextDate })}
            </p>
          )
        ) : (
          <div className="space-y-3">
            <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-xl border border-secondary/25 bg-secondary/10 p-3 text-sm text-secondary"><BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />{t("reviewPace")}</div>
            <Button size="lg" className="w-full sm:w-auto" onClick={() => setStarted(true)}>
              <Play className="me-2 h-5 w-5" />
              {t("reviewStart", { count: questions.length })}
            </Button>
            <p className="text-xs text-on-surface-variant">{t("reviewHowItWorks")}</p>
            {status.due > questions.length && <p className="text-sm text-on-surface-variant">{t("reviewQueueRemaining", { count: status.due - questions.length })}</p>}
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={() => void refreshQueue()}><Repeat2 className="me-2 h-4 w-4" aria-hidden="true" />{t("reviewRefresh")}</Button>
        </>}
      </motion.div>
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "primary" | "muted";
}) {
  return (
    <div className="rounded-lg bg-surface-container-high p-4">
      <div
        className={
          tone === "primary"
            ? "text-3xl font-bold tabular-nums text-primary"
            : "text-3xl font-bold tabular-nums text-on-surface-variant"
        }
      >
        {value}
      </div>
      <div className="text-xs text-on-surface-variant">{label}</div>
    </div>
  );
}
