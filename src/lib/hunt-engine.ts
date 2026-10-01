/**
 * The Hunt engine.
 *
 * A "hunt" is one run through a category: a fixed-length ladder of questions
 * whose difficulty adapts to how the seeker is actually doing, scored with a
 * combo multiplier and a speed bonus, and ended by either finishing the ladder
 * or running out of lives.
 *
 * This module is deliberately pure — no React, no Supabase, no `Date.now()`.
 * Every function takes the state it needs and returns new state, so the whole
 * run loop can be exercised without a browser or a database. The UI layer owns
 * the clock; the server still owns grading and the XP that actually lands on a
 * profile (see `submit_quiz_answer`). What the engine computes is the *run*:
 * which question comes next, what the combo is worth, and how the run ended.
 */

import type { QuizQuestion } from './types';

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export const DIFFICULTY_ORDER: Difficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

/**
 * The nine ranks, as question difficulty.
 *
 * A seeker climbs Mubtadi → Mujaddid, and questions are pitched at those same
 * nine levels (`questions.tier`, migration 0019). The ladder used to run on the
 * three-way easy/medium/hard band, which meant a Mujaddid and a Talib drew from
 * the same "hard" pile. Tiers are what the ladder climbs now; `difficulty`
 * survives for display and for the XP the server grants.
 */
export const TIER_MIN = 1;
export const TIER_MAX = 9;

export function clampTier(tier: number): number {
  if (!Number.isFinite(tier)) return TIER_MIN;
  return Math.min(TIER_MAX, Math.max(TIER_MIN, Math.round(tier)));
}

/** Tuning knobs for a run. Kept in one place so balance changes are one edit. */
export const HUNT_RULES = {
  /** Questions in a full run, when the category has enough published content. */
  runLength: 10,
  /** A run needs at least this many questions to be worth starting. */
  minRunLength: 3,
  /** Lives a seeker starts with. Wrong answers and timeouts cost one. */
  startingLives: 3,
  /** Seconds on the clock, per difficulty. Harder questions get more thinking time. */
  timeLimit: { Beginner: 25, Intermediate: 30, Advanced: 40 } as Record<Difficulty, number>,
  /** Seconds at tier 1 and at tier 9; tiers between are interpolated. */
  tierTimeLimit: { min: 25, max: 45 },
  /** Correct answers in a row before the combo steps up. */
  comboStep: 3,
  /** Combo multiplier ceiling. Mirrors REWARD_RULES.maxStreakMultiplier. */
  maxCombo: 3,
  /**
   * Answering inside this fraction of the clock earns the full speed bonus;
   * the bonus decays linearly to zero at the buzzer.
   */
  speedBonusWindow: 0.5,
  /** Speed bonus as a fraction of the question's base points. */
  speedBonusMax: 0.5,
  /** Correct answers in a row before the ladder offers something harder. */
  promoteAfter: 2,
  /** Wrong answers in a row before the ladder eases off. */
  demoteAfter: 1,
} as const;

export interface HuntQuestion extends QuizQuestion {
  /** Position in the run, 1-based. */
  stage: number;
}

export type HuntStatus = 'idle' | 'playing' | 'won' | 'lost';

export interface HuntState {
  /** The questions chosen for this run, in order. */
  ladder: HuntQuestion[];
  /** Review queues retain their due-date order after both hits and misses. */
  preserveOrder?: boolean;
  /** Index into `ladder` of the question on screen. */
  stage: number;
  status: HuntStatus;
  lives: number;
  /** Consecutive correct answers. Resets to 0 on a miss or a timeout. */
  combo: number;
  /** Highest combo reached this run — what the summary brags about. */
  bestCombo: number;
  /** XP the server has credited so far this run. */
  xp: number;
  /**
   * Run score from answering fast. This is NOT profile XP — the server alone
   * decides what lands on a profile (see `submit_quiz_answer`), and anything
   * the client tallies is forgeable. It scores the run, nothing more.
   */
  speedScore: number;
  correct: number;
  wrong: number;
  /** Questions the clock ran out on. Counted separately from wrong answers. */
  timedOut: number;
  /** Lifeline ids already spent this run. Each is once per run. */
  lifelinesUsed: string[];
  /** Rank tier the ladder is currently offering, 1-9. */
  tier: number;
  /** Rolling run of correct answers at the current tier, for promotion. */
  tierRun: number;
  /** Rolling run of misses, for demotion. */
  missRun: number;
}

