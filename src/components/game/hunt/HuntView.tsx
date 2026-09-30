"use client";

import { useGameReducedMotion as useReducedMotion } from "@/contexts/GameExperienceContext";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { rankFor } from "@/lib/ranks";
import { useProfile } from "@/hooks/use-profile";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Translations } from "@/lib/i18n";
import { playCue } from "@/lib/sound";
import { playHaptic } from "@/lib/haptics";
import type { GradeResult, QuizQuestion } from "@/lib/types";
import {
  applyAnswer,
  applySkip,
  applyTimeout,
  buildFixedLadder,
  buildLadder,
  buildTierLadder,
  currentQuestion,
  initialState,
  isLearningMode,
  type HuntQuestion,
  makeRng,
  spendLifeline as markLifelineSpent,
  summarize,
  endRun,
  comboMultiplier,
  CLASSIC_RULES,
  type HuntState,
  type ModeRules,
} from "@/lib/hunt-engine";
import {
  fiftyFifty,
  getLevelOutcome,
  recordHuntRun,
  spendLifeline,
  submitAnswer,
  type LevelOutcome,
  type LifelinePrice,
} from "@/app/(app)/quiz/actions";
import { AskTheImamDialog } from "../AskTheImamDialog";
import StarParticles from "../StarParticles";
import { HuntHeader } from "./HuntHeader";
import { QuestionCard } from "./QuestionCard";
import { OptionTile, type OptionState } from "./OptionTile";
import { LifelineDock } from "./LifelineDock";
import { RunSummary, type RunReviewEntry } from "./RunSummary";

interface HuntViewProps {
  questions: QuizQuestion[];
  categoryTitle: string;
  categoryId: string | null;
  lifelinePrices: LifelinePrice[];
  onExit: () => void;
  /** Set for a level-locked adventure run: confines the ladder to exactly this
   * tier via `buildTierLadder` instead of the adaptive, rank-anchored
   * `buildLadder` used by the whole-category Hunt. */
  forceTier?: number;
  /**
   * Play exactly the questions handed in, in one fixed order, instead of
   * sampling a ladder out of them. The daily challenge is the only run whose
   * questions were chosen by the server and are the same for every player, and
   * its reward is claimable only once all five have been answered — so the run
   * must serve all five rather than a rank-curved selection of them.
   */
  fixedLadder?: boolean;
  /**
   * Whether the summary offers "play again". True everywhere but the daily
   * challenge, whose five questions are fixed for the day and whose reward is
   * claimed once — see `RunSummary.onPlayAgain`.
   */
  allowReplay?: boolean;
  /** What the exit buttons say. Decided from `backHref` by `backLabelKey`, so
   *  the header link and the summary's button name the same destination. */
  exitLabelKey?: keyof Translations;
  /**
   * The category's URL slug. Only a level run has one, and only a level run
   * can offer a next level — that is why this is optional rather than derived
   * from `categoryId`, which is a uuid and not routable.
   */
  categorySlug?: string;
  /**
   * How this mode plays. Absent means the classic hunt, which is why every
   * existing caller needed no change: `CLASSIC_RULES` is exactly what the
   * engine did before modes existed.
   */
  modeRules?: ModeRules;
  /**
   * The server-side run this play belongs to. Passed through to grading, where
   * the *server* reads the mode off it and decides the XP multiplier. Nothing
   * here can name a multiplier.
   */
  runId?: string | null;
}

/** How long the reveal stays on screen before the next stage. */
const REVEAL_MS = 2600;

/**
 * Drives one hunt.
 *
 * The split of responsibility is deliberate:
 *  - `hunt-engine` owns the run's rules (ladder, combo, lives, adaptivity) and
 *    is pure, so it can be tested without a browser.
 *  - the server owns grading and the XP/coins that actually land on a profile.
 *  - this component owns the clock, the animation, and nothing else that matters.
 *
 * That last point is why the timer lives in a ref-driven interval rather than
 * in engine state: a re-render must never be able to change what a run scored.
 */
