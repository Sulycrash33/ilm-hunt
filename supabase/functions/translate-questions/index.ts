/**
 * Translates queued questions into the app's five non-English locales.
 *
 * Invoked by `cron_run_translations` every two minutes, and only when the
 * queue has something in it. One batch per invocation; the cron tick is the
 * loop, so a run that dies takes one batch with it rather than a whole
 * backfill.
 *
 * Within a batch the rows are translated by a bounded pool of workers rather
 * than one at a time — see the note on it below. Throughput is now the product
 * of three dials that can all be turned without touching this file: the cron
 * cadence, the batch size in `cron_run_translations`, and TRANSLATE_CONCURRENCY
 * in this function's environment.
 *
 * ── Why this lives here and not on Vercel ─────────────────────────────────
 * A worker needs a privileged, non-interactive credential. Supabase injects
 * SUPABASE_SERVICE_ROLE_KEY into an edge function's environment; putting the
 * worker on Vercel would have meant copying that key into a second place, and
 * a service-role key in a web app's environment is a much larger blast radius
 * than one in the function that already runs as the database's owner.
 *
 * ── The prompt is the safety mechanism, and it is not the only one ────────
 * Translations publish without human review — the owner's decision, made
 * knowing the trade. So the model is told, in the strongest terms the format
 * allows, the two things that would make a question mis-grade: changing the
 * number of options, and rendering two distinct rulings with the same word.
 * `complete_translation` then checks both again in the database and refuses
 * the write if either happened. The prompt is a request; the check is the
 * guarantee.
 *
 * The choices array is translated *positionally*. `correct_choice_index`
 * points at a slot, not at a string, so option 3 must still be option 3 in
 * Hausa or a correct answer is graded wrong.
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

interface QueueRow {
  o_question_id: string;
  o_locale: string;
  o_text: string;
  o_choices: string[];
  o_explanation: string | null;
}

function buildPrompt(row: QueueRow, languageName: string): string {
  return [
    `You are translating one multiple-choice question for an Islamic knowledge`,
    `quiz from English into ${languageName}.`,
    ``,
    `RULES, in order of importance:`,
    ``,
    `1. Return EXACTLY ${row.o_choices.length} choices, in the SAME ORDER as`,
    `   the English. The correct answer is identified by its position, so`,
    `   reordering or dropping one marks a correct answer as wrong.`,
    `2. No two choices may mean the same thing in ${languageName}. Where the`,
    `   English distinguishes two rulings or two categories — fard and sunnah,`,
    `   for instance — the translation must keep them distinguishable, even if`,
    `   that needs a longer phrase. Two identical-sounding options leave the`,
    `   player no correct answer to choose.`,
    `3. Keep established Islamic terms in their usual ${languageName} form.`,
    `   Do not translate proper nouns, the names of Allah, Qur'anic surah`,
    `   names, or the names of narrators and scholars. Transliterate rather`,
    `   than invent.`,
    `4. Do not add, remove or "correct" any religious content. You are`,
    `   translating, not teaching. If the English says something you would`,
    `   phrase differently, translate what it says.`,
    `5. Keep the register plain and readable for a learner, matching the`,
    `   English.`,
    ``,
    `Return ONLY minified JSON, no markdown fence, of the shape:`,
    `{"question":"...","choices":["...", "..."],"explanation":"..."}`,
    row.o_explanation ? `` : `Omit "explanation"; the English has none.`,
    ``,
    `ENGLISH QUESTION:`,
    row.o_text,
    ``,
    `ENGLISH CHOICES (keep this order):`,
    ...row.o_choices.map((c, i) => `${i + 1}. ${c}`),
    row.o_explanation ? `\nENGLISH EXPLANATION:\n${row.o_explanation}` : ``,
  ].join("\n");
}

/** Strips a ```json fence if the model adds one despite being asked not to. */
function parseModelJson(raw: string): { question: string; choices: string[]; explanation?: string } {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

/**
 * The model, overridable without a redeploy.
 *
 * Hardcoding it cost a batch: `gemini-2.0-flash` was retired, and every call
 * came back `404 ... is no longer available`. The queue handled that correctly
 * — five rows went back to `queued` with the reason recorded rather than being
 * lost — but fixing it still meant shipping code. Reading the name from the
 * environment means the next retirement is a dashboard edit.
 */
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.6-flash";

/**
 * A fault that is about the moment, not about the row.
 *
 * A rate limit or a 503 says the model was busy; it says nothing at all about
 * whether this question can be translated. Counting one as an attempt means
 * three busy minutes can mark a perfectly good row `failed` and take it out of
 * the backfill for good — and raising the throughput makes rate limits the
 * *expected* way a batch ends, not an exotic one. So these hand the claim back
 * instead, exactly as running out of wall clock does.
 */
class RetryableError extends Error {}

/**
 * What a 429 actually says, once enough of it is kept.
 *
 * This used to slice the response body at 300 characters and log that. Google
 * puts the prose first and the machine-readable part last, so 300 characters
 * captured the sentence everyone had already read — "You exceeded your current
 * quota" — and cut off the only part that answers the next question. Two days
 * of logs came back byte-identical, every one of them ending `* Quota ex`,
 * which is the beginning of the word that mattered.
 *
 * The useful fields live in `error.details`: a `google.rpc.QuotaFailure` with
 * one violation per limit hit, and often a `RetryInfo`. `quotaId` is what
 * separates a per-minute throttle from a per-day cap — "slow down" from "come
 * back tomorrow" — and nothing else in this function can tell those apart.
 * Diagnosing it without them took reading two days of success *timestamps* to
 * find they clustered at one hour of the day.
 *
 * The summary goes in front of the raw body deliberately. The failure being
 * fixed here was a truncation, and a summary appended after 1,200 characters
 * of JSON would be the same bug waiting for a longer error.
 */
function describeModelError(status: number, body: string): string {
  const notes: string[] = [];
  try {
    const err = JSON.parse(body)?.error;
    for (const d of err?.details ?? []) {
      const type = String(d?.["@type"] ?? "");
      if (type.endsWith("QuotaFailure")) {
        for (const v of d?.violations ?? []) {
          notes.push(`quota=${v?.quotaId ?? "?"} limit=${v?.quotaValue ?? "?"}`);
        }
      } else if (type.endsWith("RetryInfo") && d?.retryDelay) {
        notes.push(`retryDelay=${d.retryDelay}`);
      }
    }
  } catch {
    // Not JSON, or not the shape expected. The raw body below still stands,
    // and an unparseable body is itself worth seeing in full.
  }
  const summary = notes.length ? ` [${notes.join("; ")}]` : "";
  return `model returned ${status}:${summary} ${body.slice(0, 1200)}`;
}

async function translate(row: QueueRow, apiKey: string) {
  const languageName = LOCALE_NAMES[row.o_locale] ?? row.o_locale;

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(row, languageName) }] }],
          generationConfig: {
            // Deterministic-ish. A translation that changes between runs would
            // make a player's review history disagree with what they answered.
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      },
    );
  } catch (e) {
    // A socket that never opened is the network, not the question.
    throw new RetryableError(`network: ${String((e as Error).message ?? e).slice(0, 200)}`);
  }

  if (!res.ok) {
    const detail = describeModelError(res.status, await res.text());
    // 429 is the rate limit; 5xx is the model's own trouble. A 400 or a 404 is
    // ours — a bad prompt or a model name that has been retired — and those
    // must keep counting, because retrying them forever would hide them.
    if (res.status === 429 || res.status >= 500) throw new RetryableError(detail);
    throw new Error(detail);
  }

  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("model returned no text");

  const parsed = parseModelJson(text);
  if (!parsed || typeof parsed.question !== "string" || !Array.isArray(parsed.choices)) {
    throw new Error("model returned an unexpected shape");
  }
  return parsed;
}