/**
 * Mulberry32 — a small seedable PRNG. Seeding matters here: a run is built on
 * the client but has to be reproducible for tests, and `Math.random()` in
 * render would reshuffle the ladder on every re-render.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates, non-mutating. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build the ladder for a run.
 *
 * The shape we want is a climb, so a run has an arc instead of being a flat bag
 * of questions. The climb is now anchored to the seeker: a Faqih starts near
 * Faqih-level questions rather than always starting at Mubtadi. We take the
 * pool, split it by tier, shuffle each bucket, then fill each stage from the
 * tier that stage *wants* — falling back to the nearest tier that still has
 * questions left.
 *
 * That fallback is doing real work. Nine tiers across twenty-five categories is
 * 225 buckets and most are empty (migration 0019), so a category may hold
 * nothing at all at the seeker's own tier. Widening outward keeps every
 * category playable at every rank instead of producing a half-length run or
 * none at all.
 */
export function buildLadder(
  pool: readonly QuizQuestion[],
  opts: { length?: number; rng?: () => number; startTier?: number } = {},
): HuntQuestion[] {
  const rng = opts.rng ?? makeRng(Date.now());
  const target = Math.min(opts.length ?? HUNT_RULES.runLength, pool.length);
  if (target === 0) return [];

  const startTier = clampTier(opts.startTier ?? TIER_MIN);

  const buckets = new Map<number, QuizQuestion[]>();
  for (let t = TIER_MIN; t <= TIER_MAX; t += 1) buckets.set(t, []);
  pool.forEach((q) => buckets.get(clampTier(q.tier))!.push(q));
  buckets.forEach((list, t) => buckets.set(t, shuffle(list, rng)));

  const ladder: HuntQuestion[] = [];
  for (let i = 0; i < target; i += 1) {
    const wanted = curveTier(i, target, startTier);
    const picked = takeNearestTier(buckets, wanted);
    if (!picked) break;
    ladder.push({
      ...picked,
      stage: ladder.length + 1,
      timeLimit: timeLimitForTier(picked.tier),
    });
  }
  return ladder;
}

/**
 * Build a ladder confined to one tier — the run mode behind the level-locked
 * adventure path, where a category is nine discrete levels (one per rank
 * tier) instead of one adaptive climb.
 *
 * Unlike `buildLadder`, there is deliberately no cross-tier fallback: a level
 * is that tier's own questions, shuffled, capped at `runLength` (or shorter,
 * if the tier does not have that many published yet). A tier with no
 * questions returns an empty ladder rather than borrowing from a neighbor —
 * borrowing here would let a player "complete" a level without ever seeing
 * that level's own material, which defeats the point of gating on it.
 */
export function buildTierLadder(
  pool: readonly QuizQuestion[],
  tier: number,
  opts: { length?: number; rng?: () => number } = {},
): HuntQuestion[] {
  const rng = opts.rng ?? makeRng(Date.now());
  const t = clampTier(tier);
  const bucket = shuffle(
    pool.filter((q) => clampTier(q.tier) === t),
    rng,
  );
  // A level run is the WHOLE tier — all 20 questions — not the 10-question
  // `HUNT_RULES.runLength` the adaptive Hunt uses. A level is only complete
  // once every question in it has been answered correctly, so serving half
  // the tier per run would mean the other half could only ever turn up by
  // chance on some later run. `length` stays overridable for tests.
  const target = Math.min(opts.length ?? bucket.length, bucket.length);
  return bucket.slice(0, target).map((q, i) => ({
    ...q,
    stage: i + 1,
    timeLimit: timeLimitForTier(t),
  }));
}

/**
 * Build a ladder that is exactly the pool it was handed, in tier order.
 *
 * The daily challenge is the one run in this app whose questions were chosen
 * by the *server*, by date, and are the same five for every player. Both other
 * builders would undo that: `buildLadder` samples a pool with a per-player rank
 * curve and a `Math.random()` seed, and `buildTierLadder` keeps one tier and
 * drops the rest — today's five span tiers 2 to 6.
 *
 * It happens that `buildLadder` over a five-question pool serves all five, by
 * way of `takeNearestTier` widening outward until the buckets empty. That is a
 * coincidence of the pool being shorter than `runLength`, not a promise, and
 * "the daily challenge shows all five questions" must not rest on it: the
 * reward is claimable only once every one of them has been answered.
 *
 * Ordered by tier ascending so the run still climbs, and stably within a tier,
 * so the sequence is a function of what the server stored and nothing else.
 * Every player meets the same five questions in the same order, which is what
 * makes a shared challenge worth talking about.
 */
