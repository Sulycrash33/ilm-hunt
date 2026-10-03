"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useId } from "react"
import { MapPin, AlertCircle, RefreshCw } from "lucide-react"
import {
  FajrIcon,
  DhuhrIcon,
  AsrIcon,
  MaghribIcon,
  IshaIcon,
  SunriseIcon,
} from "@/components/icons/prayer-time-icons"
import { useLanguage } from "@/contexts/LanguageContext"
import type { Translations } from "@/lib/i18n"

import {
  DEFAULT_PRAYER_METHOD, PRAYER_METHODS, PRAYER_METHOD_STORAGE_KEY,
  STRIP, at, parseClock, prayerDate, prayerMonthKey, prayerDateKey, nextPrayer, loadPrayerSchedule, locateForPrayer,
  type PrayerSchedule, type StripKey,
} from "@/lib/prayer-times"

/**
 * The i18n key for each label on the strip.
 *
 * The strip used to render its own array keys — `{key}` — straight to the
 * screen, so all six labels were the English literals in every language. Five
 * of them are Arabic proper nouns and survived that unharmed in French or
 * Malay, but two things did not:
 *
 *  - **"Sunrise" is a common noun**, and it was the only one in the list. It
 *    stayed English in all six locales, which is why it is the word that gets
 *    noticed.
 *  - **Arabic was reading its own words in Latin script.** الفجر rendered as
 *    "Fajr" to an Arabic speaker.
 *
 * Keyed rather than translated inline so the strip and the "next prayer"
 * headline above it cannot drift apart.
 */
const LABEL_KEYS: Record<StripKey, keyof Translations> = {
  Fajr: "prayerFajr",
  Sunrise: "prayerSunrise",
  Dhuhr: "prayerDhuhr",
  Asr: "prayerAsr",
  Maghrib: "prayerMaghrib",
  Isha: "prayerIsha",
}

const ICONS: Record<StripKey, React.FC<React.SVGProps<SVGSVGElement>>> = {
  Fajr: FajrIcon,
  Sunrise: SunriseIcon,
  Dhuhr: DhuhrIcon,
  Asr: AsrIcon,
  Maghrib: MaghribIcon,
  Isha: IshaIcon,
}

