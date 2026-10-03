import React, { createContext, useContext, useEffect, useState } from "react";
import { t, type Locale } from "../../src/lib/i18n";

const Language = createContext<Locale>("en");
const english = "Synthetic unbroken body token " + "SyntheticBodyToken".repeat(40) + " End of synthetic body.";
const arabic = "نص تجريبي للعرض فقط " + "اختبار".repeat(80) + " نهاية النص التجريبي.";
export const payload = {
  reference: "synthetic:1",
  byLocale: {
    en: { text: english, attribution: "SyntheticReference".repeat(35) },
    ar: { text: arabic, attribution: "مرجع".repeat(100) },
  },
};

export function useLanguage() {
  const locale = useContext(Language);
  return { locale, t: (key: Parameters<typeof t>[0], params?: Record<string, string | number>) => t(key, locale, params) };
}

export function FixtureLanguage({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);
  return <Language.Provider value={locale}>
    <nav aria-label="Synthetic language controls" className="mb-4 flex flex-wrap gap-2">
      {(["en", "ar", "ha", "fr", "id", "ms"] as Locale[]).map(code => <button key={code} className="rounded border p-2" onClick={() => setLocale(code)}>{code}</button>)}
    </nav>
    {children}
  </Language.Provider>;
}

export async function getDailyHadith() {
  const state = (window as any).__hadithFixture;
  state.reads++;
  return state.payload;
}

(window as any).__hadithFixture = {
  reads: 0,
  payload: new URLSearchParams(location.search).has("missing-ar")
    ? { reference: payload.reference, byLocale: { en: payload.byLocale.en } }
    : payload,
};
