/**
 * Fills empty hadith locales with model output.
 *
 * Invoked by hand. There is no cron entry and no trigger for this, on purpose:
 * `translate-questions` runs continuously because the question bank grows and
 * nobody should have to think about it, whereas this exists because the owner
 * asked for machine translation "just for testing sake" and said they would
 * say when to stop. Something that only runs when somebody runs it is a much
 * easier thing to stop than something that runs on a timer.
 *
 *   POST /functions/v1/translate-hadiths
 *   { "locale": "ha", "limit": 20 }
 *   { "locale": "ha", "reference": "bukhari:6469" }   // just this one
 *
 * ── What it is allowed to touch ───────────────────────────────────────────
 * Only (hadith, locale) pairs with no row at all. That is not enforced here —
 * it is enforced by `complete_hadith_translation`, which inserts with
 * `on conflict do nothing` and has no update statement to reach for. This
 * function could be rewritten carelessly tomorrow and still not be able to
 * overwrite a published edition. See migration 0065.
 *
 * ── The prompt, and the one thing it must not do ──────────────────────────
 * `translate-questions` guards against a mistranslation changing which answer
 * is correct, and can check its own output because the choice count and the
 * correct index are structural. Nothing of that kind exists here: a hadith is
 * prose, and a wrong translation is wrong in a way no database check can see.
 *
 * So the prompt carries the whole burden, and the instructions it leads with
 * are aimed at the specific failure that matters — a model *improving* a
 * narration. Do not smooth it, do not explain it, do not resolve what the
 * English left ambiguous, do not drop or add a clause. The reference number
 * never reaches the model at all: `complete_hadith_translation` copies the
 * attribution across from the English row, so there is no path by which a
 * paraphrased citation could attach a narration to the wrong number.
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
