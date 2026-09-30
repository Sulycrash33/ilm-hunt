"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
// Constants and types live in a plain module: a `"use server"` file may only
// export async functions, and exporting `LOCALES` from here broke the build at
// page-data collection while compiling perfectly well.
import type { Locale, QueueCell, TranslationRow, FailedRow } from "./locales"
import type { TranslationWorkerStatus } from "./worker-status"

export async function getTranslationWorkerStatus(): Promise<
  { ok: true; status: TranslationWorkerStatus | null } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_translation_worker_status")
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: true, status: null }
  return {
    ok: true,
    status: {
      observedAt: data.observed_at,
      httpStatus: Number(data.http_status),
      claimed: Number(data.claimed ?? 0),
      written: Number(data.written ?? 0),
      rateLimited: Number(data.rate_limited ?? 0),
      failed: Number(data.failed ?? 0),
    },
  }
}

/** Queue state, grouped by locale and status. Admin-gated in the database. */
export async function getTranslationProgress(): Promise<
  { ok: true; rows: QueueCell[] } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_translation_progress")
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    rows: (data ?? []).map((r: any) => ({
      locale: r.o_locale as string,
      status: r.o_status as string,
      count: Number(r.o_count),
    })),
  }
}

/**
 * Fills the queue with every published question in every non-English locale.
 *
 * Set-based in the database, so this is one statement rather than 26,100 round
 * trips. Safe to run repeatedly: it resets queued/failed rows and skips any
 * translation a person has edited by hand.
 */
export async function enqueueEverything(): Promise<
  { ok: true; queued: number } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_enqueue_all_translations")
  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/translations")
  return { ok: true, queued: Number(data ?? 0) }
}

/** Every translation of one question, for the editor. */
export async function getTranslations(questionId: string): Promise<
  { ok: true; rows: TranslationRow[] } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_question_translations", {
    p_question_id: questionId,
  })
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    rows: (data ?? []).map((r: any) => ({
      locale: r.o_locale as string,
      questionText: r.o_question_text as string,
      choices: (r.o_choices ?? []) as string[],
      explanation: (r.o_explanation ?? null) as string | null,
      source: r.o_source as string,
      isStale: Boolean(r.o_is_stale),
      updatedAt: r.o_updated_at as string,
    })),
  }
}

/**
 * Saves a correction.
 *
 * Writes with `source: 'human'`, which is what stops the pipeline ever
 * overwriting it. That is the whole basis of publishing translations
 * automatically and fixing what reads wrong: a correction that a later machine
 * pass could erase would make the workflow pointless.
 */
export async function saveTranslation(input: {
  questionId: string
  locale: Locale
  questionText: string
  choices: string[]
  explanation: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_upsert_question_translation", {
    p_question_id: input.questionId,
    p_locale: input.locale,
    p_text: input.questionText,
    p_choices: input.choices,
    p_explanation: input.explanation,
    p_source: "human",
  })
  if (error) return { ok: false, error: error.message }
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.o_success) return { ok: false, error: row?.o_error ?? "Could not save." }
  revalidatePath("/admin/translations")
  return { ok: true }
}

/**
 * The "needs a look" list: rows the automatic pass refused.
 *
 * These are the ones worth a human eye, because the database declined to
 * publish them — a translation with the wrong number of options, or two
 * choices that collapsed to the same word. Each one is a question still
 * showing in English for that locale, which is a working fallback rather than
 * an outage, so this list is a queue of improvements and not a fire.
 */
export async function getFailures(limit = 50): Promise<
  { ok: true; rows: FailedRow[] } | { ok: false; error: string }
> {
  // Through an RPC, not a table read. `translation_queue` grants nothing to
  // `authenticated` and carries no select policy — it is machinery, not
  // content — so a direct PostgREST read returns nothing even for an admin.
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_translation_failures", { p_limit: limit })

  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    rows: (data ?? []).map((r: any) => ({
      questionId: r.o_question_id as string,
      locale: r.o_locale as string,
      questionText: (r.o_question_text ?? "") as string,
      lastError: (r.o_last_error ?? null) as string | null,
      attempts: Number(r.o_attempts ?? 0),
    })),
  }
}
