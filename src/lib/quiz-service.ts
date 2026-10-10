import { createClient } from '@/lib/supabase/server';
import { timeLimitForTier, clampTier, TIER_MIN, TIER_MAX } from '@/lib/hunt-engine';
import type { QuizQuestion } from '@/lib/types';
import { randomInt } from 'node:crypto';
import { sampleQuestionIds } from '@/lib/mode-question-sampling';

/**
 * Server-only data access for the quiz. These functions replace the hardcoded
 * QUESTIONS / CATEGORY_DETAILS maps that used to live in `constants.ts`.
 * They only ever return PUBLISHED content, and question fetches never include
 * the correct answer (see `QuizQuestion`). Import only from Server Components
 * or Server Actions.
 */

type DbDifficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_LABEL: Record<DbDifficulty, 'Beginner' | 'Intermediate' | 'Advanced'> = {
  easy: 'Beginner',
  medium: 'Intermediate',
  hard: 'Advanced',
};

export const POINTS_BY_DIFFICULTY: Record<DbDifficulty, number> = {
  easy: 10,
  medium: 15,
  hard: 20,
};

export function labelDifficulty(d: string): 'Beginner' | 'Intermediate' | 'Advanced' {
  return DIFFICULTY_LABEL[d as DbDifficulty] ?? 'Intermediate';
}

export interface QuizCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  publishedCount: number;
  answeredCount: number;
}

export async function getCategoryBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('categories')
    .select('id, slug, name, description, icon')
    .eq('slug', slug)
    .eq('pool', 'category')
    .single();
  return data;
}

/**
 * The locale to serve content in, taken from the signed-in player's profile.
 *
 * Server-side, so it cannot come from `LanguageContext` — that is a client
 * context. `profiles.preferred_language` is the same value the context reads
 * and writes when the player picks a language, so the two agree by
 * construction rather than by a second copy being kept in step.
 *
 * Signed out, or no preference stored, means English. That is the honest
 * default here and not a fallback worth logging: `/quiz` requires a session
 * anyway.
 */
async function preferredLocale(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'en';
  const { data } = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('id', user.id)
    .single();
  return (data?.preferred_language as string | undefined) ?? 'en';
}

export async function getPublishedQuizQuestions(slug: string): Promise<QuizQuestion[]> {
  const supabase = await createClient();
  const category = await getCategoryBySlug(slug);
  if (!category) return [];

  const { data, error } = await supabase
    .from('questions')
    // NOTE: correct_choice_index / explanation / citation are intentionally NOT
    // selected here — they must never reach the browser before an answer is
    // submitted. Grading happens server-side in submitAnswer().
    .select('id, question_text, choices, difficulty, tier, categories(name)')
    .eq('category_id', category.id)
    .eq('review_status', 'published')
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return localiseQuestions(data);
}

/**
 * The rows above, rendered in the player's language where one exists.
 *
 * Extracted so there is a single definition of what a translated question is.
 * It used to live inside `getPublishedQuizQuestions` alone, which is why the
 * daily challenge had to grow its own copy or go without — and a second copy
 * of the option-count check below is exactly the kind of drift migration 0049
 * was written about.
 */
export async function localiseQuestions(rows: any[]): Promise<QuizQuestion[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();

  /**
   * ── Why this is an overlay and not a different set of rows ──────────────
   * `questions.language` has existed since the first migration and nothing
   * has ever read it, so a player who picked Hausa has always been served
   * English. The obvious repair — Hausa rows in `questions` — was a trap:
   * nothing scopes a query by language, so those rows would have doubled the
   * bank for every player and broken the twenty-per-tier assumption
   * `buildTierLadder` rests on. Migration 0044 keys translations on
   * `(question_id, locale)` instead, so the bank stays exactly 5,220
   * questions and a translation is a different *rendering* of one, never an
   * extra one.
   *
   * ── The fallback is per question, not per language ──────────────────────
   * A locale with three translated questions out of twenty shows those three
   * in Hausa and the rest in English, rather than the whole run reverting.
   * A partly translated bank is therefore a working bank, which is what makes
   * it safe to publish translations as they arrive instead of all at once.
   *
   * `explanation` is not fetched here and could not be: migration 0044 grants
   * `authenticated` only the columns a player needs before answering. The
   * translated explanation arrives from `submit_quiz_answer`, after the
   * answer, in the same language.
   */
  const locale = await preferredLocale();
  const translations = new Map<string, { text: string; options: string[] }>();

  if (locale !== 'en') {
    const { data: translated } = await supabase
      .from('question_translations')
      .select('question_id, question_text, choices')
      .eq('locale', locale)
      .in('question_id', rows.map((r: any) => r.id));

    (translated ?? []).forEach((t: any) => {
      const options = (t.choices ?? []) as string[];
      translations.set(t.question_id as string, {
        text: t.question_text as string,
        options,
      });
    });
  }

  return rows.map((row: any) => {
    const tier = clampTier(row.tier ?? 1);
    const englishOptions = (row.choices ?? []) as string[];
    const translated = translations.get(row.id as string);
    /**
     * A translation with a different number of options is discarded rather
     * than rendered. `correct_choice_index` indexes into the English array,
     * so a shorter or longer translated array silently repoints the correct
     * answer at whatever now sits at that position — a player choosing
     * correctly would be marked wrong. The database rejects these on write
     * (0044); this is the second door, because a row written before that
     * constraint existed, or by any future path that bypasses the RPC, must
     * still not be able to mis-grade a run.
     */
    const usable =
      translated && translated.options.length === englishOptions.length
        ? translated
        : null;

    return {
      id: row.id as string,
      categoryName: typeof row.categories?.name === 'string' ? row.categories.name : undefined,
      text: usable?.text ?? (row.question_text as string),
      options: usable?.options ?? englishOptions,
      difficulty: labelDifficulty(row.difficulty),
      tier,
      points: POINTS_BY_DIFFICULTY[row.difficulty as DbDifficulty] ?? 10,
      // The clock follows the tier, not the old three-way band: 25s at
      // Mubtadi rising to 45s at Mujaddid. It used to be a flat 30 for every
      // question regardless of difficulty.
      timeLimit: timeLimitForTier(tier),
    };
  });
}

