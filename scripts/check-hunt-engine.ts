/**
 * Hunt engine checks.
 *
 * The engine decides what a run *is* — ladder composition, combo, lives, the
 * adaptive re-point — and none of that is visible in a screenshot, so it gets
 * asserted here instead of eyeballed. Pure functions only; no DOM, no network.
 *
 *   npm run test:engine
 */

import {
  buildFixedLadder,
  buildLadder,
  buildTierLadder,
  initialState,
  applyAnswer,
  applyTimeout,
  applySkip,
  summarize,
  comboMultiplier,
  speedBonus,
  currentQuestion,
  makeRng,
  HUNT_RULES,
  curveDifficulty,
  curveTier,
  clampTier,
  timeLimitForTier,
  TIER_MIN,
  TIER_MAX,
  isLearningMode,
  CLASSIC_RULES,
} from '../src/lib/hunt-engine';
import type { QuizQuestion } from '../src/lib/types';

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) { failures += 1; console.log('FAIL:', name, extra ?? ''); }
  else console.log('ok  :', name);
}

const pool: QuizQuestion[] = [];
(['Beginner', 'Intermediate', 'Advanced'] as const).forEach((d, di) => {
  for (let i = 0; i < 8; i += 1) {
    // Three tiers per band, so the pool covers all nine and the ladder has
    // somewhere to climb to.
    const tier = di * 3 + (i % 3) + 1;
    pool.push({
      id: `${d}-${i}`, text: `q ${d} ${i}`, options: ['a', 'b', 'c', 'd'],
      difficulty: d, tier, points: 10 + di * 5, timeLimit: 30,
    });
  }
});