export function buildFixedLadder(pool: readonly QuizQuestion[], preserveOrder = false): HuntQuestion[] {
  const ordered = pool.map((q, i) => ({ q, i }));
  if (!preserveOrder) ordered.sort((a, b) => clampTier(a.q.tier) - clampTier(b.q.tier) || a.i - b.i);
  return ordered
    .map(({ q }, i) => ({
      ...q,
      stage: i + 1,
      timeLimit: timeLimitForTier(clampTier(q.tier)),
    }));
}

/**
 * Which tier stage `index` of a `length`-question run should aim for.
 *
 * The run spans one tier below the seeker's rank to one above it, so it opens
 * with something they should get, and closes with something that stretches
 * them. Clamped at both ends: a Mubtadi never starts below tier 1, and a
 * Mujaddid's run tops out at 9 rather than running off the end.
 */
export function curveTier(index: number, length: number, startTier: number): number {
  const anchor = clampTier(startTier);
  const from = clampTier(anchor - 1);
  const to = clampTier(anchor + 1);
  const progress = length <= 1 ? 0 : index / (length - 1);
  return clampTier(from + progress * (to - from));
}

/** Which difficulty stage `index` of a `length`-question run should aim for. */
export function curveDifficulty(index: number, length: number): Difficulty {
  const progress = length <= 1 ? 0 : index / (length - 1);
  if (progress < 0.34) return 'Beginner';
  if (progress < 0.72) return 'Intermediate';
  return 'Advanced';
}

/**
 * Pull a question at `wanted` tier, or the closest available.
 *
 * Ties break downward — given nothing at tier 5, a question at 4 is preferred
 * to one at 6. Asking slightly under rank is a kinder failure than asking over
 * it, and it keeps a sparse category from feeling punishing.
 */
function takeNearestTier(
  buckets: Map<number, QuizQuestion[]>,
  wanted: number,
): QuizQuestion | null {
  const from = clampTier(wanted);
  const order: number[] = [];
  for (let t = TIER_MIN; t <= TIER_MAX; t += 1) order.push(t);
  order.sort((a, b) => Math.abs(a - from) - Math.abs(b - from) || a - b);

  for (const t of order) {
    const q = buckets.get(t)?.pop();
    if (q) return q;
  }
  return null;
}

/** Seconds on the clock at a given tier: 25 at Mubtadi rising to 45 at Mujaddid. */
export function timeLimitForTier(tier: number): number {
  const { min, max } = HUNT_RULES.tierTimeLimit;
  const span = TIER_MAX - TIER_MIN;
  return Math.round(min + ((clampTier(tier) - TIER_MIN) / span) * (max - min));
}

export function timeLimitFor(difficulty: Difficulty): number {
  return HUNT_RULES.timeLimit[difficulty] ?? 30;
}

/** Combo multiplier for a given run of consecutive correct answers. */
export function comboMultiplier(combo: number): number {
  return Math.min(Math.floor(combo / HUNT_RULES.comboStep) + 1, HUNT_RULES.maxCombo);
}

/**
 * Speed bonus for answering with `msLeft` of `limitSeconds` still on the clock.
 * Full bonus inside the fast window, then a linear decay to nothing at the
 * buzzer — so hesitating costs something but never punishes a correct answer.
 */
export function speedBonus(basePoints: number, msLeft: number, limitSeconds: number): number {
  if (limitSeconds <= 0 || msLeft <= 0) return 0;
  const fraction = Math.min(1, msLeft / (limitSeconds * 1000));
  const { speedBonusWindow: windowSize, speedBonusMax } = HUNT_RULES;
  const scale = fraction >= windowSize ? 1 : fraction / windowSize;
  return Math.round(basePoints * speedBonusMax * scale);
}

/**
 * How a mode changes the run.
 *
 * These come from `game_mode_rules` in the database, not from here, because the
 * XP multiplier on the same row is what the server applies and the two must not
 * be able to disagree. What the client is trusted with is the *shape* of the
 * run — how many lives, whether there is a clock — none of which decides what
 * lands on a profile.
 */
export interface ModeRules {
  /** Lives, or null for a mode a wrong answer cannot end. */
  lives: number | null;
  /** Seconds on a whole-run clock, or null when only questions are timed. */
  runSeconds: number | null;
  /** Whether each question carries its own countdown. */
  perQuestionTimer: boolean;
  /** Whether the run is meant to continue past a fixed-length ladder. */
  endless: boolean;
}

