import { createClient } from '@/lib/supabase/server';
import { timeLimitForTier, clampTier, TIER_MIN, TIER_MAX } from '@/lib/hunt-engine';
import type { QuizQuestion } from '@/lib/types';

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
    .select('id, question_text, choices, difficulty, tier')
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
async function localiseQuestions(rows: any[]): Promise<QuizQuestion[]> {
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
    .select('id, question_text, choices, difficulty, tier')
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
    .select('id, question_text, choices, difficulty, tier')
    .eq('category_id', category.id)
    .eq('tier', wantedTier)
    .eq('review_status', 'published')
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  // Through the same overlay as every other player-facing fetch. This mapped
  // the rows itself and th…9999 tokens truncated…er.
 *
 * ── Swapping the model out ────────────────────────────────────────────────
 * The owner intends to move to a paid translation API. Everything specific to
 * Gemini is in `translateOne` and the two environment reads above it; the
 * claim/write loop below knows nothing about the provider.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { authorizePrivilegedRequest } from "../_shared/privileged-request.ts";

const LOCALE_NAMES: Record<string, string> = {
  ha: "Hausa",
  fr: "French",
  ar: "Arabic",
  id: "Indonesian (Bahasa Indonesia)",
  ms: "Malay (Bahasa Melayu)",
};

/** Read from the environment for the same reason `translate-questions` does:
 * a retired model name should be a dashboard edit, not a deploy. */
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.6-flash";

interface Candidate {
  o_hadith_id: string;
  o_locale: string;
  o_source_text: string;
  o_reference: string;
}

function buildPrompt(sourceText: string, languageName: string): string {
  return [
    `Translate the following hadith text from English into ${languageName}.`,
    ``,
    `RULES, in order of importance:`,
    ``,
    `1. Translate. Do not summarise, expand, modernise or explain. If the`,
    `   English is ambiguous, leave it ambiguous — do not resolve it.`,
    `2. Do not add, remove, merge or reorder any clause. A narration is a`,
    `   report of speech; every clause is part of the claim.`,
    `3. Keep proper nouns as proper nouns: names of people, places, tribes and`,
    `   books. Use the spelling conventional in ${languageName} where one`,
    `   exists, and otherwise keep the English spelling unchanged.`,
    `4. Keep honorifics exactly where they are, including "(ﷺ)" and any`,
    `   Arabic benediction, character for character.`,
    `5. Do not add commentary, a grading, a source, a reference number, or any`,
    `   note of your own. Nothing that is not a translation of the text below.`,
    `6. Return the translation only, with no preamble and no quotation marks`,
    `   wrapping the whole thing.`,
    ``,
    `Return JSON of exactly this shape and nothing else:`,
    `{"text": "<the translation>"}`,
    ``,
    `TEXT:`,
    sourceText,
  ].join("\n");
}

async function translateOne(sourceText: string, locale: string, apiKey: string): Promise<string | null> {
  const languageName = LOCALE_NAMES[locale] ?? locale;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(sourceText, languageName) }] }],
        generationConfig: {
          // Low, for the same reason the question worker is low: a narration
          // that reads differently on a second run would mean the app had
          // shown two different hadiths under one reference number.
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`model returned ${res.status}: ${body.slice(0, 600)}`);
  }

  const raw = (await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof raw !== "string") return null;

  try {
    const parsed = JSON.parse(raw);
    const text = typeof parsed?.text === "string" ? parsed.text.trim() : null;
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const denied = await authorizePrivilegedRequest(req, supabase, true);
  if (denied) return denied;
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY is not set" }, { status: 500 });
  }

  let locale = "ha";
  let limit = 10;
  // The narration on screen today is rarely near the front of the queue, so
  // there has to be a way to name one. See 0065.
  let reference: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.locale === "string") locale = body.locale;
    if (typeof body?.reference === "string") reference = body.reference;
    if (Number.isFinite(body?.limit)) limit = Math.max(1, Math.min(50, Math.floor(body.limit)));
  } catch {
    // No body, or not JSON. The defaults above are a reasonable single batch.
  }

  const { data, error } = await supabase.rpc("hadith_translation_candidates", {
    p_limit: limit,
    p_locale: locale,
    p_reference: reference,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const candidates = (data ?? []) as Candidate[];
  let written = 0;
  let refused = 0;
  const failures: string[] = [];

  // One at a time. This is invoked by hand on a free-tier key that caps out at
  // twenty calls a day; a concurrency pool would spend the whole quota inside
  // one second and learn nothing more than this does.
  for (const c of candidates) {
    try {
      const text = await translateOne(c.o_source_text, c.o_locale, apiKey);
      if (!text) {
        refused += 1;
        continue;
      }
      const { data: ok, error: writeError } = await supabase.rpc("complete_hadith_translation", {
        p_hadith_id: c.o_hadith_id,
        p_locale: c.o_locale,
        p_text: text,
      });
      if (writeError) {
        failures.push(`${c.o_reference} ${c.o_locale}: ${writeError.message}`);
      } else if (ok) {
        written += 1;
      } else {
        // The row filled up, or the text failed the length floor. Either way
        // the database made the call and there is nothing to retry.
        refused += 1;
      }
    } catch (e) {
      failures.push(`${c.o_reference} ${c.o_locale}: ${String((e as Error).message ?? e).slice(0, 300)}`);
      // A quota wall means every remaining call in this batch will hit it too.
      if (String((e as Error).message ?? "").includes("429")) break;
    }
  }

  return Response.json({
    locale,
    reference,
    considered: candidates.length,
    written,
    refused,
    failures: failures.slice(0, 10),
    remaining_note: "Call again to continue; candidates are recomputed each time.",
  });
});