Deno.serve(async (req) => {
  const startedAt = Date.now();
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("GEMINI_API_KEY");

  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: "supabase env missing" }), { status: 500 });
  }
  const supabase = createClient(url, serviceKey);
  const denied = await authorizePrivilegedRequest(req, supabase);
  if (denied) return denied;
  if (!apiKey) {
    // Named plainly so the admin page can say what is wrong rather than
    // showing a queue that mysteriously never drains.
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY is not set on this function" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let limit = 20;
  try {
    const body = await req.json();
    if (typeof body?.limit === "number") limit = body.limit;
  } catch {
    /* an empty body is fine; the default stands */
  }

  const { data: batch, error: claimError } = await supabase.rpc("claim_translation_batch", {
    p_limit: limit,
  });
  if (claimError) {
    return new Response(JSON.stringify({ error: claimError.message }), { status: 500 });
  }

  const rows = (batch ?? []) as QueueRow[];
  let written = 0;
  let refused = 0;
  let failed = 0;
  let released = 0;
  // Reported separately from `released` so a tuning run can tell "we ran out
  // of clock" apart from "the model pushed back", which are the same recovery
  // and completely different signals about whether the dial is set too high.
  let rateLimited = 0;

  /**
   * Stop before the runtime stops us.
   *
   * An edge function has a wall clock, and one translation measured at roughly
   * forty seconds — so the first real batch of five was killed partway through
   * its fifth item. The HTTP response never arrived, and that row sat `claimed`
   * until the ten-minute reclaim swept it up.
   *
   * Finishing early and handing the rest back is strictly better: the work is
   * queued again immediately, and `release_translation_claim` gives back the
   * attempt that claiming spent, so a row the model never actually saw cannot
   * be marked failed for it.
   */
  const deadline = Date.now() + 110_000;

  /**
   * ── Why this is a pool and no longer a plain loop ────────────────────────
   *
   * It used to be sequential, on the reasoning that firing a whole batch of
   * concurrent model calls is the fastest way to hit a rate limit. That is
   * true of an *unbounded* fan-out and it is why this is bounded rather than a
   * `Promise.all` over the batch.
   *
   * But sequential made the wall clock the ceiling. One translation measured
   * at roughly forty seconds, so a 110-second budget spent one at a time fits
   * two, maybe three — about 860 a day, and 26,100 of them is a month of
   * waiting for a backfill nobody can watch.
   *
   * A fixed number of workers drawing from one queue changes the arithmetic
   * without changing the risk profile: in-flight calls never exceed
   * TRANSLATE_CONCURRENCY no matter how large the batch grows, so the rate the
   * model sees is a number set here rather than a consequence of the batch
   * size.
   *
   * Started at six. The first real run at that setting showed 12 of 12 rows
   * rate-limited on nearly every two-minute tick — Gemini rejecting most of
   * the batch outright rather than the ~40s-per-call throttling this was
   * sized around, and the refund made that cheap enough to run for half an
   * hour before anyone noticed the throughput hadn't moved. Turned down to
   * two while the actual per-key quota is unknown; `console.error` above now
   * logs what the API says — including, since the quota detail was widened,
   * the `quotaId` that says whether the limit is per minute or per day — and
   * the honest way to raise this again is to read that, not to guess a second
   * number.
   *
   * And the failure mode is now cheap. A 429 releases the claim with its
   * attempt refunded, so pushing the rate too high costs throughput and
   * nothing else — the queue is exactly as it was, and the next tick tries
   * again. That is what makes the dial safe to turn.
   */
  const CONCURRENCY = Math.max(1, Number(Deno.env.get("TRANSLATE_CONCURRENCY") ?? 2));

  let next = 0;

  async function release(row: QueueRow) {
    await supabase.rpc("release_translation_claim", {
      p_question_id: row.o_question_id,
      p_locale: row.o_locale,
    });
    released += 1;
  }

  async function worker() {
    // `next++` is atomic here in the only sense that matters: Deno runs one
    // JavaScript thread, so no two workers can read the same index. The awaits
    // below are where control changes hands, and by then the index is taken.
    while (true) {
      const i = next++;
      if (i >= rows.length) return;
      const row = rows[i];

      // Out of time. Hand this one back rather than starting a call the
      // runtime will kill halfway through: an unanswered claim sits
      // `in_progress` until the ten-minute reclaim, and the row would burn an
      // attempt having never reached the model.
      if (Date.now() > deadline) {
        await release(row);
        continue;
      }

      try {
        const out = await translate(row, apiKey);
        const { data, error } = await supabase.rpc("complete_translation", {
          p_question_id: row.o_question_id,
          p_locale: row.o_locale,
          p_text: out.question,
          p_choices: out.choices,
          p_explanation: out.explanation ?? null,
        });
        if (error) throw new Error(error.message);
        const result = Array.isArray(data) ? data[0] : data;
        if (result?.o_success) written += 1;
        else refused += 1;
      } catch (e) {
        if (e instanceof RetryableError) {
          // Logged, not swallowed: the first real run at concurrency 6 showed
          // 12/12 rate-limited on almost every tick with no way to see why,
          // which is what forced concurrency back down blind rather than by
          // measurement. This is the fix for that gap, not just this run.
          console.error("translate-questions: retryable,", e.message);
          await release(row);
          rateLimited += 1;
          continue;
        }
        failed += 1;
        await supabase.rpc("complete_translation", {
          p_question_id: row.o_question_id,
          p_locale: row.o_locale,
          p_text: null,
          p_choices: null,
          p_error: String((e as Error).message ?? e).slice(0, 500),
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, rows.length) }, () => worker()),
  );

  const summary = {
    claimed: rows.length,
    written,
    refused,
    failed,
    released,
    rateLimited,
    concurrency: CONCURRENCY,
    elapsedMs: Date.now() - startedAt,
  };
  // HTTP 200 includes batches that only return claims to the queue. Log the
  // same aggregate counters so completion can be distinguished from retries.
  // Existing released/rateLimited counters describe attempted release and
  // retryable errors respectively; neither proves a persisted state change.
  console.info("translate-questions: batch", JSON.stringify(summary));

  return new Response(
    JSON.stringify(summary),
    { headers: { "Content-Type": "application/json" } },
  );
});
