/**
 * Reading a narration apart from its chain.
 *
 * The hadith of the day was rendering, verbatim from the imported edition:
 *
 *     Narrated Abu Huraira:I heard Allah's Messenger (ﷺ) saying, ...
 *
 * Two faults in eleven characters, and the owner caught both.
 *
 *   1. **"Narrated Abu Huraira" is not English.** It is a heading convention
 *      from the printed edition — the narrator's name set on its own line
 *      above the text — flattened into one string when the edition was
 *      imported. Read as a sentence it is missing its "by", which is exactly
 *      what was reported.
 *   2. **There is no space after the colon.** The chain runs straight into the
 *      first word of the narration, so the eye reads "Huraira:I" as one token.
 *      250 of the 391 English rows are like this.
 *
 * ── Why this is a reader and not a migration ──────────────────────────────
 * The obvious fix is an `update` over `hadith_translations`, and it is the
 * wrong one. `0047` sets out this project's rule about hadith text at length:
 * it comes from a published edition or is typed by hand, it is never generated
 * and never rewritten, because a narration is a claim about what the Prophet ﷺ
 * said and there would be nothing to check an edit against. A stored text that
 * has been "tidied" is no longer the text of the edition it cites.
 *
 * So the stored bytes do not move. This splits the heading off at **render**
 * time, which is reversible, costs one regex per view, and is a presentation
 * decision made where presentation decisions belong. It is also the only
 * version that keeps working when someone types a new hadith at
 * `/admin/hadiths` and leaves the same colon out.
 *
 * ── Why it does not touch the other five languages ────────────────────────
 * It does, and finds nothing, which is the point. The prefix pattern begins
 * with the literal word "Narrated", so no Arabic, French, Hausa, Indonesian or
 * Malay row can match it; the colon repair requires a Latin letter or a
 * closing bracket *before* the colon, so no Arabic row can match that either.
 * Confirmed against the live table: of the 1,513 rows, the 391 English ones
 * are the only ones with either shape. That is a property of the imports, not
 * a guess — the French and Arabic editions were typeset properly.
 */

/**
 * `Narrated <someone>:` at the very start, with `by` tolerated in case a
 * hand-typed row already reads correctly.
 *
 * Bounded to 90 characters because that is the longest real one — *"Narrated
 * 'Ata (while Abu Huraira was narrating (see previous hadith))"* — and an
 * unbounded `[^:]+` would happily swallow a paragraph up to the first colon of
 * a Qur'anic citation and present it as a narrator's name.
 */
const NARRATOR_PREFIX = /^\s*Narrated\s+(?:by\s+)?([^:\n]{1,90}?)\s*:\s*/

/**
 * A colon with no space after it.
 *
 * Both sides are constrained, and each constraint is a real row in the table:
 *
 *   - The character **before** must be a Latin letter or `)`. Without that,
 *     `(6:83)` — the citation of Qur'an 6:83, which appears in twelve rows —
 *     becomes `(6: 83)`.
 *   - The character **after** must be a letter or an opening quote. Without
 *     that, a row that reads `an-Nawawi says:] We have related` becomes
 *     `says: ]`, which is not better.
 */
const TIGHT_COLON = /([A-Za-z)]):(?=["“'‘A-Za-z])/g

export interface Narration {
  /**
   * The chain of transmission as the edition printed it, without the word
   * "Narrated" and without the colon — `"Abu Huraira"`. Null when the text
   * does not carry one, which is every row in five of the six languages and
   * 89 of the English ones.
   */
  narrator: string | null
  /** The narration itself, starting at its first real word. */
  body: string
}

/** Collapse runs of whitespace; a name split over an imported line break is
 * still one name. */
function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

/**
 * Split a hadith into its chain and its text.
 *
 * Pure, total, and idempotent: feeding the `body` back in returns it
 * unchanged, so it is safe to call on text that has already been through it
 * — which matters because the admin screen will one day save a corrected row.
 */
export function splitNarration(text: string): Narration {
  const source = text ?? ""
  const match = NARRATOR_PREFIX.exec(source)

  if (match) {
    const candidate = tidy(match[1])
    // A heading is a name, not a sentence. Anything carrying speech marks or
    // terminal punctuation is prose that happens to begin with the word
    // "Narrated", and lifting it out would silently delete the first sentence
    // of the hadith.
    const looksLikeAName = /[A-Za-z؀-ۿ]/.test(candidate) && !/["“”!?]/.test(candidate)
    const body = spaceAfterColons(source.slice(match[0].length))
    if (looksLikeAName && body) {
      return { narrator: candidate, body }
    }
  }

  return { narrator: null, body: spaceAfterColons(source) }
}

/** The colon repair on its own, for text with no heading to remove. */
export function spaceAfterColons(text: string): string {
  return (text ?? "").replace(TIGHT_COLON, "$1: ").trim()
}
