"use client";

import { useGameReducedMotion as useReducedMotion } from "@/contexts/GameExperienceContext";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Trophy, HeartCrack, Flame, Target, Gauge, Sparkles, BookOpen, Check, X, Clock, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Translations } from "@/lib/i18n";
import type { RunSummary as RunSummaryData } from "@/lib/hunt-engine";
import { rankProgress, rankUpBetween } from "@/lib/ranks";
import { useEffect, useRef, useState } from "react";
import { playCue } from "@/lib/sound";
import { playHaptic } from "@/lib/haptics";
import { Celebration } from "@/components/game/Celebration";
import { QuestionTopic } from "./QuestionTopic";

/** One question as the summary retells it. Mirrors the shape HuntView keeps. */
export interface RunReviewEntry {
  stage: number;
  text: string;
  categoryName?: string;
  options: string[];
  chosenIndex: number | null;
  correctIndex: number | null;
  explanation: string;
  citation: string;
  timedOut: boolean;
}

interface RunSummaryProps {
  summary: RunSummaryData;
  /** Profile XP before this run, used to work out the rank climb. */
  xpBefore: number;
  /** Every question of the run, in order, so the screen can teach from it
   *  rather than only score it. Empty for a run that answered nothing. */
  review?: RunReviewEntry[];
  /**
   * Replay this run. **Optional, and absent means the button is not drawn.**
   *
   * The daily challenge passes nothing. Its five questions are the same five
   * all day and its reward is claimed once, so "play again" there invited a
   * player to re-answer questions that, since migration 0059, pay nothing —
   * and before 0059 it was an XP printer: three passes in two and a half
   * minutes took a fresh account to 51% of a rank. Replaying a *level* to
   * learn it is still the point of a study app, so that keeps its button.
   */
  onPlayAgain?: () => void;
  onExit: () => void;
  /** What the exit button says. Named from `backHref` by `backLabelKey` so it
   *  agrees with where `onExit` actually goes; it used to say "Back to
   *  Categories" on every run in the app, the daily challenge included. */
  exitLabelKey?: keyof Translations;
  /**
   * The way forward out of a cleared level. Absent for the classic hunt and
   * for the modes, which have no next level to point at, and absent on a level
   * whose next tier is still locked — the server decides which, not this
   * component. When present it takes the primary slot and demotes "play
   * again", because replaying a beaten tier is what testers did for want of
   * anywhere else to go.
   */
  nextLevelHref?: string | null;
}

/**
 * The payoff screen.
 *
 * The old one showed three numbers, one of which ("coins") was local state that
 * had drifted from the real balance. This one reports what actually happened:
 * XP the server credited, how accurate the run was, the best combo reached, and
 * — the part that makes a run feel like progress rather than a score — where
 * the run left the seeker on the nine-rank climb.
 */
