/**
 * Imports published editions of the narrations already in `hadiths` into the
 * app's other locales.
 *
 * ── This is an importer. It is emphatically not a translator ──────────────
 * Migration 0047 sets out at length why the daily hadith has no translation
 * pipeline, and nothing here weakens that. A narration is a claim about what
 * the Prophet ﷺ said; the question pipeline's guard — that a mistranslation
 * must not change which answer is correct — has no counterpart here, because
 * there is nothing to check a generated hadith against. So this calls no
 * model. It fetches text that a publisher already produced and a human already
 * authenticated, exactly as the English in 0050 arrived, and writes it
 * verbatim.
 *
 * For Arabic it is not even an import of a translation: it is the narration in
 * the language it was narrated in. That is the one locale where the app can
 * show a hadith with no translator standing between the player and the text.
 *
 * ── Why an edge function rather than a data migration ─────────────────────
 * 0050 embedded its English as SQL literals, which suits 391 rows of one
 * locale. The same shape for three more locales is the better part of a
 * megabyte of Arabic and French pasted through a tool that should not be
 * carrying scripture as a string literal. Fetching at run time from a pinned
 * tag keeps the provenance legible — the source and the tag are right here in
 * the code — and makes the whole thing re-runnable when an edition improves.
 *
 * ── Safety ────────────────────────────────────────────────────────────────
 * The only write is an insert that ignores conflicts. It cannot update and
 * cannot delete, so the English already present for all 391, and anything an
 * admin has typed by hand in `/admin/hadiths`, are both untouchable from here.
 * Re-running is a no-op. `verify_jwt` stays on: this is reachable only with a
 * service-role credential, never from a browser.
 *
 * One edition per invocation, by `edition` in the body. The Arabic Bukhari
 * alone is ~9.7MB of JSON, and parsing several of those in one run is how an
 * edge function meets its memory ceiling rather than its deadline.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { authorizePrivilegedRequest } from "../_shared/privileged-request.ts";

/**
 * Pinned to the same tag migration 0050 used for the English.
 *
 * `@1` is the tag, not a floating branch. An edition that changes under us
 * would silently disagree with the English it sits beside.
 */
const BASE = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";

/** edition slug -> the locale it fills and the reference prefix it covers. */
const EDITIONS: Record<string, { locale: string; source: string }> = {
  "ara-bukhari": { locale: "ar", source: "bukhari" },
  "ara-nawawi": { locale: "ar", source: "nawawi" },
  "ara-qudsi": { locale: "ar", source: "qudsi" },
  "fra-bukhari": { locale: "fr", source: "bukhari" },
  "fra-nawawi": { locale: "fr", source: "nawawi" },
  "fra-qudsi": { locale: "fr", source: "qudsi" },
  "ind-bukhari": { locale: "id", source: "bukhari" },
};

/**
 * How each collection cites itself, per locale.
 *
 * `attribution` is what the card prints under the quotation, so it belongs in
 * the reader's language and script rather than being the English label copied
 * across. Arabic names the collections as Arabic names them.
 */
const ATTRIBUTION: Record<string, (n: number) => string> = {
  "ar:bukhari": (n) => `صحيح البخاري ${n}`,
  "ar:nawawi": (n) => `الأربعون النووية، حديث ${n}`,
  "ar:qudsi": (n) => `الأربعون القدسية، حديث ${n}`,
  "fr:bukhari": (n) => `Sahih al-Bukhari ${n}`,
  "fr:nawawi": (n) => `40 Hadiths an-Nawawi, Hadith ${n}`,
  "fr:qudsi": (n) => `40 Hadiths Qudsi, Hadith ${n}`,
  "id:bukhari": (n) => `Shahih Bukhari ${n}`,
};

