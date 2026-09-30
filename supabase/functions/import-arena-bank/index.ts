/**
 * Imports the arena question bank from private Supabase Storage.
 *
 * ── Why the bank is fetched rather than embedded ──────────────────────────
 * 5,246 questions with explanations is about 3.7MB. As SQL literals that is a
 * migration nobody can read and no tool can comfortably carry. So the bank
 * is uploaded as `content-banks/arena/bank.json` in a private bucket. This
 * service-role function reads it after verifying a trusted worker or admin.
 * A public repository must never be a distribution channel for answer keys.
 *
 * That also makes revision cheap, which is the point: the owner expects to
 * adjust questions on demand. Uploading revised JSON and re-running is the
 * workflow, and re-running is safe — see the idempotency note below.
 *
 * ── The pool is not set here, and cannot be ───────────────────────────────
 * Nothing below writes `questions.pool`. Migration 0054 derives it from the
 * question's category, so filing a row under an `arena_*` category is what
 * makes it an arena question. There is deliberately no way for this importer
 * to put a question in the browsable bank by passing a wrong flag, and no way
 * to forget the flag either.
 *
 * ── Idempotency ───────────────────────────────────────────────────────────
 * Each row carries the bank's own `Q ####` number in `seed_batch` as
 * `arena:00123`. That is the natural key: the import looks up what is already
 * present by that marker and inserts only what is missing, so a re-run after a
 * partial run finishes the job rather than duplicating it. Questions already
 * imported are left exactly as they are — this never updates, so an admin's
 * correction in `/admin/questions` cannot be overwritten by a re-run.
 *
 * ── Published on arrival ──────────────────────────────────────────────────
 * `review_status` is set to `published`, matching how the seeded bank arrived.
 * The alternative — importing as draft and reviewing 5,246 questions — is not
 * a workflow anybody is going to complete, and an unpublished arena bank
 * serves nothing at all. Scholar review remains a separate, still-open axis.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { authorizePrivilegedRequest } from "../_shared/privileged-request.ts";

const BUCKET = "content-banks";
const PATH = "arena/bank.json";

interface BankRow {
  ref: number;
  slug: string;
  tier: number;
  difficulty: string;
  question: string;
  choices: string[];
  correct: number;
  explanation: string;
}

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: "supabase env missing" }), { status: 500 });
  }

  const supabase = createClient(url, serviceKey);
  const denied = await authorizePrivilegedRequest(req, supabase, true);
  if (denied) return denied;

  let limit = 6000;
  let dryRun = false;
  try {
    const body = await req.json();
    if (Number.isFinite(body?.limit)) limit = Math.max(1, Math.min(6000, Math.floor(body.limit)));
    dryRun = Boolean(body?.dryRun);
  } catch {
    /* defaults stand */
  }

  // The arena categories, by slug. A bank row naming a slug that does not
  // exist is reported rather than guessed at.
  const { data: cats, error: catError } = await supabase
    .from("categories")
    .select("id, slug, pool")
    .eq("pool", "arena");
  if (catError) {
    return new Response(JSON.stringify({ error: catError.message }), { status: 500 });
  }
  const categoryBySlug = new Map<string, string>();
  for (const c of cats ?? []) {
    categoryBySlug.set((c as { slug: string }).slug, (c as { id: string }).id);
  }
  if (categoryBySlug.size === 0) {
    return new Response(
      JSON.stringify({ error: "no arena categories: apply migration 0055 first" }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data: bankFile, error: bankError } = await supabase.storage.from(BUCKET).download(PATH);
  if (bankError || !bankFile) {
    return new Response(
      JSON.stringify({ error: "Private arena bank is unavailable. Upload arena/bank.json to the content-banks bucket." }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
  let bank: BankRow[];
  try {
    const parsed = JSON.parse(await bankFile.text());
    if (!Array.isArray(parsed)) throw new Error("Expected a question array");
    bank = parsed;
  } catch {
    return Response.json({ error: "Private arena bank is not a JSON array" }, { status: 422 });
  }

  // What is already in. `seed_batch` is the natural key.
  const present = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("questions")
      .select("seed_batch")
      .like("seed_batch", "arena:%")
      .range(from, from + 999);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    for (const r of data ?? []) present.add((r as { seed_batch: string }).seed_batch);
    if (!data || data.length < 1000) break;
  }

  const rows: Record<string, unknown>[] = [];
  const skipped: string[] = [];
  for (const b of bank) {
    const marker = `arena:${String(b.ref).padStart(5, "0")}`;
    if (present.has(marker)) continue;
    const categoryId = categoryBySlug.get(b.slug);
    if (!categoryId) {
      skipped.push(`${marker}: unknown category ${b.slug}`);
      continue;
    }
    if (!Array.isArray(b.choices) || b.choices.length !== 4) {
      skipped.push(`${marker}: ${b.choices?.length ?? 0} choices`);
      continue;
    }
    if (!(b.correct >= 0 && b.correct < b.choices.length)) {
      skipped.push(`${marker}: correct index ${b.correct} out of range`);
      continue;
    }
    rows.push({
      category_id: categoryId,
      question_text: b.question,
      choices: b.choices,
      correct_choice_index: b.correct,
      explanation: b.explanation || null,
      difficulty: b.difficulty,
      tier: b.tier,
      tier_is_estimated: false,
      review_status: "published",
      source_type: "human",
      seed_batch: marker,
    });
    if (rows.length >= limit) break;
  }

  const summary = {
    source: `${BUCKET}/${PATH}`,
    inBank: bank.length,
    alreadyPresent: present.size,
    toInsert: rows.length,
    skipped: skipped.length,
    skippedDetail: skipped.slice(0, 20),
    dryRun,
  };
  if (dryRun) {
    return new Response(JSON.stringify({ ...summary, inserted: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 250) {
    const { error, count } = await supabase
      .from("questions")
      .insert(rows.slice(i, i + 250), { count: "exact" });
    if (error) {
      return new Response(JSON.stringify({ ...summary, inserted, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    inserted += count ?? 0;
  }

  return new Response(JSON.stringify({ ...summary, inserted }), {
    headers: { "Content-Type": "application/json" },
  });
});