export function RunSummary({
  summary,
  xpBefore,
  review = [],
  onPlayAgain,
  onExit,
  exitLabelKey = "backToCategories",
  nextLevelHref = null,
}: RunSummaryProps) {
  const { t, dir } = useLanguage();
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { summaryHeading.current?.focus(); }, []);
  const [showReview, setShowReview] = useState(false);
  const [mistakesOnly, setMistakesOnly] = useState(false);
  const [shareStatus, setShareStatus] = useState<"progressCopied" | "shareFailed" | null>(null);
  const [sharing, setSharing] = useState(false);
  const mistakes = review.filter(entry => entry.timedOut || entry.correctIndex === null || entry.chosenIndex !== entry.correctIndex);
  const shownReview = mistakesOnly ? mistakes : review;
  async function shareProgress() {
    if (sharing) return;
    setSharing(true);
    setShareStatus(null);
    const text = t("shareProgressText", { xp: summary.xp, accuracy: summary.accuracy });
    try {
      if (navigator.share) await navigator.share({ title: "Ilm Hunt", text });
      else { await navigator.clipboard.writeText(text); setShareStatus("progressCopied"); }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) setShareStatus("shareFailed");
    } finally { setSharing(false); }
  }
  async function copyProgress() {
    try {
      await navigator.clipboard.writeText(t("shareProgressText", { xp: summary.xp, accuracy: summary.accuracy }));
      setShareStatus("progressCopied");
    } catch { setShareStatus("shareFailed"); }
  }
  // The arrow means "onward", so it follows the script rather than the screen.
  const Onward = dir === "rtl" ? ArrowLeft : ArrowRight;
  const won = summary.status === "won";
  const reduce = useReducedMotion();

  const progress = rankProgress(xpBefore + summary.xp);
  const rankedUp = rankUpBetween(xpBefore, summary.xp);

  // The rarest cue in the game — nine times in a whole playthrough. Fires on
  // mount of the summary, once, and only when the run actually promoted them.
  useEffect(() => {
    if (rankedUp) {
      playCue("rankUp");
      playHaptic("rankUp");
    }
  }, [rankedUp]);
  const RankIcon = progress.rank.icon;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-2xl space-y-6"
    >
      {/* Only for a won run. Losing a run is not a moment to throw a party
          over, and the same restraint governs the `levelComplete` sound cue
          a few files away. */}
      <Celebration active={won} pieces={rankedUp ? 260 : 180} />

      <div className="space-y-3 text-center">
        <motion.div
          initial={reduce ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 16 }}
          className={cn(
            "mx-auto flex h-20 w-20 items-center justify-center rounded-full",
            won ? "bg-primary/15 text-primary" : "bg-error/15 text-error",
          )}
        >
          {won ? <Trophy className="h-9 w-9" /> : <HeartCrack className="h-9 w-9" />}
        </motion.div>

        <h2 ref={summaryHeading} tabIndex={-1} className="font-headline text-3xl text-on-surface">
          {won ? t("huntComplete") : t("outOfLives")}
        </h2>

        <p className="mx-auto max-w-lg text-sm leading-relaxed text-on-surface-variant">{t(won ? "successEncouragement" : "learningEncouragement")}</p>

        {summary.flawless && (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-tertiary/15 px-3 py-1 text-sm font-semibold text-tertiary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {t("flawlessRun")}
          </p>
        )}
      </div>

      {/* Promotion, at the size of the thing.

          A rank-up happens nine times in an entire playthrough — the rarest
          event the game has. It used to be announced by a sound cue that is
          off by default and a small pill in the corner of the card below, so
          for most players the biggest moment in ILM Hunt passed without
          anything on screen changing much. It gets its own panel now: the new
          rank's own icon and colour, arriving with weight.

          Deliberately a celebration and not a nag — it marks what was earned
          and says nothing about what is at stake if they stop. */}
      {rankedUp && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 180, damping: 15, delay: 0.25 }}
          className="relative overflow-hidden rounded-2xl border border-tertiary/40 bg-gradient-to-br from-tertiary/20 via-tertiary/5 to-transparent p-5 text-center"
        >
          <motion.div
            initial={reduce ? false : { scale: 0.3, rotate: -14 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.35 }}
            className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-tertiary/20 shadow-[0_0_34px_-4px_rgba(127,212,176,0.4)]"
          >
            <RankIcon className={cn("h-8 w-8", progress.rank.theme)} aria-hidden="true" />
          </motion.div>

          <p className="font-label-caps text-label-caps uppercase tracking-[0.2em] text-tertiary">
            {t("rankUpTitle")}
          </p>
          <p className="font-headline text-2xl text-on-surface">{progress.rank.title}</p>
        </motion.div>
      )}

      {/* What the run actually earned. `xp` is server-credited; `speedScore`
          is a run score and is labelled as pace, never as XP. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Sparkles className="h-4 w-4" />} label={t("xpThisRound")} value={summary.xp} tone="primary" />
        <Stat icon={<Target className="h-4 w-4" />} label={t("accuracy")} value={`${summary.accuracy}%`} tone="secondary" />
        <Stat icon={<Flame className="h-4 w-4" />} label={t("bestComboLabel")} value={summary.bestCombo} tone="tertiary" />
        <Stat icon={<Gauge className="h-4 w-4" />} label={t("paceLabel")} value={summary.speedScore} tone="tertiary" />
      </div>

      <div className="rounded-xl bg-surface-container p-5 text-sm">
        <dl className="grid grid-cols-2 gap-y-3 sm:grid-cols-5">
          <Row label={t("answeredLabel")} value={summary.answered} />
          <Row label={t("correct")} value={summary.correct} />
          <Row label={t("incorrect")} value={summary.wrong} />
          <Row label={t("timesUp")} value={summary.timedOut} />
          <Row label={t("runScoreLabel")} value={summary.runScore} />
        </dl>
      </div>

      {/* The climb. This is the bit that makes one run connect to the next. */}
      <div className="space-y-3 rounded-xl bg-surface-container p-5">
        <div className="flex items-center gap-3">
          <RankIcon className={cn("h-6 w-6", progress.rank.theme)} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-on-surface">{progress.rank.title}</p>
            <p className="text-xs text-on-surface-variant">
              {progress.isMax
                ? t("maxRankReached")
                : t("xpToRank", { xp: progress.xpToNext, rank: progress.next!.title })}
            </p>
          </div>
          {/* The promotion is announced by the panel above; repeating it here
              as a pill said the same thing twice on the one screen where it
              needed saying once, loudly. */}
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest" role="progressbar" aria-label={t("progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.percent)}>
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${progress.percent}%` }}
            transition={{ duration: reduce ? 0 : 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* The round review.
          A tester asked for "an overview of scores after each round and the
          correct answers to each question as well as an explanation" — the
          scores were already here, the questions were not. Collapsed by
          default so the screen still reads as a payoff first; a run of twenty
          would otherwise bury the rank bar under a wall of text. */}
      {review.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowReview((v) => !v)}
            aria-expanded={showReview}
            aria-controls="run-answer-review"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-white/5"
          >
            <BookOpen className="h-4 w-4 text-secondary" aria-hidden="true" />
            {showReview ? t("roundReviewHide") : t("roundReviewShow")}
          </button>

          {showReview && (
            <div id="run-answer-review" className="space-y-3">
              <div className="text-center">
                <h3 className="font-headline text-lg text-on-surface">{t("roundReviewTitle")}</h3>
                <p className="text-xs text-on-surface-variant">{t("roundReviewHint")}</p>
              </div>

              <div className="flex flex-wrap justify-center gap-2" role="group" aria-label={t("roundReviewTitle")}>
                <Button variant={!mistakesOnly ? "default" : "outline"} aria-pressed={!mistakesOnly} onClick={() => setMistakesOnly(false)}>{t("allAnswers")} ({review.length})</Button>
                <Button variant={mistakesOnly ? "default" : "outline"} disabled={mistakes.length === 0} aria-pressed={mistakesOnly} onClick={() => setMistakesOnly(true)}>{t("onlyMistakes")} ({mistakes.length})</Button>
              </div>
              {shownReview.map((entry) => (
                <ReviewCard key={`${entry.stage}-${entry.text.slice(0, 24)}`} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2"><Button variant="outline" className="min-w-0 flex-1" disabled={sharing} onClick={shareProgress}><Share2 className="h-4 w-4" aria-hidden="true" />{t("shareProgress")}</Button><Button variant="ghost" className="min-w-0 flex-1" onClick={copyProgress}>{t("copyProgress")}</Button></div>
        <p role="status" aria-live="polite" className="text-center text-sm text-on-surface-variant">{shareStatus ? t(shareStatus) : ""}</p>
        {nextLevelHref && (
          <Button asChild size="lg" className="w-full">
            <Link href={nextLevelHref}>
              {t("nextLevel")}
              <Onward className="ms-2 h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          {onPlayAgain && (
            <Button
              size="lg"
              variant={nextLevelHref ? "outline" : "default"}
              className="flex-1"
              onClick={onPlayAgain}
            >
              {t("playAgain")}
            </Button>
          )}
          <Button
            size="lg"
            variant={nextLevelHref || onPlayAgain ? "ghost" : "default"}
            className="flex-1"
            onClick={onExit}
          >
            {t(exitLabelKey)}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: "primary" | "secondary" | "tertiary";
}) {
  return (
    <div className="rounded-xl bg-surface-container p-4 text-center">
      <div
        className={cn(
          "mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg",
          tone === "primary" && "bg-primary/15 text-primary",
          tone === "secondary" && "bg-secondary/15 text-secondary",
          tone === "tertiary" && "bg-tertiary/15 text-tertiary",
        )}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="text-2xl font-bold tabular-nums text-on-surface">{value}</div>
      <div className="text-xs text-on-surface-variant">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs text-on-surface-variant">{label}</dt>
      <dd className="font-semibold tabular-nums text-on-surface">{value}</dd>
    </div>
  );
}

/**
 * One question, retold.
 *
 * A timed-out question shows the text and says so rather than revealing the
 * answer. The client is only ever told the right answer by a graded
 * submission, and a run-over endpoint that handed answers back for any
 * question would be a lookup table for the whole bank — a worse trade than
 * the one life a wrong guess currently costs.
 */
function ReviewCard({ entry }: { entry: RunReviewEntry }) {
  const { t } = useLanguage();
  const gotIt = entry.correctIndex !== null && entry.chosenIndex === entry.correctIndex;

  return (
    <div
      className={cn(
        "min-w-0 space-y-2 rounded-xl border p-4 [overflow-wrap:anywhere]",
        entry.timedOut
          ? "border-white/10 bg-surface-container"
          : gotIt
            ? "border-primary/30 bg-primary/5"
            : "border-error/30 bg-error/5",
      )}
    >
      <QuestionTopic name={entry.categoryName} />
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">
          {entry.timedOut ? (
            <Clock className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
          ) : gotIt ? (
            <Check className="h-4 w-4 text-primary" aria-hidden="true" />
          ) : (
            <X className="h-4 w-4 text-error" aria-hidden="true" />
          )}
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium text-on-surface">{entry.text}</p>
      </div>

      <ol className="space-y-1 ps-6">
        {entry.options.map((option, i) => {
          const isCorrect = entry.correctIndex === i;
          const isChosen = entry.chosenIndex === i;
          return (
            <li
              key={i}
              className={cn(
                "text-sm",
                isCorrect
                  ? "font-semibold text-primary"
                  : isChosen
                    ? "text-error line-through"
                    : "text-on-surface-variant",
              )}
            >
              {String.fromCharCode(65 + i)}. {option}
              {isCorrect && ` · ${t("roundReviewCorrectAnswer")}`}
              {isChosen && !isCorrect && ` · ${t("roundReviewYourAnswer")}`}
            </li>
          );
        })}
      </ol>

      {entry.timedOut ? (
        <p className="ps-6 text-xs italic text-on-surface-variant">
          {t("roundReviewNotAnswered")}. {t("roundReviewTimedOutNote")}
        </p>
      ) : (
        entry.explanation && (
          <div className="ps-6">
            <p className="text-sm leading-relaxed text-on-surface-variant">{entry.explanation}</p>
            {entry.citation && (
              <p className="mt-1 text-xs italic text-on-surface-variant/80">
                {t("sourceLabel")}: {entry.citation}
              </p>
            )}
          </div>
        )
      )}
    </div>
  );
}