/**
 * ── Hausa, which no edition above publishes ───────────────────────────────
 *
 * The source used for the seven editions above has no Hausa at all. This is a
 * second publisher: the Encyclopedia of Translated Prophetic Hadiths
 * (hadeethenc.com), which renders a curated hadith corpus into 72 languages,
 * Hausa among them, each entry human-translated and carrying its Arabic
 * original and a grading. Still an import, still no model.
 *
 * The obstacle is that the encyclopedia keys entries by its own ids and cites
 * sources by collection alone — "Bukhari ne ya rawaito shi", with no hadith
 * number — so there is nothing to join on. What made a join possible is that
 * both sides hold the narration in Arabic once the editions above have run:
 * the match is on the text, not on a number.
 *
 * The mapping below is the *result* of that matching, not the matching itself,
 * and it is checked in deliberately. Doing the comparison here at run time
 * would mean re-deriving a scripture-to-scripture mapping on every invocation
 * with no one reading the output; a fixed table of 62 pairs can be reviewed in
 * a diff, which is the appropriate amount of ceremony for attaching a hadith
 * text to a hadith reference.
 *
 * How it was produced, so it can be reproduced or challenged: both Arabic
 * texts normalised (diacritics, tatweel and punctuation stripped, alef, ya and
 * ta-marbuta folded), compared as sets of five-word shingles, scored by
 * overlap against the shorter text. Accepted only at overlap >= 0.70 with at
 * least ten shared shingles, rejected whenever the runner-up scored within 80%
 * of the best — hadith wording repeats across narrations, and a near-tie is
 * exactly where the wrong text gets attached to the right reference — and
 * cross-checked against the encyclopedia's own attribution, so a `bukhari:N`
 * whose match was not attributed to Bukhari was dropped. Of 391: 127 matched
 * strongly, 14 fell to ambiguity, 1 to attribution, 50 were too weak, and 62
 * survived.
 *
 * Three were then read end to end against the English already in the table
 * rather than trusted from a score — bukhari:10, bukhari:12 and bukhari:122 —
 * and all three corresponded exactly.
 *
 * An id appearing twice is correct, not a mistake: Nawawi's forty are drawn
 * from Bukhari and Muslim, so one narration legitimately sits under two of our
 * references.
 *
 * The remaining 329 stay English. That is the designed per-narration fallback,
 * and closing it means more published Hausa or an admin typing at
 * /admin/hadiths — never a model.
 */
const HADEETHENC = "https://hadeethenc.com/api/v1/hadeeths/one/?language=ha&id=";

const HAUSA_MAP: Record<string, number> = {
  "bukhari:10": 10101, "bukhari:12": 5808, "bukhari:13": 4717, "bukhari:15": 5953,
  "bukhari:18": 66210, "bukhari:20": 65121, "bukhari:25": 4211, "bukhari:31": 4304,
  "bukhari:39": 5795, "bukhari:45": 65298, "bukhari:63": 65044, "bukhari:66": 3005,
  "bukhari:71": 5518, "bukhari:79": 4233, "bukhari:99": 3414, "bukhari:122": 8304,
  "bukhari:128": 10098, "bukhari:6412": 5449, "bukhari:6416": 4704, "bukhari:6420": 66221,
  "bukhari:6455": 65815, "bukhari:6488": 3581, "bukhari:6491": 4322, "bukhari:6506": 65026,
  "bukhari:6516": 5364, "bukhari:6523": 65068, "bukhari:6547": 3745, "bukhari:6549": 8343,
  "bukhari:6557": 8315, "bukhari:6579": 65030, "bukhari:6593": 65031,
  "nawawi:1": 66511, "nawawi:2": 4563, "nawawi:4": 66513, "nawawi:5": 66514,
  "nawawi:8": 4211, "nawawi:10": 66518, "nawawi:16": 4709, "nawawi:17": 66521,
  "nawawi:18": 4302, "nawawi:21": 66524, "nawawi:22": 66525, "nawawi:23": 66526,
  "nawawi:24": 4810, "nawawi:25": 4558, "nawawi:28": 66529, "nawawi:29": 66530,
  "nawawi:30": 66510, "nawawi:31": 4307, "nawawi:32": 66531, "nawawi:33": 66532,
  "nawawi:34": 65001, "nawawi:35": 4706, "nawawi:37": 66533, "nawawi:39": 4216,
  "nawawi:41": 66535,
  "qudsi:11": 5805, "qudsi:16": 4322, "qudsi:17": 4810, "qudsi:18": 5544,
  "qudsi:21": 66163, "qudsi:33": 4817,
};

/** Hausa citation, keeping the number the reference is actually built on. */
function hausaAttribution(reference: string): string {
  const [src, n] = reference.split(":");
  if (src === "bukhari") return `Sahihul Bukhari ${n}`;
  if (src === "nawawi") return `Hadisai 40 na Nawawi, Hadisi ${n}`;
  return `Hadisai 40 Qudsi, Hadisi ${n}`;
}

/**
 * Fetches the Hausa for each mapped narration and inserts it.
 *
 * One request per entry, 62 of them, which is small enough to do in a single
 * invocation. An entry that has gone missing upstream, or come back without
 * Hausa text, is skipped and reported rather than written as an empty
 * quotation — the card falls back to English, which is the designed behaviour.
 */