/** The classic hunt, as it played before modes existed. */
export const CLASSIC_RULES: ModeRules = {
  lives: HUNT_RULES.startingLives,
  runSeconds: null,
  perQuestionTimer: true,
  endless: false,
};

/**
 * Whether a mode exists to teach rather than to pressure.
 *
 * Two things hang off this: the reveal is held until the player dismisses it
 * rather than vanishing after 2.6 seconds, and a run can be paused. Both would
 * be exploits in a mode that scores hesitation — Speed Round charges for the
 * time you spend thinking, and Survival is meant to be relentless — so neither
 * gets them.
 *
 * Derived rather than stored. `runSeconds` marks a mode that times the whole
 * run, and `endless` marks one that is meant to grind you down; a mode with
 * neither is one where stopping to read costs nothing anyone is scoring. That
 * picks out classic and practice exactly, and keeps the rule in one place
 * instead of a column that would have to be kept in step with four rows.
 */
export function isLearningMode(rules: ModeRules): boolean {
  return rules.runSeconds === null && !rules.endless;
}

/**
 * A mode without lives still needs a number, because the engine subtracts from
 * it on every miss. This is large enough that no realistic run reaches zero,
 * which is what "cannot be lost" means in practice.
 */
export const UNLIMITED_LIVES = 9_999;

export function initialState(ladder: HuntQuestion[], rules: ModeRules = CLASSIC_RULES, preserveOrder = false): HuntState {
  return {
    ladder,
    preserveOrder,
    stage: 0,
    status: ladder.length === 0 ? 'idle' : 'playing',
    lives: rules.lives ?? UNLIMITED_LIVES,
    combo: 0,
    bestCombo: 0,
    xp: 0,
    speedScore: 0,
    correct: 0,
    wrong: 0,
    timedOut: 0,
    lifelinesUsed: [],
    tier: ladder[0]?.tier ?? TIER_MIN,
    tierRun: 0,
    missRun: 0,
  };
}

export function currentQuestion(state: HuntState): HuntQuestion | null {
  return state.ladder[state.stage] ?? null;
}

export interface AnswerOutcome {
  correct: boolean;
  /** XP the server credited for this answer. */
  xpEarned: number;
  /** Milliseconds still on the clock when the answer was committed. */
  msLeft: number;
}

/**
 * Fold one graded answer into the run.
 *
 * The server has already decided `correct` and `xpEarned`; the engine's job is
 * the run-level consequences — combo, lives, the difficulty ladder, and whether
 * the run is over.
 */
export function applyAnswer(state: HuntState, outcome: AnswerOutcome): HuntState {
  const question = currentQuestion(state);
  if (!question || state.status !== 'playing') return state;

  const next: HuntState = { ...state, lifelinesUsed: [...state.lifelinesUsed] };

  if (outcome.correct) {
    next.correct += 1;
    next.combo = state.combo + 1;
    next.bestCombo = Math.max(state.bestCombo, next.combo);
    next.xp += outcome.xpEarned;
    next.speedScore += speedBonus(question.points, outcome.msLeft, question.timeLimit);
    next.tierRun = state.tierRun + 1;
    next.missRun = 0;
  } else {
    next.wrong += 1;
    next.combo = 0;
    next.lives = Math.max(0, state.lives - 1);
    next.tierRun = 0;
    next.missRun = state.missRun + 1;
  }

  return advance(next);
}

/** A question the clock ran out on: costs a life, breaks the combo, no XP. */
export function applyTimeout(state: HuntState): HuntState {
  if (state.status !== 'playing' || !currentQuestion(state)) return state;
  const next: HuntState = {
    ...state,
    lifelinesUsed: [...state.lifelinesUsed],
    timedOut: state.timedOut + 1,
    combo: 0,
    lives: Math.max(0, state.lives - 1),
    tierRun: 0,
    missRun: state.missRun + 1,
  };
  return advance(next);
}

/**
 * Skip the current question. Costs no life and breaks no combo — the coins the
 * lifeline charges are the price — but it does not count as a correct answer,
 * so it can't be used to farm the ladder.
 */
export function applySkip(state: HuntState): HuntState {
  if (state.status !== 'playing' || !currentQuestion(state)) return state;
  return advance({ ...state, lifelinesUsed: [...state.lifelinesUsed] });
}

