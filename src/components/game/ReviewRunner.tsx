"use client";

import { useGameReducedMotion } from "@/contexts/GameExperienceContext";
import { PremiumButton } from "@/components/ui/premium-button";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, CalendarCheck, Repeat2, Clock } from "lucide-react";
import type { QuizQuestion } from "@/lib/types";
import type { LifelinePrice } from "@/app/(app)/quiz/actions";
import type { ReviewStatus } from "@/app/(app)/review/actions";
import { HuntView } from "./hunt/HuntView";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReviewRunnerProps {
  questions: QuizQuestion[];
  status: ReviewStatus;
  lifelinePrices: LifelinePrice[];
}

/**
 * The gate in front of a review session, and the empty state when nothing is
 * due. The empty state matters more than it looks: "nothing due" is the correct,
 * healthy outcome of spaced practice, so it should read as finished rather than
 * broken.
 */
export function ReviewRunner({ questions, status, lifelinePrices }: ReviewRunnerProps) {
  const [started, setStarted] = useState(false);
  const { t, dir } = useLanguage();
  const reduce = useGameReducedMotion();

  if (started) {
    return (
      <div dir={dir} className="container mx-auto max-w-3xl px-4 py-6">
        <HuntView
          questions={questions}
          categoryTitle={t("reviewTitle")}
          categoryId={null}
          lifelinePrices={lifelinePrices}
          onExit={() => setStarted(false)}
        />
      </div>
    );
  }

  const nothingDue = questions.length === 0;

  return (
    <div dir={dir} className="container mx-auto max-w-3xl px-4 py-6">
      <header className="mb-8">
        <Button asChild variant="ghost" size="sm">
          <Link href="/home">
            <ArrowLeft className="mr-2 h-4 w-4" />
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
            {nothingDue ? <CalendarCheck className="h-8 w-8" /> : <Repeat2 className="h-8 w-8" />}
          </div>
          <h1 className="font-headline text-3xl text-primary">{t("reviewTitle")}</h1>
          <p className="mx-auto max-w-prose text-on-surface-variant">
            {nothingDue ? t("reviewAllCaughtUp") : t("reviewIntro")}
          </p>
        </div>

        {nothingDue && <div><PremiumButton href="/quiz">{t("exploreSubject")}</PremiumButton></div>}
        <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
          <Stat value={status.due} label={t("reviewDue")} tone="primary" />
          <Stat value={status.scheduled} label={t("reviewScheduled")} tone="muted" />
        </div>

        {nothingDue ? (
          status.nextDueOn && (
            <p className="flex items-center justify-center gap-1.5 text-sm text-on-surface-variant">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {t("reviewNextDue", { date: status.nextDueOn })}
            </p>
          )
        ) : (
          <div className="space-y-3">
            <Button size="lg" className="w-full sm:w-auto" onClick={() => setStarted(true)}>
              <Play className="mr-2 h-5 w-5" />
              {t("reviewStart", { count: questions.length })}
            </Button>
            <p className="text-xs text-on-surface-variant">{t("reviewHowItWorks")}</p>
          </div>
        )}
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
