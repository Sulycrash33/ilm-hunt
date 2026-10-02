import assert from "node:assert/strict"
import {
  at, isPrayerCalendar, loadPrayerCalendar, locateForPrayer, nextPrayer,
  parseClock, prayerCacheKey, tomorrowDate, type PrayerDay,
} from "../src/lib/prayer-times"

async function main() {
  const january = new Date(2026, 0, 31, 23, 30)
  const february = tomorrowDate(january)
  assert.equal(february.getMonth(), 1)
  assert.equal(february.getDate(), 1)
  assert.equal(tomorrowDate(new Date(2026, 11, 31)).getFullYear(), 2027)
  assert.deepEqual(parseClock("05:12 (WAT)"), { h: 5, m: 12 })
  for (const invalid of [null, {}, "24:00", "01:60", "12:345", "05:12garbage"]) assert.equal(parseClock(invalid), null)

  const day = (fajr: string): PrayerDay => ({
    timings: { Fajr: fajr, Sunrise: "06:00", Dhuhr: "12:00", Asr: "15:00", Maghrib: "18:00", Isha: "20:00" },
    date: { hijri: { day: "1", month: { en: "Shaban" }, year: "1447" } },
  })
  const januaryDays = Array.from({ length: 31 }, () => day("05:00"))
  const februaryDays = Array.from({ length: 28 }, () => day("05:15"))
  const next = nextPrayer(januaryDays[30], februaryDays[0], january)!
  assert.equal(next.name, "Fajr")
  assert.equal(next.when.getMonth(), 1, "Month-end countdown must use next month's calendar")
  assert.equal(next.when.getMinutes(), 15, "Do not reuse the previous month's first Fajr")
  assert.equal(nextPrayer(day("05:00"), day("05:15"), new Date(2026, 0, 1, 5, 10))?.name, "Dhuhr", "Sunrise is not a salah")
  assert.equal(isPrayerCalendar(januaryDays, january), true)
  assert.equal(isPrayerCalendar(februaryDays, january), false)
  assert.equal(isPrayerCalendar([{ timings: {} }], january), false)
  assert.notEqual(prayerCacheKey(1, 2, january, 2), prayerCacheKey(1, 2, january, 3), "Methods must have separate caches")

  const originalTimezone = process.env.TZ
  process.env.TZ = "Europe/London"
  const dstStart = new Date(2026, 2, 28, 23, 30)
  assert.equal(tomorrowDate(dstStart).getDate(), 29, "Tomorrow is a calendar day even when clocks advance")
  assert.equal(at(tomorrowDate(dstStart), { h: 5, m: 0 }).getHours(), 5)
  if (originalTimezone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimezone

  const originals = { fetch: globalThis.fetch, storage: Object.getOwnPropertyDescriptor(globalThis, "localStorage"), navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator") }
  const cache = new Map<string, string>()
  let requests = 0
  try {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => cache.get(key) ?? null, setItem: (key: string, value: string) => cache.set(key, value) } })
    globalThis.fetch = async () => { requests++; return new Response(JSON.stringify({ data: januaryDays }), { status: 200 }) }
    const signal = new AbortController().signal
    const key = prayerCacheKey(1, 2, january, 2)
    cache.set(key, JSON.stringify({ days: "corrupt" }))
    assert.deepEqual(await loadPrayerCalendar(1, 2, january, 2, signal), januaryDays)
    assert.equal(requests, 1, "Invalid cached calendars must recover with a fresh request")
    await loadPrayerCalendar(1, 2, january, 2, signal)
    assert.equal(requests, 1, "Valid cache avoids another calendar request")
    await loadPrayerCalendar(1, 2, january, 3, signal)
    assert.equal(requests, 2, "Changing calculation method fetches fresh times")
    globalThis.fetch = async () => new Response(JSON.stringify({ data: [] }), { status: 200 })
    await assert.rejects(loadPrayerCalendar(1, 2, january, 4, signal), /Invalid prayer calendar/)
    globalThis.fetch = async () => new Response("Unavailable", { status: 503 })
    await assert.rejects(loadPrayerCalendar(1, 2, january, 5, signal), /503/)

    let success: PositionCallback | undefined
    const maximumAges: number[] = []
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { geolocation: { getCurrentPosition: (callback: PositionCallback, _error: PositionErrorCallback, options: PositionOptions) => { success = callback; maximumAges.push(options.maximumAge!) } } } })
    const freshController = new AbortController()
    const freshLocation = locateForPrayer(freshController.signal, true)
    freshController.abort()
    await assert.rejects(freshLocation, error => (error as Error).name === "AbortError")
    const controller = new AbortController()
    const locating = locateForPrayer(controller.signal)
    controller.abort()
    await assert.rejects(locating, error => (error as Error).name === "AbortError")
    assert.deepEqual(maximumAges, [0, 30 * 60 * 1000], "Explicit location refresh must bypass cached positions; normal loads may reuse them")
    success?.({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition)
    await assert.rejects(locateForPrayer(controller.signal), error => (error as Error).name === "AbortError")
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("Blocked storage") } })
    globalThis.fetch = async () => new Response(JSON.stringify({ data: januaryDays }), { status: 200 })
    assert.deepEqual(await loadPrayerCalendar(1, 2, january, 2, signal), januaryDays, "Blocked storage must not block prayer times")
  } finally {
    globalThis.fetch = originals.fetch
    for (const [key, descriptor] of [["localStorage", originals.storage], ["navigator", originals.navigator]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
  console.log("Prayer calendar: cache validation, method isolation, month/year/DST rollover, API recovery and geolocation cancellation passed.")
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