/**
 * End a run from outside the question loop.
 *
 * Speed Round is decided by a clock that belongs to the whole run rather than
 * to any question, so something has to be able to stop the run without an
 * answer or a timeout having happened. Everything the run scored is kept — the
 * player earned it — only the status changes.
 */
export function endRun(state: HuntState, status: Extract<HuntStatus, 'won' | 'lost'>): HuntState {
  if (state.status !== 'playing') return state;
  return { ...state, status };
}

export function spendLifeline(state: HuntState, lifelineId: string): HuntState {
  if (state.lifelinesUsed.includes(lifelineId)) return state;
  return { ...state, lifelinesUsed: [...state.lifelinesUsed, lifelineId] };
}

/**
 * Move to the next stage and settle the run's status.
 *
 * Out of lives ends the run as `lost` even mid-ladder; reaching the end of the
 * ladder with a life left is a `won` run. Both land on the summary screen —
 * the difference is what it says and what it pays.
 */
function advance(state: HuntState): HuntState {
  const next = { ...state, stage: state.stage + 1 };

  if (next.lives <= 0) {
    return { ...next, status: 'lost' };
  }
  if (next.stage >= next.ladder.length) {
    return { ...next, status: 'won' };
  }

  // Re-point the remaining stages first, then read the tier off whatever
  // actually ended up next — otherwise the badge shows the pre-swap tier.
  const tuned = { ...next, ...retune(next) };
  return { ...tuned, tier: tuned.ladder[tuned.stage].tier };
}

/**
 * The adaptive part.
 *
 * A pre-built ladder alone isn't adaptive — it plays the same whether the
 * seeker is cruising or drowning. So after each answer we look at the run and
 * re-point the *remaining* stages: a hot streak pulls harder questions forward,
 * repeated misses pushes them back. We only ever swap questions that haven't
 * been seen yet, so the run never repeats or skips content.
 */
function retune(state: HuntState): Pick<HuntState, 'ladder'> {
  if (state.preserveOrder) return { ladder: state.ladder };
  const remaining = state.ladder.slice(state.stage);
  if (remaining.length < 2) return { ladder: state.ladder };

  const promoting = state.tierRun >= HUNT_RULES.promoteAfter;
  const demoting = state.missRun >= HUNT_RULES.demoteAfter;
  if (promoting === demoting) return { ladder: state.ladder };

  const rank = (q: HuntQuestion) => clampTier(q.tier);
  const sorted = remaining
    .slice()
    .sort((a, b) => (promoting ? rank(b) - rank(a) : rank(a) - rank(b)));

  // Only the very next stage is re-pointed. Reordering the whole tail would
  // flatten the run's arc; moving one question keeps the climb but makes it
  // respond to how this particular run is going.
  if (sorted[0].id === remaining[0].id) return { ladder: state.ladder };

  const reordered = [sorted[0], ...remaining.filter((q) => q.id !== sorted[0].id)];
  const ladder = [
    ...state.ladder.slice(0, state.stage),
    ...reordered.map((q, i) => ({ ...q, stage: state.stage + i + 1 })),
  ];
  return { ladder };
}

export interface RunSummary {
  status: Exclude<HuntStatus, 'idle' | 'playing'>;
  answered: number;
  correct: number;
  wrong: number;
  timedOut: number;
  /** Percent of answered questions that were right, 0–100. */
  accuracy: number;
  /** XP the server actually credited to the profile over this run. */
  xp: number;
  /** Points earned for pace. Scores the run; never credited as XP. */
  speedScore: number;
  /** Headline number for the summary: credited XP plus pace points. */
  runScore: number;
  bestCombo: number;
  livesLeft: number;
  /** True when every question in the ladder was answered correctly. */
  flawless: boolean;
  lifelinesUsed: number;
}

export function summarize(state: HuntState): RunSummary {
  const answered = state.correct + state.wrong + state.timedOut;
  return {
    status: state.status === 'won' ? 'won' : 'lost',
    answered,
    correct: state.correct,
    wrong: state.wrong,
    timedOut: state.timedOut,
    accuracy: answered === 0 ? 0 : Math.round((state.correct / answered) * 100),
    xp: state.xp,
    speedScore: state.speedScore,
    runScore: state.xp + state.speedScore,
    bestCombo: state.bestCombo,
    livesLeft: state.lives,
    flawless: state.ladder.length > 0 && state.correct === state.ladder.length,
    lifelinesUsed: state.lifelinesUsed.length,
  };
}
