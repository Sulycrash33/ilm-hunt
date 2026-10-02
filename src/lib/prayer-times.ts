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

export function at(base: Date, clock: { h: number; m: number }): Date {
  const date = new Date(base)
  date.setHours(clock.h, clock.m, 0, 0)
  return date
}

export function tomorrowDate(base: Date): Date {
  const date = new Date(base)
  // Calendar arithmetic, rather than 24 hours, also works over DST changes.
  date.setDate(date.getDate() + 1)
  return date
}

export function nextPrayer(today: PrayerDay, tomorrow: PrayerDay, now: Date) {
  for (const name of SALAH) {
    const clock = parseClock(today.timings[name])
    if (!clock) continue
    const when = at(now, clock)
    if (when.getTime() > now.getTime()) return { name, when }
  }
  const fajr = parseClock(tomorrow.timings.Fajr)
  return fajr ? { name: "Fajr" as const, when: at(tomorrowDate(now), fajr) } : null
}

export function prayerCacheKey(lat: number, lon: number, date: Date, method: number) {
  return `ilm-prayer:v2:${lat.toFixed(2)}:${lon.toFixed(2)}:${date.getFullYear()}-${date.getMonth() + 1}:${method}`
}

export function isPrayerCalendar(value: unknown, date: Date): value is PrayerDay[] {
  if (!Array.isArray(value) || value.length !== new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()) return false
  return value.every(day => day && typeof day === "object" && day.timings &&
    STRIP.every(name => parseClock(day.timings[name]) !== null) &&
    typeof day.date?.hijri?.day === "string" && typeof day.date?.hijri?.month?.en === "string" &&
    typeof day.date?.hijri?.year === "string")
}

export async function loadPrayerCalendar(
  lat: number, lon: number, date: Date, method: number, signal: AbortSignal,
): Promise<PrayerDay[]> {
  const key = prayerCacheKey(lat, lon, date, method)
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null")
    if (isPrayerCalendar(value, date)) return value
  } catch { /* Corrupt or blocked storage must not block fresh times. */ }
  const response = await fetch(
    `https://api.aladhan.com/v1/calendar/${date.getFullYear()}/${date.getMonth() + 1}` +
      `?latitude=${lat}&longitude=${lon}&method=${method}`,
    { signal },
  )
  if (!response.ok) throw new Error(`aladhan ${response.status}`)
  const body: unknown = await response.json()
  const days = (body as { data?: unknown } | null)?.data
  if (!isPrayerCalendar(days, date)) throw new Error("Invalid prayer calendar")
  try { localStorage.setItem(key, JSON.stringify(days)) } catch { /* Optional cache. */ }
  return days
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