/**
 * Exactly these questions, whichever bank they came from.
 *
 * The daily challenge does not have a pool to draw from: its five questions
 * were chosen by `ensure_daily_challenge` from the date, are stored on the
 * row, and are the same five for every player. So this selects by id rather
 * than by category or tier, and it is the only question fetch in the app that
 * does.
 *
 * Order follows `ids`, not the database's — the ids arrive in the order the
 * server settled on, and a `.in()` filter returns rows in whatever order
 * PostgREST likes. Anything not published is dropped rather than substituted:
 * a challenge whose question was unpublished after it was set is short by one,
 * and short is honest where a stand-in would silently change the shared set.
 */
export async function getQuestionsByIds(ids: readonly string[]): Promise<QuizQuestion[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('questions')
    // As everywhere else: correct_choice_index and explanation are never
    // selected before an answer is graded. Migration 0049 revoked them at the
    // column level too, so this is now enforced rather than merely intended.
    .select('id, question_text, choices, difficulty, tier, categories(name)')
    .in('id', ids as string[])
    .eq('review_status', 'published');

  if (error || !data) return [];

  const byId = new Map(data.map((row: any) => [row.id as string, row]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  return localiseQuestions(ordered as any[]);
}

export async function getCategoriesWithProgress(): Promise<QuizCategory[]> {
  const supabase = await createClient();

  const { data: cats } = await supabase
    .from('categories')
    .select('id, slug, name, description, icon')
    // Only the browsable bank. Migration 0054 split the questions in two: the
    // categories a seeker chooses, and the arena bank that daily challenge,
    // battle and the play modes draw from unannounced. Arena categories are
    // organisational — they exist so an arena question has a home and an admin
    // can see what it is about — and must never appear on this grid.
    .eq('pool', 'category')
    // The curriculum order, not the alphabet. `sort_order` has always held a
    // deliberate sequence — creed, then the names of Allah, then the pillars,
    // then the Qur'an and the seerah, out through law and character to the
    // contemporary questions last — and this grid ignored it, so a seeker met
    // twenty-nine categories in an order that told them nothing about where to
    // begin. It is NOT NULL, so every category has a place in it.
    .order('sort_order');
  if (!cats) return [];

  // Both tallies are counted in the database — see migration 0029. Counting
  // them here instead meant fetching one row per published question, and
  // PostgREST stops at 1,000 of them: with 5,220 questions, twenty-three of
  // the twenty-nine categories came back as zero and rendered "Coming soon"
  // over a bank that was complete. The answered tally had the same ceiling
  // waiting for the first player to pass a thousand answers.
  const { data: progress } = await supabase.rpc('category_progress');

  const progressByCat = new Map<string, { published: number; answered: number }>();
  (progress ?? []).forEach((p: any) => {
    progressByCat.set(p.category_id, {
      published: p.published_count ?? 0,
      answered: p.answered_count ?? 0,
    });
  });

  return cats.map((c: any) => ({
    id: c.id as string,
    slug: c.slug as string,
    name: c.name as string,
    description: c.description as string | null,
    icon: c.icon as string | null,
    publishedCount: progressByCat.get(c.id)?.published ?? 0,
    answeredCount: progressByCat.get(c.id)?.answered ?? 0,
  }));
}

/** Published questions from exactly one tier of a category — the level-run's
 * question pool, as opposed to `getPublishedQuizQuestions`'s whole-category,
 * every-tier pool used by the adaptive Hunt. */
export async function getPublishedQuizQuestionsForTier(slug: string, tier: number): Promise<QuizQuestion[]> {
  const supabase = await createClient();
  const category = await getCategoryBySlug(slug);
  if (!category) return [];
  const wantedTier = clampTier(tier);

  const { data, error } = await supabase
    .from('questions')
    .select('id, question_text, choices, difficulty, tier, categories(name)')
    .eq('category_id', category.id)
    .eq('tier', wantedTier)
    .eq('review_status', 'published')
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  // Through the same overlay as every other player-facing fetch. This mapped
  // the rows itself and therefore served English to a Hausa player on the
  // level path — the path a seeker actually walks — while the whole-category
  // Hunt, three lines above, served the translation correctly. Nothing was
  // wrong with the translations; this one function simply never asked for
  // them. Thirty-six Hausa questions live in the browsable bank today, in
  // thirteen categories, so this was visible on screen rather than latent.
  return localiseQuestions(data);
}

/**
 * A pool for the mode runs, drawn from every category rather than one.
 *
 * Speed Round, Survival and Practice are not about a subject — they are about
 * how you play — so confining them to a category would make them a slower way
 * of doing what the level path already does.
 *
 * The band arrives from the run itself rather than being worked out here.
 * Since migration 0035 the run records the tiers it was opened for, and the
 * grader pays the mode multiplier only inside them; drawing the pool from the
 * same two numbers is what keeps the questions offered and the questions paid
 * for the same set. Deriving the band twice — once in TypeScript from `RANKS`,
 * once in SQL from `rank_tiers` — is how the two would drift apart.
 *
 * Sample IDs across the entire eligible arena band on the server. The old
 * unordered limit selected the same arbitrary subset before the client could
 * shuffle it. Only the sampled questions are fetched and localised; no answer
 * keys or explanations are selected, and each API page stays below 1,000 rows.
 */
export async function getModeQuestionPool(
  tierMin: number,
  tierMax: number,
  limit = 300,
): Promise<QuizQuestion[]> {
  const supabase = await createClient();
  const low = clampTier(tierMin);
  const high = clampTier(Math.max(tierMin, tierMax));

  // `questions.pool` was added after column-level player grants and cannot
  // be used in an authenticated SELECT, even as a filter. Question pool is
  // derived from category pool; use the already-readable category metadata.
  const { data: arenaCategories, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('pool', 'arena');
  if (categoryError || !arenaCategories?.length) return [];
  const arenaCategoryIds = arenaCategories.map((category) => category.id);

  let ids: string[];
  try {
    ids = await sampleQuestionIds(async (from, to) => {
      const { data, error } = await supabase
        .from('questions')
        .select('id')
        .eq('review_status', 'published')
        .in('category_id', arenaCategoryIds)
        .gte('tier', low)
        .lte('tier', high)
        .order('id', { ascending: true })
        .range(from, to);
      if (error || !data) throw new Error('Arena question selection failed');
      return data;
    }, limit, randomInt);
  } catch {
    return [];
  }
  return getQuestionsByIds(ids);
}

export interface CategoryLevel {
  tier: number;
  publishedCount: number;
  /** Distinct published questions in this tier the player has ever answered
   * correctly — the level is "complete" once this reaches publishedCount. */
  correctCount: number;
  completed: boolean;
  /** Whether the player may play this level yet. Tier 1 always is; tier N+1
   * requires tier N complete. */
  unlocked: boolean;
}

/**
 * The nine-level adventure path for one category.
 *
 * A level is "complete" once every published question in that tier has been
 * answered correctly at least once (checked against `attempts`, the
 * server-graded record — never against anything the client self-reports).
 * The next level is unlocked only once the one before it is complete.
 *
 * A tier with zero published questions can't be completed, but it also must
 * not permanently wall off every level after it while content is still being
 * reviewed — so an empty tier counts as "satisfied" for unlock purposes
 * (nothing to finish) while still showing honestly as not completed.
 */
export async function getCategoryLevels(slug: string): Promise<CategoryLevel[]> {
  const supabase = await createClient();
  const category = await getCategoryBySlug(slug);
  if (!category) return [];

  const { data: qs } = await supabase
    .from('questions')
    .select('id, tier')
    .eq('category_id', category.id)
    .eq('review_status', 'published');

  const idsByTier = new Map<number, string[]>();
  for (let t = TIER_MIN; t <= TIER_MAX; t += 1) idsByTier.set(t, []);
  (qs ?? []).forEach((q: any) => {
    idsByTier.get(clampTier(q.tier ?? TIER_MIN))!.push(q.id as string);
  });

  const correctIds = new Set<string>();
  const allIds = (qs ?? []).map((q: any) => q.id as string);
  if (allIds.length > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: attempts } = await supabase
        .from('attempts')
        .select('question_id')
        .eq('user_id', user.id)
        .eq('is_correct', true)
        .in('question_id', allIds);
      (attempts ?? []).forEach((a: any) => correctIds.add(a.question_id as string));
    }
  }

  const levels: CategoryLevel[] = [];
  let previousSatisfied = true; // level 1 is always open
  for (let t = TIER_MIN; t <= TIER_MAX; t += 1) {
    const ids = idsByTier.get(t)!;
    const publishedCount = ids.length;
    const correctCount = ids.filter((id) => correctIds.has(id)).length;
    const completed = publishedCount > 0 && correctCount >= publishedCount;

    levels.push({ tier: t, publishedCount, correctCount, completed, unlocked: previousSatisfied });
    previousSatisfied = completed || publishedCount === 0;
  }
  return levels;
}