export function HuntView({
  questions,
  categoryTitle,
  categoryId,
  lifelinePrices,
  onExit,
  forceTier,
  fixedLadder,
  allowReplay = true,
  exitLabelKey = "backToCategories",
  categorySlug,
  modeRules,
  runId,
}: HuntViewProps) {
  const rules = modeRules ?? CLASSIC_RULES;
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const { profile, refresh: refreshProfile } = useProfile();
  const reduceMotion = useReducedMotion();

  // A run is seeded once per mount (and once per "play again"), so the ladder
  // is stable across re-renders but different every time you play.
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));

  // The ladder is anchored to the seeker's own rank, so a Faqih is asked
  // Faqih-level questions rather than starting every run at Mubtadi. `rankFor`
  // uses the same thresholds as `rank_tiers`, which is what the database
  // derives `profiles.current_rank_id` from. A level-locked run ignores rank
  // entirely — `forceTier` pins the ladder to exactly the level being played.
  const startTier = rankFor(profile?.totalXp ?? 0).level;
  const ladder = useMemo(
    () =>
      fixedLadder
        ? buildFixedLadder(questions)
        : forceTier !== undefined
        ? buildTierLadder(questions, forceTier, { rng: makeRng(seed) })
        : buildLadder(questions, {
            rng: makeRng(seed),
            startTier,
            // An endless mode is only endless if the ladder outlasts the
            // player. Survival ends on lives and Speed Round on the clock, so
            // the ladder has to be long enough that neither run walks off the
            // end of it — the whole pool, rather than the classic ten.
            length: rules.endless ? questions.length : undefined,
          }),
    [questions, seed, startTier, forceTier, fixedLadder, rules.endless],
  );

  const [state, setState] = useState<HuntState>(() => initialState(ladder, rules));
  const [remaining, setRemaining] = useState(() => ladder[0]?.timeLimit ?? 30);
  /** Seconds left on the whole-run clock. Only Speed Round has one. */
  const [runRemaining, setRunRemaining] = useState(() => rules.runSeconds ?? 0);
  const [selected, setSelected] = useState<number | null>(null);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [grading, setGrading] = useState(false);
  const [eliminated, setEliminated] = useState<number[]>([]);
  const [doublePoints, setDoublePoints] = useState(false);
  const [pendingLifeline, setPendingLifeline] = useState<string | null>(null);
  const [showImam, setShowImam] = useState(false);
  const [particles, setParticles] = useState(false);
  /** Set while the reveal is waiting to be dismissed by hand. Only ever true
   *  in a learning mode; elsewhere the reveal still advances on a timer. */
  const [holding, setHolding] = useState(false);
  /** A deliberate stop, offered only where hesitating costs nobody anything. */
  /** Every question of the run, kept so the summary can teach from it. The
   *  engine does not carry this: it is presentation, and `HuntState` should
   *  stay the smallest thing that decides a run. */
  const [review, setReview] = useState<RunReviewEntry[]>([]);
  const [coins, setCoins] = useState(0);
  // Owned lifeline stock, seeded from the server and decremented as it is spent
  // (migration 0008: a stocked lifeline is consumed instead of charged).
  const [stock, setStock] = useState<Record<string, number>>(() =>
    Object.fromEntries(lifelinePrices.map((l) => [l.id, l.owned])),
  );

  // Profile XP as it stood when the run began — the summary needs it to work
  // out how far the run moved the rank bar.
  const xpAtStart = useRef<number | null>(null);

  const question = currentQuestion(state);
  const finished = state.status === "won" || state.status === "lost";
  const locked = selected !== null || grading || finished;

  /** Whether this run holds the reveal and offers a pause. Practice and the
   *  classic level runs do; Survival and Speed Round do not, because both
   *  score the time a player spends thinking. */
  const learning = isLearningMode(rules);

  const questionStartedAt = useRef(Date.now());
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The graded outcome waiting on a dismissal, in a mode that holds the
   *  reveal. Kept in a ref because it is not rendered — only applied. */
  const pendingAdvance = useRef<{ correct: boolean; xpEarned: number; msLeft: number } | null>(null);
  /* The pause tracking that used to live here is gone with the pause button
   * — see the note further down. It refunded paused time to the question
   * clock, which is precisely what made pause an answer-lookup window.
   *  record a response time of several minutes on an attempt. */

  /**
   * The multiplier stepping up, marked.
   *
   * The combo badge already punched on every correct answer, so answer three
   * and answer four looked alike even though the third is where the rate
   * actually changes. This fires only on the step, and only upward: breaking a
   * combo is its own (quieter) event and does not deserve a flourish.
   *
   * In an effect rather than in the answer handler because the multiplier is
   * derived from reducer state, and a cue fired inside a state updater would
   * play twice under React's double invocation. Same trap the round review hit.
   */
  const prevMultiplier = useRef(1);
  useEffect(() => {
    const next = comboMultiplier(state.combo);
    if (next > prevMultiplier.current) {
      playCue("comboUp");
      playHaptic("comboUp");
    }
    prevMultiplier.current = next;
  }, [state.combo]);
  const runRecorded = useRef(false);
  /**
   * Stage the clock has already run out on. Without this the timeout can fire
   * twice for one question and cost two lives: when `applyTimeout` advances the
   * stage, the reset effect and the clock effect run in the same commit, and
   * the clock effect still sees `remaining === 0` from the stage just ended.
   */
  const timedOutStage = useRef(-1);

  useEffect(() => {
    if (!profile) return;
    setCoins(profile.coins);
    if (xpAtStart.current === null) xpAtStart.current = profile.totalXp;
  }, [profile]);

  /** Reset the per-question scratch state whenever a new stage comes up. */
  useEffect(() => {
    if (!question) return;
    setSelected(null);
    setGrade(null);
    setEliminated([]);
    setDoublePoints(false);
    setHolding(false);
    setRemaining(question.timeLimit);
    questionStartedAt.current = Date.now();
  }, [question?.id, question?.stage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  const handleTimeout = useCallback(
    (expired: HuntQuestion) => {
      if (timedOutStage.current === expired.stage) return;
      timedOutStage.current = expired.stage;

      // Recorded here rather than inside the updater below: a state updater
      // must stay pure, and React may call it twice — which would put this
      // question in the review list twice.
      setReview((r) => [
        ...r,
        {
          stage: expired.stage,
          text: expired.text,
          options: expired.options,
          chosenIndex: null,
          correctIndex: null,
          explanation: "",
          citation: "",
          timedOut: true,
        },
      ]);

      setState((prev) => applyTimeout(prev));
      toast({ title: t("timesUp"), variant: "destructive" });
    },
    [toast, t],
  );

  /** The clock. Paused while a reveal is on screen or the run is over, and
   *  absent entirely in modes that do not time individual questions — Practice
   *  has no pressure at all, and Speed Round times the run rather than the
   *  question.
   *
   *  `remaining` is deliberately NOT a dependency. It used to be, which meant
   *  the interval was torn down and recreated on every tick: each new interval
   *  started counting from whenever that render happened, so a tick was never
   *  a whole second after the last one and the error accumulated. `TimerRing`
   *  animates its arc with a 1000ms linear CSS transition, so the ring and the
   *  number drifted apart and the arc visibly stuttered — it would finish its
   *  sweep, sit still, then jump. That is the twitching a tester reported.
   *
   *  One interval per question now, using the functional update so it never
   *  needs to read `remaining`. Reaching zero is watched separately below —
   *  a state updater must stay pure, and React may call it twice. */
  useEffect(() => {
    if (!rules.perQuestionTimer) return;
    if (!question || locked) return;

    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [question, locked, rules.perQuestionTimer]);

  /** Reaching zero, watched apart from the interval that causes it. This does
   *  re-run as `remaining` changes, which is fine: it creates no timer, so
   *  there is nothing to drift. `handleTimeout` is idempotent per stage. */
  useEffect(() => {
    if (!rules.perQuestionTimer) return;
    if (!question || locked) return;
    if (remaining > 0) return;
    handleTimeout(question);
  }, [remaining, question, locked, handleTimeout, rules.perQuestionTimer]);

  /**
   * The last five seconds, heard as well as seen.
   *
   * The `tick` cue has existed in `sound.ts` since the sound system was
   * written and was called from nowhere at all, so the one cue in the game
   * whose own comment describes it repeating had never repeated — or played
   * once. Wiring it is the whole fix.
   *
   * Five, not the ten at which `TimerRing` turns red: the eye gets the first
   * warning and the ear joins for the run-in, which escalates instead of
   * doubling up. Ten ticks in a row on every question of a twenty-question
   * run is also exactly how a player learns to mute a game.
   *
   * In an effect keyed on `remaining` rather than inside the interval's
   * updater, because React may call an updater twice and a cue fired in one
   * would double. That mistake has been made three times in this repository;
   * this is not the fourth.
   */
  useEffect(() => {
    if (!rules.perQuestionTimer) return;
    if (!question || locked) return;
    if (remaining <= 0 || remaining > 5) return;
    playCue("tick");
  }, [remaining, question, locked, rules.perQuestionTimer]);

  /**
   * The run clock, for Speed Round.
   *
   * It runs regardless of the reveal, because the whole point of the mode is
   * that hesitating costs you — but it stops the moment the run is over so a
   * finished summary does not keep counting down behind it. When it reaches
   * zero the run ends as `won`: the player did not fail at anything, they ran
   * out of time, and everything they answered still counts.
   */
  useEffect(() => {
    if (rules.runSeconds === null || finished) return;
    if (runRemaining <= 0) {
      setState((prev) => endRun(prev, "won"));
      return;
    }
    const id = setInterval(() => setRunRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [rules.runSeconds, runRemaining, finished]);

  /**
   * What clearing this level actually earned, asked of the server once the run
   * ends. `null` while it is still being asked, so the banner can wait rather
   * than flash a claim it has not checked — the old one asserted "the next
   * level is unlocked" to every winner, including the ones for whom it wasn't.
   */
  const [outcome, setOutcome] = useState<LevelOutcome | null>(null);

  useEffect(() => {
    if (!finished || state.status !== "won" || forceTier === undefined || !categorySlug) return;
    let live = true;
    // The attempts this run wrote are already in the database — every answer
    // was graded server-side as it was given — so the unlock this reads is the
    // same one `/quiz/[id]/[tier]` will enforce on the way in.
    void getLevelOutcome(categorySlug, forceTier).then((next) => {
      if (live) setOutcome(next);
    });
    return () => {
      live = false;
    };
  }, [finished, state.status, forceTier, categorySlug]);

  /** File the run in the journal once, when it ends. Best-effort: the XP is
   * already banked server-side by then, so a failure here changes nothing the
   * player earned. */
  useEffect(() => {
    if (!finished || runRecorded.current) return;
    runRecorded.current = true;
    // Only for a level run that was actually won — losing a run is not a
    // moment to celebrate, and the adaptive Hunt has no "level" to complete.
    if (forceTier !== undefined && state.status === "won") {
      playCue("levelComplete");
      playHaptic("levelComplete");
    }
    const s = summarize(state);
    void recordHuntRun({
      categoryId,
      status: s.status,
      stages: state.ladder.length,
      correct: s.correct,
      wrong: s.wrong,
      timedOut: s.timedOut,
      bestCombo: s.bestCombo,
      livesLeft: s.livesLeft,
      lifelinesUsed: s.lifelinesUsed,
      xpEarned: s.xp,
      speedScore: s.speedScore,
    });
    void refreshProfile();
  }, [finished, state, categoryId, refreshProfile]);

  const handleAnswer = async (index: number) => {
    if (locked || !question || eliminated.includes(index)) return;

    setSelected(index);
    setGrading(true);

    // Measured from the real elapsed time, not the once-a-second display
    // counter, so the pace score reflects when the player actually committed.
    // `remaining` can exceed the limit after a Time Boost, hence the cap.
    const elapsedMs = Date.now() - questionStartedAt.current;
    const budgetMs = Math.max(question.timeLimit, remaining) * 1000;
    const msLeft = Math.max(0, budgetMs - elapsedMs);

    try {
      // Neither the hint nor the double-points power-up is reported here any
      // more. The server reads both off the lifeline ledger it wrote itself
      // when the spend was charged (migration 0034) — `doublePoints` below is
      // now only what the *screen* shows, and cannot pay anyone.
      const result = await submitAnswer(question.id, index, {
        responseTimeMs: elapsedMs,
        // The server reads this run's mode and applies its multiplier. Null in
        // the classic hunt, which is what keeps that path byte-identical.
        runId,
      });
      setGrade(result);
      setGrading(false);
      // Keep the coin counter honest: the server credits coins per answer, and
      // a header showing a stale balance is what made the old lifeline dock lie.
      void refreshProfile();

      playCue(result.correct ? "correct" : "wrong");
      playHaptic(result.correct ? "correct" : "wrong");

      // Congratulate in the run, not days later on the profile page. The cue
      // is deliberately the rank-up one — an achievement is rare enough to
      // deserve the fuller sound, and it is staggered behind the answer cue so
      // the two don't collide.
      if (result.newAchievements.length > 0) {
        result.newAchievements.forEach((earned, i) => {
          setTimeout(() => {
            toast({
              title: `${earned.icon} ${t("achievementUnlocked")}`,
              description: `${earned.name}: ${earned.description}`,
            });
          }, 450 + i * 900);
        });
        setTimeout(() => {
          playCue("rankUp");
          playHaptic("rankUp");
        }, 450);
      }

      // A chest is rarer than an achievement — the cheapest is a thirty day
      // streak or 250 correct answers (migration 0061) — so it is announced
      // here rather than found later, and it says where it went. It is opened
      // on `/achievements` and not mid-run: the reveal deserves the player's
      // attention, and a run has a clock.
      if (result.newChests.length > 0) {
        const delay = 450 + result.newAchievements.length * 900;
        setTimeout(() => {
          toast({
            title: `\u{1F381} ${t("chestEarnedTitle")}`,
            description: t("chestEarnedBody"),
          });
          playCue("rankUp");
          playHaptic("rankUp");
        }, delay);
      }

      if (result.correct) {
        setParticles(true);
        setTimeout(() => setParticles(false), 1000);
      }

      setReview((prev) => [
        ...prev,
        {
          stage: question.stage,
          text: question.text,
          options: question.options,
          chosenIndex: index,
          correctIndex: result.correctIndex,
          explanation: result.explanation,
          citation: result.citation,
          timedOut: false,
        },
      ]);

      // In a learning mode the reveal waits for the player. Everywhere else it
      // still advances on its own, because a mode that scores hesitation
      // cannot also let you stop the world to read.
      if (learning) {
        setHolding(true);
        pendingAdvance.current = { correct: result.correct, xpEarned: result.xpEarned, msLeft };
        return;
      }

      advanceTimer.current = setTimeout(() => {
        setState((prev) =>
          applyAnswer(prev, { correct: result.correct, xpEarned: result.xpEarned, msLeft }),
        );
      }, REVEAL_MS);
    } catch {
      // Grading failed — give the question back rather than silently eating
      // the attempt or, worse, counting it as wrong.
      setSelected(null);
      setGrading(false);
      toast({ title: t("error"), description: t("couldNotLoadQuestion"), variant: "destructive" });
    }
  };

  /**
   * Buy and apply a lifeline.
   *
   * Charge first, effect second, and never the other way round: if the spend
   * fails for any reason — not enough coins, RPC missing, network — the effect
   * must not happen. Lifelines used to be free precisely because the effect ran
   * without the server ever hearing about it.
   */
  const handleLifeline = async (id: string) => {
    if (locked || pendingLifeline || !question || state.lifelinesUsed.includes(id)) return;

    const price = lifelinePrices.find((l) => l.id === id);
    if (!price) return;
    // A stocked copy is spent instead of coins, so a low balance is no bar.
    if ((stock[id] ?? 0) === 0 && coins < price.cost) {
      toast({ title: t("notEnoughCoins"), variant: "destructive" });
      return;
    }

    setPendingLifeline(id);
    const spend = await spendLifeline(id, question.id, runId);
    setPendingLifeline(null);

    if (!spend.success) {
      if (spend.newBalance !== undefined) setCoins(spend.newBalance);
      toast({
        title: t("lifelineUnavailable"),
        description: spend.error,
        variant: "destructive",
      });
      return;
    }

    if (spend.newBalance !== undefined) setCoins(spend.newBalance);
    if (spend.paidWith === "inventory") {
      setStock((prev) => ({ ...prev, [id]: spend.remaining ?? Math.max(0, (prev[id] ?? 1) - 1) }));
      toast({ title: t("usedFromStock") });
    }
    setState((prev) => markLifelineSpent(prev, id));

    switch (id) {
      case "fifty-fifty":
        try {
          setEliminated(await fiftyFifty(question.id));
        } catch {
          toast({ title: t("error"), variant: "destructive" });
        }
        break;
      case "ask-imam":
        setShowImam(true);
        break;
      case "skip":
        setState((prev) => applySkip(prev));
        break;
      case "double-points":
        setDoublePoints(true);
        break;
      case "time-boost":
        setRemaining((r) => r + 15);
        break;
    }

    void refreshProfile();
  };

  /**
   * Dismisses a held reveal and lets the run continue.
   *
   * The outcome was decided the moment the answer was graded; this only
   * releases it. Reading for a minute cannot change what the run scored,
   * which is why holding the reveal is safe in the first place.
   */
  const dismissReveal = () => {
    const pending = pendingAdvance.current;
    pendingAdvance.current = null;
    setHolding(false);
    if (!pending) return;
    setState((prev) => applyAnswer(prev, pending));
  };

  const playAgain = () => {
    runRecorded.current = false;
    setOutcome(null);
    xpAtStart.current = profile?.totalXp ?? xpAtStart.current;
    setReview([]);
    setHolding(false);
    pendingAdvance.current = null;
    setSeed(Math.floor(Math.random() * 2 ** 31));
  };

  // A fresh seed rebuilds the ladder; reset the run to match it. Stage numbers
  // restart at 1 on a replay, so the timeout guard has to be cleared too.
  useEffect(() => {
    setState(initialState(ladder, rules));
    setOutcome(null);
    setRemaining(ladder[0]?.timeLimit ?? 30);
    setRunRemaining(rules.runSeconds ?? 0);
    timedOutStage.current = -1;
    setReview([]);
    setHolding(false);
    pendingAdvance.current = null;
  }, [ladder]);

  if (ladder.length === 0) {
    return (
      <div dir={dir} className="flex flex-col items-center justify-center p-8 text-center">
        <h2 className="mb-2 font-headline text-2xl">{t("comingSoon")}</h2>
        <p className="text-on-surface-variant">
          {t("questionsBeingPrepared", { category: categoryTitle })}
        </p>
        <Button onClick={onExit} className="mt-6">
          {t(exitLabelKey)}
        </Button>
      </div>
    );
  }

  const isLevelWin = forceTier !== undefined && state.status === "won" && !!categorySlug;
  // The link appears only when the server says the next tier is open. A won
  // run is not a cleared level: the unlock wants every question in the tier
  // answered correctly, and this run may have dropped one.
  const nextLevelHref =
    isLevelWin && outcome?.next?.unlocked ? `/quiz/${categorySlug}/${outcome.next.tier}` : null;

  if (finished) {
    return (
      <div dir={dir} className="py-4">
        {isLevelWin && outcome && (
          <p
            className={`mb-4 rounded-xl px-4 py-3 text-center text-sm font-semibold ${
              nextLevelHref
                ? "bg-primary/10 text-primary"
                : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {nextLevelHref
              ? `\u{1F513} ${t("levelComplete")}`
              : outcome.next === null
                ? `\u{1F3C1} ${t("finalLevelComplete")}`
                : t("levelUnlockProgress", {
                    correct: outcome.current.correctCount,
                    total: outcome.current.publishedCount,
                  })}
          </p>
        )}
        <RunSummary
          summary={summarize(state)}
          review={review}
          xpBefore={xpAtStart.current ?? 0}
          onPlayAgain={allowReplay ? playAgain : undefined}
          exitLabelKey={exitLabelKey}
          onExit={onExit}
          nextLevelHref={nextLevelHref}
        />
      </div>
    );
  }

  if (!question) {
    return (
      <div dir={dir} className="flex flex-col items-center justify-center p-8 text-center">
        <h2 className="mb-2 font-headline text-2xl">{t("couldNotLoadQuestion")}</h2>
        <Button onClick={onExit} className="mt-6">
          {t(exitLabelKey)}
        </Button>
      </div>
    );
  }

  return (
    <div dir={dir} className="relative space-y-6">
      <StarParticles isEmitting={particles} />

      {/* What the answer was worth, said out loud.
          The gold particles already fired on a correct answer, but nothing
          ever showed the number: XP moved silently in the header and the
          player never saw the one figure the whole run is scored on. It rises
          and fades over the question, keyed to the question so a fresh one
          re-fires it. Digits and a plus sign carry across all six locales, so
          this needs no new string. */}
      <AnimatePresence>
        {grade?.correct && grade.xpEarned > 0 && (
          <motion.div
            key={`xp-${question?.id ?? "none"}`}
            /* Reduced motion keeps the number and drops the travel. The figure
               is the information; the rise is decoration. Everything else on
               this screen honours the preference and this did not. */
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.85 }}
            animate={
              reduceMotion
                ? { opacity: [0, 1, 1, 0] }
                : { opacity: [0, 1, 1, 0], y: -34, scale: 1 }
            }
            transition={{ duration: 1.5, times: [0, 0.15, 0.7, 1], ease: "easeOut" }}
            className="pointer-events-none absolute left-1/2 top-16 z-30 -translate-x-1/2 select-none"
            aria-hidden="true"
          >
            <span className="rounded-full bg-primary/15 px-3 py-1 font-bold text-headline-md text-primary tabular-nums drop-shadow-[0_0_14px_currentColor]">
              +{grade.xpEarned}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("exitQuiz")}
        </Button>
        <span className="truncate text-sm text-on-surface-variant">{categoryTitle}</span>
      </div>

      <HuntHeader
        stage={state.stage}
        totalStages={state.ladder.length}
        lives={state.lives}
        maxLives={rules.lives}
        /* The run clock never freezes for the reveal: hesitating is exactly
           what Speed Round charges for. The per-question clock still does. */
        clock={rules.runSeconds !== null ? "run" : rules.perQuestionTimer ? "question" : "none"}
        coins={coins}
        combo={state.combo}
        tier={question.difficulty}
        remaining={rules.runSeconds !== null ? runRemaining : remaining}
        timeLimit={rules.runSeconds ?? question.timeLimit}
        frozen={rules.runSeconds !== null ? false : locked}
      />

      <QuestionCard text={question.text} questionId={question.id} />

      {doublePoints && (
        <p className="text-center text-sm font-semibold text-tertiary">
          💎 {t("lifelineDoublePoints")}
        </p>
      )}

      <div className="grid gap-3">
        {question.options.map((option, index) => (
          <OptionTile
            key={`${question.id}-${index}`}
            label={option}
            index={index}
            disabled={locked}
            pending={grading && selected === index}
            state={optionState({ index, selected, grade, eliminated })}
            onSelect={() => handleAnswer(index)}
          />
        ))}
      </div>

      <p role="status" aria-live="polite" aria-atomic="true" className="min-h-5 text-center text-sm text-on-surface-variant">{grading ? t("checkingAnswer") : grade ? t(grade.correct ? "correct" : "incorrect") : ""}</p>

      {/* The pause button is gone. It stopped a clock that is being scored.

          `setPausedTracking` handed the paused span back to the question's
          timer, so pause did not freeze a question — it converted a timed
          question into an untimed one, in one press, by design. Read the
          question, pause, look the answer up, resume with the clock where you
          left it. That is not a player abusing an oversight; it is the button
          doing exactly what it was built to do.

          It only ever existed in the two places that score the clock: classic
          level runs and the daily challenge. Practice — the mode built for
          unpressured learning — has `per_question_timer: false`, so it has no
          clock and never had a pause, and a player who needs to stop and think
          already has a home there. Removing this costs nothing Practice does
          not already do better.

          What it does NOT do is prevent cheating: a second browser tab reaches
          the same answer with the clock running. What it removes is the
          sanctioned, one-press, in-app version — and an exploit the app hands
          you a button for reads as permission.
 */}

      <AnimatePresence>
        {grade && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl border border-secondary/30 bg-secondary/10 p-4"
          >
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-secondary" aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold text-secondary">{t("whyItsRight")}</p>
                {/* Capped and scrollable so a long explanation can be read in
                    place instead of pushing the Continue button off screen. */}
                <div className="max-h-56 overflow-y-auto pe-1">
                  <p className="text-sm leading-relaxed text-on-surface">{grade.explanation}</p>
                  {grade.citation && (
                    <p className="mt-1 text-xs italic text-on-surface-variant">
                      {t("sourceLabel")}: {grade.citation}
                    </p>
                  )}
                </div>
              </div>

              {/* The X only exists where the reveal waits. In a timed mode it
                  would promise a control over a panel that is leaving anyway. */}
              {holding && (
                <button
                  type="button"
                  onClick={dismissReveal}
                  aria-label={t("dismissExplanation")}
                  className="-me-1 -mt-1 shrink-0 rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-white/10 hover:text-on-surface"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>

            {holding && (
              <Button onClick={dismissReveal} className="mt-4 h-11 w-full">
                {t("continueLabel")}
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <LifelineDock
        prices={lifelinePrices.map((l) => ({ ...l, owned: stock[l.id] ?? 0 }))}
        coins={coins}
        used={state.lifelinesUsed}
        locked={locked}
        pending={pendingLifeline}
        onUse={handleLifeline}
      />

      <AskTheImamDialog open={showImam} onOpenChange={setShowImam} question={question} />
    </div>
  );
}

/** Which of the five visual states an option is in, given the current reveal. */
function optionState({
  index,
  selected,
  grade,
  eliminated,
}: {
  index: number;
  selected: number | null;
  grade: GradeResult | null;
  eliminated: number[];
}): OptionState {
  if (!grade) return eliminated.includes(index) ? "eliminated" : "idle";
  if (index === grade.correctIndex) return selected === index ? "correct" : "missed";
  if (index === selected) return "wrong";
  return eliminated.includes(index) ? "eliminated" : "idle";
}
