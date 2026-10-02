/** Aladhan method IDs. Keep ISNA as the established default. */
export const PRAYER_METHODS = [
  { id: 2, label: "ISNA" },
  { id: 3, label: "Muslim World League" },
  { id: 5, label: "Egyptian General Authority" },
  { id: 4, label: "Umm al-Qura, Makkah" },
  { id: 1, label: "University of Islamic Sciences, Karachi" },
  { id: 11, label: "Majlis Ugama Islam Singapura" },
  { id: 17, label: "JAKIM, Malaysia" },
  { id: 20, label: "Kementerian Agama, Indonesia" },
] as const
export const DEFAULT_PRAYER_METHOD = 2
export const PRAYER_METHOD_STORAGE_KEY = "ilm-prayer-method"
export const SALAH = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const
export const STRIP = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"] as const
export type Salah = (typeof SALAH)[number]
export type StripKey = (typeof STRIP)[number]
export interface PrayerDay {
  meta: { timezone: string }
  timings: Record<string, string>
  date: { hijri: { day: string; month: { en: string }; year: string } }
}

export function parseClock(raw: unknown): { h: number; m: number } | null {
  if (typeof raw !== "string") return null
  const match = /^(\d{1,2}):(\d{2})(?:\s.*)?$/.exec(raw.trim())
  if (!match) return null
  const h = Number(match[1]), m = Number(match[2])
  return h <= 23 && m <= 59 ? { h, m } : null
}

export interface PrayerDate { year: number; month: number; day: number }

const zoneFormatters = new Map<string, Intl.DateTimeFormat>()
function zoneFormatter(timezone: string) {
  let formatter = zoneFormatters.get(timezone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone, calendar: "gregory", numberingSystem: "latn",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    })
    zoneFormatters.set(timezone, formatter)
  }
  return formatter
}

export function validPrayerTimezone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false
  try { zoneFormatter(value); return true } catch { return false }
}

function zoneParts(instant: Date, timezone: string) {
  const parts = Object.fromEntries(zoneFormatter(timezone).formatToParts(instant).map(part => [part.type, part.value]))
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    h: Number(parts.hour), m: Number(parts.minute), s: Number(parts.second),
  }
}

export function prayerDate(instant: Date, timezone: string): PrayerDate {
  const { year, month, day } = zoneParts(instant, timezone)
  return { year, month, day }
}

export function prayerMonthKey(date: PrayerDate) { return `${date.year}-${date.month}` }
export function prayerDateKey(date: PrayerDate) { return `${prayerMonthKey(date)}-${date.day}` }