async function importHausa(
  supabase: ReturnType<typeof createClient>,
  dryRun: boolean,
): Promise<Response> {
  const { data: hadiths, error: readError } = await supabase
    .from("hadiths")
    .select("id, reference");
  if (readError) {
    return new Response(JSON.stringify({ error: readError.message }), { status: 500 });
  }

  const idByReference = new Map<string, string>();
  for (const h of hadiths ?? []) {
    idByReference.set(
      String((h as { reference: string }).reference),
      (h as { id: string }).id,
    );
  }

  const rows: { hadith_id: string; locale: string; text: string; attribution: string }[] = [];
  const skipped: string[] = [];

  for (const [reference, encId] of Object.entries(HAUSA_MAP)) {
    const hadithId = idByReference.get(reference);
    if (!hadithId) {
      skipped.push(`${reference}: not in hadiths`);
      continue;
    }
    let text = "";
    try {
      const res = await fetch(`${HADEETHENC}${encId}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) {
        skipped.push(`${reference}: HTTP ${res.status}`);
        continue;
      }
      const body = await res.json();
      text = String(body?.hadeeth ?? "").trim();
    } catch (e) {
      skipped.push(`${reference}: ${String((e as Error).message ?? e).slice(0, 80)}`);
      continue;
    }
    if (!text) {
      skipped.push(`${reference}: no Hausa text`);
      continue;
    }
    rows.push({
      hadith_id: hadithId,
      locale: "ha",
      text,
      attribution: hausaAttribution(reference),
    });
  }

  const summary = {
    edition: "ha-hadeethenc",
    locale: "ha",
    mapped: Object.keys(HAUSA_MAP).length,
    fetched: rows.length,
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
  for (let i = 0; i < rows.length; i += 200) {
    const { error, count } = await supabase
      .from("hadith_translations")
      .upsert(rows.slice(i, i + 200), {
        onConflict: "hadith_id,locale",
        ignoreDuplicates: true,
        count: "exact",
      });
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

  let edition = "";
  let dryRun = false;
  try {
    const body = await req.json();
    edition = String(body?.edition ?? "");
    dryRun = Boolean(body?.dryRun);
  } catch {
    /* handled by the check below */
  }

  const spec = EDITIONS[edition];
  if (!spec && edition !== "ha-hadeethenc") {
    return new Response(
      JSON.stringify({
        error: "unknown edition",
        known: [...Object.keys(EDITIONS), "ha-hadeethenc"],
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (edition === "ha-hadeethenc") {
    return await importHausa(supabase, dryRun);
  }

  // The narrations this app actually carries. Only these are imported: the
  // editions hold thousands more, and the rotation is a curated subset.
  const { data: hadiths, error: readError } = await supabase
    .from("hadiths")
    .select("id, reference");
  if (readError) {
    return new Response(JSON.stringify({ error: readError.message }), { status: 500 });
  }

  const byNumber = new Map<number, string>();
  for (const h of hadiths ?? []) {
    const [src, num] = String((h as { reference: string }).reference).split(":");
    if (src === spec.source) byNumber.set(Number(num), (h as { id: string }).id);
  }

  const res = await fetch(`${BASE}/${edition}.json`);
  if (!res.ok) {
    return new Response(
      JSON.stringify({ error: `edition fetch failed: ${res.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
  const payload = await res.json();

  const attribute = ATTRIBUTION[`${spec.locale}:${spec.source}`];
  const rows: { hadith_id: string; locale: string; text: string; attribution: string }[] = [];
  let missingText = 0;

  for (const h of payload?.hadiths ?? []) {
    const n = Number(h?.hadithnumber);
    if (!Number.isInteger(n)) continue;
    const hadithId = byNumber.get(n);
    if (!hadithId) continue;
    const text = String(h?.text ?? "").trim();
    // An edition can carry a number with no text behind it. That row stays
    // English on the card, which is 0047's designed fallback — it is not an
    // error and must not become an empty quotation.
    if (!text) {
      missingText += 1;
      continue;
    }
    rows.push({
      hadith_id: hadithId,
      locale: spec.locale,
      text,
      attribution: attribute(n),
    });
  }

  const summary = {
    edition,
    locale: spec.locale,
    source: spec.source,
    carried: byNumber.size,
    matched: rows.length,
    skippedNoText: missingText,
    dryRun,
  };

  if (dryRun) {
    return new Response(JSON.stringify({ ...summary, inserted: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Insert only, conflicts ignored: English and any hand-entered locale are
  // beyond reach of this function by construction.
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error, count } = await supabase
      .from("hadith_translations")
      .upsert(chunk, { onConflict: "hadith_id,locale", ignoreDuplicates: true, count: "exact" });
    if (error) {
      return new Response(
        JSON.stringify({ ...summary, inserted, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    inserted += count ?? 0;
  }

  return new Response(JSON.stringify({ ...summary, inserted }), {
    headers: { "Content-Type": "application/json" },
  });
});