/** A pool holding exactly one tier, for the fallback checks. */
function poolAtTier(tier: number, count = 12): QuizQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${tier}-${i}`, text: `q t${tier} ${i}`, options: ['a', 'b', 'c', 'd'],
    difficulty: 'Intermediate' as const, tier, points: 15, timeLimit: 30,
  }));
}

// --- ladder composition
const rng = makeRng(42);
const ladder = buildLadder(pool, { rng });
check('ladder is runLength long', ladder.length === HUNT_RULES.runLength, ladder.length);
check('ladder has no duplicates', new Set(ladder.map((q) => q.id)).size === ladder.length);
check('stages are 1..n', ladder.every((q, i) => q.stage === i + 1));
// The ladder climbs tiers now, anchored to the seeker's rank, so the old
// "always starts Beginner, always ends Advanced" contract is gone on purpose:
// a Mubtadi's run should not finish at Mujaddid-level questions.
check('unanchored run starts at the bottom', ladder[0].tier <= 2, ladder[0].tier);
check('run does not descend overall', ladder[ladder.length - 1].tier >= ladder[0].tier, {
  first: ladder[0].tier, last: ladder[ladder.length - 1].tier,
});
check('time limits follow tier', ladder.every((q) => q.timeLimit === timeLimitForTier(q.tier)));

// --- tier anchoring
const midRun = buildLadder(pool, { rng: makeRng(42), startTier: 5 });
check('anchored run opens near the seeker rank', Math.abs(midRun[0].tier - 4) <= 1, midRun[0].tier);
check('anchored run climbs above the seeker rank', midRun.some((q) => q.tier >= 5), midRun.map((q) => q.tier));
check('anchored run stays off the bottom', midRun.every((q) => q.tier >= 3), midRun.map((q) => q.tier));

const topRun = buildLadder(pool, { rng: makeRng(7), startTier: 9 });
check('top rank clamps to 9', topRun.every((q) => q.tier <= TIER_MAX), topRun.map((q) => q.tier));
const bottomRun = buildLadder(pool, { rng: makeRng(7), startTier: 1 });
check('bottom rank clamps to 1', bottomRun.every((q) => q.tier >= TIER_MIN), bottomRun.map((q) => q.tier));

// --- the fallback that keeps sparse categories playable
// 150 of the 225 (category, tier) buckets are empty, so a category may hold
// nothing at the seeker's own tier. A run must still be full length.
const sparse = buildLadder(poolAtTier(8), { rng: makeRng(3), startTier: 1 });
check('sparse category still fills a run', sparse.length === HUNT_RULES.runLength, sparse.length);
check('sparse category falls back to what exists', sparse.every((q) => q.tier === 8));

// --- buildTierLadder — the level-locked adventure path's run mode. Unlike
// buildLadder, it must NEVER cross into a neighboring tier: borrowing there
// would let a player "complete" a level without its own material.
const tierRun = buildTierLadder(pool, 5, { rng: makeRng(11) });
check('tier ladder only touches its own tier', tierRun.every((q) => q.tier === 5), tierRun.map((q) => q.tier));
check('tier ladder has no duplicates', new Set(tierRun.map((q) => q.id)).size === tierRun.length);
check('tier ladder stages are 1..n', tierRun.every((q, i) => q.stage === i + 1));
check('tier ladder time limit matches the tier, not runtime drift', tierRun.every((q) => q.timeLimit === timeLimitForTier(5)));

// A level run serves the WHOLE tier, not the adaptive Hunt's 10. A level only
// completes once every question in it has been answered correctly, so a run
// that served half the tier would leave the rest to chance.
const fullTier = buildTierLadder(poolAtTier(6, 20), 6, { rng: makeRng(5) });
check('tier ladder serves the whole tier, not runLength', fullTier.length === 20, fullTier.length);
check('tier ladder is longer than the adaptive run length', fullTier.length > HUNT_RULES.runLength, fullTier.length);
check('whole-tier ladder still has no duplicates', new Set(fullTier.map((q) => q.id)).size === 20);

const emptyTier = buildTierLadder(poolAtTier(8, 0), 3, { rng: makeRng(1) });
check('tier with nothing published yields an empty ladder, not a fallback', emptyTier.length === 0);

const shortTier = buildTierLadder(poolAtTier(4, 3), 4, { rng: makeRng(2) });
check('tier ladder is only as long as what exists', shortTier.length === 3, shortTier.length);

check('same seed -> same tier ladder', JSON.stringify(buildTierLadder(pool, 6, { rng: makeRng(9) }).map((q) => q.id))
  === JSON.stringify(buildTierLadder(pool, 6, { rng: makeRng(9) }).map((q) => q.id)));

// Order must differ run to run — the player re-runs a tier many times, and a
// fixed order would make it rote rather than a fresh draw each time.
const orderA = buildTierLadder(poolAtTier(7, 20), 7, { rng: makeRng(101) }).map((q) => q.id);
const orderB = buildTierLadder(poolAtTier(7, 20), 7, { rng: makeRng(202) }).map((q) => q.id);
check('different seed -> different question order', JSON.stringify(orderA) !== JSON.stringify(orderB));
check('reshuffle still serves every question in the tier',
  new Set(orderA).size === 20 && new Set(orderB).size === 20 &&
  orderA.slice().sort().join() === orderB.slice().sort().join());

// --- curveTier
check('curveTier opens one below the anchor', curveTier(0, 10, 5) === 4, curveTier(0, 10, 5));
check('curveTier closes one above the anchor', curveTier(9, 10, 5) === 6, curveTier(9, 10, 5));
check('curveTier clamps at the floor', curveTier(0, 10, 1) === 1, curveTier(0, 10, 1));
check('curveTier clamps at the ceiling', curveTier(9, 10, 9) === 9, curveTier(9, 10, 9));
check('curveTier survives a single-question run', curveTier(0, 1, 5) === 4, curveTier(0, 1, 5));

// --- clampTier and the clock
check('clampTier floors', clampTier(-3) === TIER_MIN);
check('clampTier ceilings', clampTier(99) === TIER_MAX);
check('clampTier rejects NaN', clampTier(Number.NaN) === TIER_MIN);
check('clock is 25s at Mubtadi', timeLimitForTier(1) === 25, timeLimitForTier(1));
check('clock is 45s at Mujaddid', timeLimitForTier(9) === 45, timeLimitForTier(9));
check('clock rises with tier', Array.from({ length: 8 }, (_, i) => i + 1)
  .every((t) => timeLimitForTier(t) <= timeLimitForTier(t + 1)));

// small pool -> shorter ladder, no crash
const tiny = buildLadder(pool.slice(0, 2), { rng: makeRng(1) });
check('tiny pool yields 2', tiny.length === 2, tiny.length);
check('empty pool yields 0', buildLadder([], { rng: makeRng(1) }).length === 0);

// beginner-only pool still fills a full run
const beginnerOnly = pool.filter((q) => q.difficulty === 'Beginner');
const bl = buildLadder(beginnerOnly, { rng: makeRng(7) });
check('single-difficulty pool fills what it can', bl.length === Math.min(HUNT_RULES.runLength, beginnerOnly.length), bl.length);
check('single-difficulty no dupes', new Set(bl.map((q) => q.id)).size === bl.length);

// --- curve
check('curve starts Beginner', curveDifficulty(0, 10) === 'Beginner');
check('curve ends Advanced', curveDifficulty(9, 10) === 'Advanced');
check('curve of length 1 is Beginner', curveDifficulty(0, 1) === 'Beginner');

// --- combo
check('combo 0 -> x1', comboMultiplier(0) === 1);
check('combo 2 -> x1', comboMultiplier(2) === 1);
check('combo 3 -> x2', comboMultiplier(3) === 2);
check('combo 6 -> x3', comboMultiplier(6) === 3);
check('combo caps at max', comboMultiplier(99) === HUNT_RULES.maxCombo);

// --- speed bonus
check('full bonus when fast', speedBonus(10, 30000, 30) === 5, speedBonus(10, 30000, 30));
check('half window still full', speedBonus(10, 15000, 30) === 5, speedBonus(10, 15000, 30));
check('quarter window decays', speedBonus(10, 7500, 30) === 3, speedBonus(10, 7500, 30));
check('no time left, no bonus', speedBonus(10, 0, 30) === 0);
check('guards zero limit', speedBonus(10, 5000, 0) === 0);

// --- a winning run
let s = initialState(ladder);
check('starts playing', s.status === 'playing');
check('starts with lives', s.lives === HUNT_RULES.startingLives);
for (let i = 0; i < ladder.length; i += 1) {
  const q = currentQuestion(s);
  if (!q) { check('question available at stage ' + i, false); break; }
  s = applyAnswer(s, { correct: true, xpEarned: q.points, msLeft: q.timeLimit * 1000 });
}
check('perfect run wins', s.status === 'won', s.status);
let sum = summarize(s);
check('perfect run is flawless', sum.flawless, sum);
check('perfect run accuracy 100', sum.accuracy === 100);
check('perfect run keeps lives', sum.livesLeft === HUNT_RULES.startingLives);
check('perfect run earned pace points', sum.speedScore > 0, sum.speedScore);
check('runScore is xp + pace', sum.runScore === sum.xp + sum.speedScore);
check('best combo is run length', sum.bestCombo === ladder.length, sum.bestCombo);

// --- a losing run
let l = initialState(buildLadder(pool, { rng: makeRng(9) }));
l = applyAnswer(l, { correct: false, xpEarned: 0, msLeft: 5000 });
check('miss costs a life', l.lives === HUNT_RULES.startingLives - 1, l.lives);
check('miss breaks combo', l.combo === 0);
l = applyTimeout(l);
check('timeout costs a life', l.lives === HUNT_RULES.startingLives - 2, l.lives);
l = applyAnswer(l, { correct: false, xpEarned: 0, msLeft: 1000 });
check('run ends at zero lives', l.status === 'lost', l.status);
const lsum = summarize(l);
check('lost run counts timeouts separately', lsum.timedOut === 1 && lsum.wrong === 2, lsum);
check('lost run accuracy 0', lsum.accuracy === 0);
check('lost run not flawless', !lsum.flawless);
check('answers after loss are ignored', applyAnswer(l, { correct: true, xpEarned: 99, msLeft: 1000 }).xp === l.xp);

// --- skip
let k = initialState(buildLadder(pool, { rng: makeRng(3) }));
const before = currentQuestion(k)!.id;
k = applySkip(k);
check('skip advances', currentQuestion(k)!.id !== before);
check('skip costs no life', k.lives === HUNT_RULES.startingLives);
check('skip is not a correct answer', k.correct === 0);

// --- adaptivity: a hot streak should pull harder questions forward
let hot = initialState(buildLadder(pool, { rng: makeRng(11), startTier: 5 }));
const plannedThird = hot.ladder[2].tier;
hot = applyAnswer(hot, { correct: true, xpEarned: 10, msLeft: 20000 });
hot = applyAnswer(hot, { correct: true, xpEarned: 10, msLeft: 20000 });
const actualThird = currentQuestion(hot)!.tier;
check('streak does not make it easier', actualThird >= plannedThird, { plannedThird, actualThird });
check('tier tracks the live question', hot.tier === actualThird);
check('retune keeps ladder intact', new Set(hot.ladder.map((q) => q.id)).size === hot.ladder.length);
check('retune keeps ladder length', hot.ladder.length === HUNT_RULES.runLength);
check('retune renumbers stages', hot.ladder.every((q, i) => q.stage === i + 1));

// misses should ease off
let cold = initialState(buildLadder(pool, { rng: makeRng(11) }));
cold = applyAnswer(cold, { correct: true, xpEarned: 10, msLeft: 1000 });
cold = applyAnswer(cold, { correct: false, xpEarned: 0, msLeft: 1000 });
check('miss run recorded', cold.missRun === 1);
check('cold ladder still intact', new Set(cold.ladder.map((q) => q.id)).size === cold.ladder.length);

// --- determinism
const a = buildLadder(pool, { rng: makeRng(123) }).map((q) => q.id).join(',');
const b = buildLadder(pool, { rng: makeRng(123) }).map((q) => q.id).join(',');
check('same seed -> same ladder', a === b);
check('different seed -> different ladder', a !== buildLadder(pool, { rng: makeRng(124) }).map((q) => q.id).join(','));

// --- the daily challenge's fixed ladder
// Five questions chosen by the server, the same for every player, all of which
// must be served: the reward is claimable only once every one has been
// answered. `buildLadder` would sample them against the player's own rank and
// `buildTierLadder` would keep one tier and drop the rest.
const daily: QuizQuestion[] = [5, 2, 6, 4, 3].map((tier, i) => ({
  id: `daily-${i}`, text: `daily ${i}`, options: ['a', 'b', 'c', 'd'],
  difficulty: 'Intermediate' as const, tier, points: 15, timeLimit: 30,
}));
const fixed = buildFixedLadder(daily);
check('fixed ladder serves every question', fixed.length === daily.length, fixed.length);
check('fixed ladder loses nobody',
  new Set(fixed.map((q) => q.id)).size === daily.length);
check('fixed ladder stages are 1..n', fixed.every((q, i) => q.stage === i + 1));
check('fixed ladder climbs', fixed.every((q, i) => i === 0 || q.tier >= fixed[i - 1].tier),
  fixed.map((q) => q.tier));
check('fixed ladder takes its clock from the tier',
  fixed.every((q) => q.timeLimit === timeLimitForTier(q.tier)));
// No rng anywhere in it: two players on the same day must meet the same five
// questions in the same order, which is what makes a shared challenge shared.
check('fixed ladder is the same every time',
  buildFixedLadder(daily).map((q) => q.id).join(',') === fixed.map((q) => q.id).join(','));
// Stable within a tier, so the server's own order decides ties rather than
// whatever `sort` happens to do.
const sameTier = buildFixedLadder([2, 2, 2].map((tier, i) => ({
  id: `same-${i}`, text: `same ${i}`, options: ['a', 'b', 'c', 'd'],
  difficulty: 'Intermediate' as const, tier, points: 15, timeLimit: 30,
})));
check('fixed ladder keeps the given order within a tier',
  sameTier.map((q) => q.id).join(',') === 'same-0,same-1,same-2');
check('fixed ladder of nothing is empty', buildFixedLadder([]).length === 0);

// --- which modes hold the reveal and allow a pause
// Derived from the rules rather than a mode name, so these assert the real
// four rows in `game_mode_rules` as they stand.
check('classic is a learning mode', isLearningMode(CLASSIC_RULES) === true);
check('practice is a learning mode', isLearningMode({
  lives: null, runSeconds: null, perQuestionTimer: false, endless: false,
}) === true);
check('survival is not a learning mode', isLearningMode({
  lives: 3, runSeconds: null, perQuestionTimer: true, endless: true,
}) === false);
check('speed round is not a learning mode', isLearningMode({
  lives: null, runSeconds: 120, perQuestionTimer: false, endless: true,
}) === false);

// Review serves every due question, in its supplied order, even after streaks
// and repeated misses that normally adapt the Hunt's difficulty.
const reviewPool = Array.from({ length: 15 }, (_, i) => ({
  id: `due-${i}`, text: 'Review question', options: ['A', 'B'],
  difficulty: 'Beginner' as const, tier: [9, 1, 5, 2, 8][i % 5], points: 10, timeLimit: 25,
}));
const reviewLadder = buildFixedLadder(reviewPool, true);
check('review preserves the full 15-question due order', reviewLadder.map(q => q.id).join(',') === reviewPool.map(q => q.id).join(','));
for (const correct of [true, false]) {
  let reviewState = initialState(reviewLadder, { lives: null, runSeconds: null, perQuestionTimer: false, endless: false }, true);
  let ordered = true;
  for (const expected of reviewPool) {
    ordered &&= currentQuestion(reviewState)?.id === expected.id;
    reviewState = applyAnswer(reviewState, { correct, xpEarned: correct ? 10 : 0, msLeft: 0 });
  }
  check(`review keeps due order after ${correct ? 'correct streaks' : 'repeated misses'}`, ordered);
  check(`review completes all questions after ${correct ? 'correct answers' : '15 mistakes'}`, reviewState.status === 'won' && summarize(reviewState).answered === 15);
}
check('ordered review does not mutate its question pool', reviewPool[0].id === 'due-0' && reviewPool[0].tier === 9);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