export function tomorrowDate(base: PrayerDate): PrayerDate {
  const date = new Date(Date.UTC(base.year, base.month - 1, base.day + 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

/** Resolve a clock on a location's calendar date into an actual UTC instant.
 * Sample both sides of a DST transition. A repeated clock uses its first
 * occurrence; a skipped clock has no valid instant and is rejected. */
export function at(date: PrayerDate, clock: { h: number; m: number }, timezone: string): Date | null {
  const wall = Date.UTC(date.year, date.month - 1, date.day, clock.h, clock.m)
  const candidates: number[] = []
  for (const hours of [-24, 0, 24]) {
    const sample = wall + hours * 60 * 60 * 1000
    const local = zoneParts(new Date(sample), timezone)
    const offset = Date.UTC(local.year, local.month - 1, local.day, local.h, local.m, local.s) - sample
    const candidate = wall - offset
    const resolved = zoneParts(new Date(candidate), timezone)
    if (resolved.year === date.year && resolved.month === date.month && resolved.day === date.day &&
        resolved.h === clock.h && resolved.m === clock.m) candidates.push(candidate)
  }
  return candidates.length ? new Date(Math.min(...candidates)) : null
}

export function nextPrayer(today: PrayerDay, tomorrow: PrayerDay, now: Date) {
  const timezone = today.meta.timezone
  const date = prayerDate(now, timezone)
  for (const name of SALAH) {
    const clock = parseClock(today.timings[name])
    if (!clock) continue
    const when = at(date, clock, timezone)
    if (!when) return null
    if (when.getTime() > now.getTime()) return { name, when, date }
  }
  const fajr = parseClock(tomorrow.timings.Fajr)
  const nextDate = tomorrowDate(date)
  const when = fajr ? at(nextDate, fajr, tomorrow.meta.timezone) : null
  return when ? { name: "Fajr" as const, when, date: nextDate } : null
}

export function prayerCacheKey(lat: number, lon: number, date: PrayerDate, method: number) {
  return `ilm-prayer:v3:${lat.toFixed(2)}:${lon.toFixed(2)}:${prayerMonthKey(date)}:${method}`
}

export function isPrayerCalendar(value: unknown, date: PrayerDate): value is PrayerDay[] {
  if (!Array.isArray(value) || value.length !== new Date(Date.UTC(date.year, date.month, 0)).getUTCDate()) return false
  const timezone = value[0]?.meta?.timezone
  if (!validPrayerTimezone(timezone)) return false
  return value.every(day => day && typeof day === "object" && day.timings && day.meta?.timezone === timezone &&
    STRIP.every(name => parseClock(day.timings[name]) !== null) &&
    typeof day.date?.hijri?.day === "string" && typeof day.date?.hijri?.month?.en === "string" &&
    typeof day.date?.hijri?.year === "string")
}

function checkAborted(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError")
}

export async function loadPrayerCalendar(
  lat: number, lon: number, date: PrayerDate, method: number, signal: AbortSignal,
): Promise<PrayerDay[]> {
  checkAborted(signal)
  const key = prayerCacheKey(lat, lon, date, method)
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null")
    if (isPrayerCalendar(value, date)) return value
  } catch { /* Corrupt or blocked storage must not block fresh times. */ }
  const response = await fetch(
    `https://api.aladhan.com/v1/calendar/${date.year}/${date.month}` +
      `?latitude=${lat}&longitude=${lon}&method=${method}`,
    { signal },
  )
  checkAborted(signal)
  if (!response.ok) throw new Error(`aladhan ${response.status}`)
  const body: unknown = await response.json()
  checkAborted(signal)
  const days = (body as { data?: unknown } | null)?.data
  if (!isPrayerCalendar(days, date)) throw new Error("Invalid prayer calendar")
  try { localStorage.setItem(key, JSON.stringify(days)) } catch { /* Optional cache. */ }
  return days
}

export interface PrayerSchedule {
  month: string
  timezone: string
  days: PrayerDay[]
  tomorrow: PrayerDay
}

/** Discover the location zone from the response, then correct month selection.
 * Recheck the date after awaiting next-month data, so a request spanning local
 * midnight cannot publish yesterday's tomorrow or a stale month. */
export async function loadPrayerSchedule(
  lat: number, lon: number, method: number, signal: AbortSignal,
  now: () => Date = () => new Date(),
): Promise<PrayerSchedule> {
  let requested = prayerDate(now(), "UTC")
  for (let attempt = 0; attempt < 3; attempt++) {
    const days = await loadPrayerCalendar(lat, lon, requested, method, signal)
    checkAborted(signal)
    const timezone = days[0].meta.timezone
    const today = prayerDate(now(), timezone)
    if (prayerMonthKey(requested) !== prayerMonthKey(today)) { requested = today; continue }
    const tomorrow = tomorrowDate(today)
    const nextDays = prayerMonthKey(tomorrow) === prayerMonthKey(today)
      ? days : await loadPrayerCalendar(lat, lon, tomorrow, method, signal)
    checkAborted(signal)
    if (nextDays[0].meta.timezone !== timezone) throw new Error("Prayer calendar timezone changed")
    const current = prayerDate(now(), timezone)
    if (prayerDateKey(current) !== prayerDateKey(today)) { requested = current; continue }
    return { month: prayerMonthKey(today), timezone, days, tomorrow: nextDays[tomorrow.day - 1] }
  }
  throw new Error("Prayer calendar date changed during loading. Retry.")
}

/** Browser geolocation cannot be cancelled, but its late callbacks can be ignored. */
export function locateForPrayer(signal: AbortSignal, forceFresh = false): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new DOMException("Aborted", "AbortError"))
    if (signal.aborted) { cancel(); return }
    signal.addEventListener("abort", cancel, { once: true })
    const finish = () => signal.removeEventListener("abort", cancel)
    try {
      navigator.geolocation.getCurrentPosition(
        position => { finish(); if (!signal.aborted) resolve(position.coords) },
        error => { finish(); if (!signal.aborted) reject(error) },
        { maximumAge: forceFresh ? 0 : 30 * 60 * 1000, timeout: 15000 },
      )
    } catch (error) { finish(); reject(error) }
  })
}