/** "1h 12m", "45m", "30s" — the unit a worshipper actually wants. */
function formatGap(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${s}s`
}

export function PrayerTimesCard() {
  const { t, locale } = useLanguage()
  const methodId = useId()
  const [method, setMethod] = useState<number | null>(null)
  const [calendar, setCalendar] = useState<PrayerSchedule | null>(null)
  const [location, setLocation] = useState<string | null>(null)
  const [error, setError] = useState<"location" | "network" | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => new Date())
  const abort = useRef<AbortController | null>(null)
  const timezone = calendar?.timezone ?? "UTC"
  const localDate = prayerDate(now, timezone)
  const month = prayerMonthKey(localDate)
  const dateKey = prayerDateKey(localDate)

  useEffect(() => {
    let saved = DEFAULT_PRAYER_METHOD
    try {
      const value = Number(localStorage.getItem(PRAYER_METHOD_STORAGE_KEY))
      if (PRAYER_METHODS.some(option => option.id === value)) saved = value
    } catch { /* Storage is optional. */ }
    setMethod(saved)
  }, [])

  const load = useCallback(async (forceFresh = false) => {
    if (method === null) return
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    const { signal } = controller
    setLoading(true)
    setError(null)
    let stage: "location" | "network" = "location"
    // Bound external requests as well as geolocation; a stalled service must
    // leave the player able to retry. No stale request can finish a newer one.
    const timeout = setTimeout(() => controller.abort(), 30000)
    try {
      if (!navigator.geolocation) throw new Error("Geolocation unavailable")
      const { latitude, longitude } = await locateForPrayer(signal, forceFresh)
      stage = "network"
      const schedule = await loadPrayerSchedule(latitude, longitude, method, signal)
      if (signal.aborted || abort.current !== controller) return
      setCalendar(schedule)
      setLocation(null)
      setLoading(false)
      // A place label is optional and must never delay showing prayer times.
      try {
        const geo = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
          { signal },
        )
        if (geo.ok) {
          const place = await geo.json() as { city?: string; countryCode?: string }
          if (!signal.aborted) setLocation([place.city, place.countryCode].filter(value => typeof value === "string").join(", ") || null)
        }
      } catch { /* Times remain usable without a place label. */ }
    } catch {
      if (abort.current === controller) {
        setError(stage)
        setLoading(false)
      }
    } finally {
      clearTimeout(timeout)
    }
  }, [method])

  useEffect(() => {
    void load()
    return () => {
      const controller = abort.current
      abort.current = null
      controller?.abort()
    }
  }, [load, dateKey])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const today = calendar?.month === month ? calendar.days[localDate.day - 1] : undefined
  const tomorrow = calendar?.days[localDate.day] ?? calendar?.tomorrow

  const stripTimes = useMemo(() => {
    if (!today) return null
    return STRIP.map((key) => {
      const clock = parseClock(today.timings[key])
      return { key, clock, at: clock ? at(localDate, clock, timezone) : null }
    })
  }, [today, dateKey, timezone])

  const next = useMemo(() => today && tomorrow ? nextPrayer(today, tomorrow, now) : null, [today, tomorrow, now])

  const hijri = today?.date?.hijri

  const controls = (
    <div key="prayer-controls" className="mt-3 flex flex-wrap items-center gap-2 border-t border-primary/10 pt-3">
        <label htmlFor={methodId} className="text-xs text-on-surface-variant">{t("prayerCalculationMethod")}</label>
        <select
          id={methodId}
          value={method ?? DEFAULT_PRAYER_METHOD}
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-primary/20 bg-background px-2 text-xs text-on-surface"
          onChange={event => {
            const value = Number(event.target.value)
            setMethod(value)
            try { localStorage.setItem(PRAYER_METHOD_STORAGE_KEY, String(value)) } catch { /* Optional preference. */ }
          }}
        >
          {PRAYER_METHODS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <button type="button" onClick={() => void load(true)} className="grid h-10 w-10 place-items-center rounded-full border border-primary/20 text-primary" aria-label={t("refreshLocation")}>
          <RefreshCw className="h-4 w-4" aria-hidden />
        </button>
      </div>
  )

  if (loading) {
    return (
      <div className="rounded-2xl border border-primary/15 bg-surface-container/50 p-4" role="status" aria-label={t("loading")}>
        <div className="h-7 w-44 animate-pulse rounded bg-white/5" />
        <div className="mt-3 flex gap-2 overflow-hidden">
          {STRIP.map((k) => (
            <div key={k} className="h-16 w-14 shrink-0 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
        {controls}
      </div>
    )
  }

  if (error || !today || !next) {
    return (
      <div className="rounded-2xl border border-primary/15 bg-surface-container/50 p-4">
        <div className="flex items-start gap-2.5" role="status">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant/70" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-on-surface-variant">{t(error === "network" ? "prayerLoadError" : "prayerLocationError")}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-2 min-h-10 inline-flex items-center gap-1.5 rounded-full border border-primary/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary"
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              {t("tryAgain")}
            </button>
          </div>
        </div>
        {controls}
      </div>
    )
  }

  const gap = next.when.getTime() - now.getTime()
  const NextIcon = ICONS[next.name]
  const imminent = gap <= 10 * 60 * 1000

  return (
    <div className="rounded-2xl border border-primary/15 bg-surface-container/50 p-4">
      {/* The countdown. Everything else on this card is secondary to it. */}
      <div className="flex items-center gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
            imminent ? "bg-primary/25" : "bg-primary/12"
          }`}
        >
          <NextIcon className="h-5 w-5 text-primary" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant/60">
            {t("prayerTimesTitle")}
          </p>
          <p className="break-words font-headline-md text-headline-md leading-tight text-on-surface">
            {t("nextPrayerIn")
              .replace("{prayer}", t(LABEL_KEYS[next.name]))
              .replace("{time}", formatGap(gap))}
          </p>
        </div>
        <span className="shrink-0 text-end text-sm font-semibold tabular-nums text-primary">
          {next.when.toLocaleTimeString(locale, { timeZone: timezone, hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* All six, scrolling sideways rather than wrapping to three rows. */}
      <div role="group" aria-label={t("prayerTimesTitle")} tabIndex={0} className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto rounded-xl px-1 pb-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stripTimes?.map(({ key, clock, at: when }) => {
          const Icon = ICONS[key]
          const isNext = key === next.name && prayerDateKey(next.date) === dateKey
          const passed = when ? when.getTime() <= now.getTime() : false
          return (
            <div
              key={key}
              className={`flex w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-xl border px-1.5 py-2 ${
                isNext
                  ? "border-primary/40 bg-primary/12"
                  : passed
                    ? "border-white/5 bg-white/[0.02] opacity-55"
                    : "border-white/5 bg-white/[0.03]"
              }`}
            >
              <Icon className={`h-4 w-4 ${isNext ? "text-primary" : "text-on-surface-variant/70"}`} aria-hidden />
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide ${
                  isNext ? "text-primary" : "text-on-surface-variant/80"
                }`}
              >
                {t(LABEL_KEYS[key])}
              </span>
              <span className="text-[11px] tabular-nums text-on-surface-variant/70">
                {clock ? `${String(clock.h).padStart(2, "0")}:${String(clock.m).padStart(2, "0")}` : "—"}
              </span>
            </div>
          )
        })}
      </div>

      {controls}

      {(location || hijri || timezone) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-on-surface-variant/55">
          {location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden />
              {location}
            </span>
          )}
          <span>{timezone}</span>
          {hijri && (
            <span>
              {hijri.day} {hijri.month.en} {hijri.year} AH
            </span>
          )}
        </div>
      )}
    </div>
  )
}
