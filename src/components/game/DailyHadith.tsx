"use client";

import { useEffect, useState } from "react";
import { Quote } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { splitNarration } from "@/lib/narration";
import { getDailyHadith, type DailyHadithView } from "@/app/(app)/home/actions";

/**
 * The opening word on the home screen.
 *
 * This component existed and was **imported by the home page without ever
 * being rendered**, the same fault `StreakCounter` had on the same file. So the
 * app had a hadith card built, styled and translated, and nobody ever saw it.
 *
 * Given room here because it is the one part of the home screen that is not a
 * number: a page that opens with progress rings and streak counts is a
 * scoreboard, and this is meant to be a place of study. The quote is set in the
 * serif at quote size, the attribution sits under it as a `cite` rather than
 * being joined on with a dash, and the khatim runs behind it.
 *
 * ── On the word "daily" ───────────────────────────────────────────────────
 * It is now actually daily. The narration comes from the `hadiths` table and
 * is chosen by the date, so every player sees the same one on the same day —
 * the deterministic choice migration 0008 established for the rewards, for the
 * same reason: a rotation nobody can predict is not a calendar.
 *
 * ── On the fallback ───────────────────────────────────────────────────────
 * The card holds every locale of today's narration and picks one on render, so
 * changing language is instant and needs no network. A locale nobody has
 * entered text for falls back to English rather than blanking, which is the
 * same per-row fallback the question translations use: a partly translated
 * bank is a working bank.
 *
 * Hadith text is never machine-translated. `0047` sets out why at length: a
 * narration is a claim about what the Prophet ﷺ said, published translations
 * exist, and there would be nothing to check a model's output against. Text
 * arrives either from a published edition — Arabic, French and most of the
 * Indonesian were imported from one, see `import-hadith-editions` — or typed
 * by hand at `/admin/hadiths`. Never from a model.
 *
 * ── The narrator ─────────────────────────────────────────────────────────
 * The chain is drawn above the quotation and the reference below it, and the
 * two are pulled apart by `splitNarration` at render rather than by an edit to
 * the table. That file has the whole argument; the short version is that the
 * rule against rewriting hadith text does not stop at machine translation, and
 * a heading that was flattened into the body by an importer is a presentation
 * fault, so it gets a presentation fix.
 *
 * Arabic needs nothing special here. `LanguageContext` writes `lang` and `dir`
 * onto the document element when the locale changes, so the quotation inherits
 * `lang="ar" dir="rtl"` and the serif renders right to left without this
 * component knowing about it. The explicit `lang`/`dir` below is for the
 * opposite case: English text showing inside a page that is set to something
 * else.
 */
export function DailyHadith() {
  const { t, locale } = useLanguage();
  const [hadith, setHadith] = useState<DailyHadithView | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDailyHadith()
      .then((h) => {
        if (!cancelled) setHadith(h);
      })
      .catch(() => {
        /* The card is decoration on a study screen, not a control. If it
           cannot load, showing nothing is better than showing an error where
           a hadith should be. */
      });
    return () => {
      cancelled = true;
    };
    // Deliberately not keyed on `locale`: every language is already in `hadith`,
    // so switching one re-renders and does not re-fetch.
  }, []);

  // Nothing on the first paint, and nothing if the table is empty. The home
  // page is a stack of independent cards, so an absent one costs no layout.
  if (!hadith) return null;

  const entry = hadith.byLocale[locale] ?? hadith.byLocale.en;
  if (!entry) return null;

  // A hadith rendered in a locale that has no text of its own is English text,
  // whatever the surrounding page is set to. Saying so lets a screen reader
  // switch voice rather than reading English aloud in a Hausa one.
  const isFallback = !hadith.byLocale[locale];

  // The chain, off the front of the text. See `narration.ts` — in short, the
  // English edition was imported with its narrator headings flattened into the
  // body, so the card was rendering "Narrated Abu Huraira:I heard…": no "by",
  // and no space. The stored text is not touched; it is read apart here.
  const { narrator, body } = splitNarration(entry.text);

  return (
    <section className="glass-card relative overflow-hidden rounded-xl p-6 text-center">
      {/* The khatim moved into `.glass-card` itself, so every box in the game
          carries it rather than this one alone. Drawing it here as well would
          stack two copies and make the hadith card the only panel with the
          motif at double strength — which is the inconsistency, inverted. */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        <Quote className="h-8 w-8 text-primary/40" aria-hidden="true" />

        <h2 className="sr-only">{t("dailyHadith")}</h2>

        {/* The chain above the narration and the reference below it, which is
            how a printed collection sets a hadith and, not coincidentally, how
            the edition this text came from set it before the import flattened
            the two together.

            No `lang="en"` here even when the body carries one: the label is in
            the reader's own language and only the name inside it is not, and a
            transliterated name is not English so much as it is a name. */}
        {narrator && (
          <p className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant/70">
            {t("narratedBy", { narrator })}
          </p>
        )}

        <blockquote
          className="max-w-full [overflow-wrap:anywhere] font-quote-italic text-quote-italic italic text-on-surface"
          {...(isFallback ? { lang: "en", dir: "ltr" } : {})}
        >
          {body}
        </blockquote>

        <cite
          className="max-w-full [overflow-wrap:anywhere] font-label-caps text-label-caps uppercase not-italic tracking-widest text-primary"
          {...(isFallback ? { lang: "en", dir: "ltr" } : {})}
        >
          {entry.attribution}
        </cite>
      </div>
    </section>
  );
}
