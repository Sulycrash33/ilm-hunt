import assert from "node:assert/strict"
import {
  at, isPrayerCalendar, loadPrayerCalendar, loadPrayerSchedule, locateForPrayer, nextPrayer,
  parseClock, prayerCacheKey, prayerDate, tomorrowDate, validPrayerTimezone, type PrayerDay,
} from "../src/lib/prayer-times"

async function main() {
  const january = { year: 2026, month: 1, day: 31 }
  const januaryInstant = new Date("2026-01-31T23:30:00Z")
  const february = tomorrowDate(january)
  assert.equal(february.month, 2)
  assert.equal(february.day, 1)
  assert.equal(tomorrowDate({ year: 2026, month: 12, day: 31 }).year, 2027)
  assert.deepEqual(parseClock("05:12 (WAT)"), { h: 5, m: 12 })
  for (const invalid of [null, {}, "24:00", "01:60", "12:345", "05:12garbage"]) assert.equal(parseClock(invalid), null)

  const day = (fajr: string, timezone = "UTC"): PrayerDay => ({
    meta: { timezone },
    timings: { Fajr: fajr, Sunrise: "06:00", Dhuhr: "12:00", Asr: "15:00", Maghrib: "18:00", Isha: "20:00" },
    date: { hijri: { day: "1", month: { en: "Shaban" }, year: "1447" } },
  })
  const januaryDays = Array.from({ length: 31 }, () => day("05:00"))
  const februaryDays = Array.from({ length: 28 }, () => day("05:15"))
  const next = nextPrayer(januaryDays[30], februaryDays[0], januaryInstant)!
  assert.equal(next.name, "Fajr")
  assert.equal(next.when.getUTCMonth(), 1, "Month-end countdown must use next month's calendar")
  assert.equal(next.when.getUTCMinutes(), 15, "Do not reuse the previous month's first Fajr")
  assert.equal(nextPrayer(day("05:00"), day("05:15"), new Date("2026-01-01T05:10:00Z"))?.name, "Dhuhr", "Sunrise is not a salah")
  assert.equal(isPrayerCalendar(januaryDays, january), true)
  assert.equal(isPrayerCalendar(februaryDays, january), false)
  assert.equal(isPrayerCalendar([{ timings: {} }], january), false)
  assert.notEqual(prayerCacheKey(1, 2, january, 2), prayerCacheKey(1, 2, january, 3), "Methods must have separate caches")

  assert.equal(validPrayerTimezone("Europe/London"), true)
  assert.equal(validPrayerTimezone("Not/AZone"), false)
  assert.equal(isPrayerCalendar(januaryDays.map(entry => ({ ...entry, meta: { timezone: "Not/AZone" } })), january), false)
  assert.equal(isPrayerCalendar(januaryDays.map(({ meta, ...entry }) => entry), january), false, "Zone-free old caches cannot be trusted")
  const boundary = new Date("2026-01-31T23:30:00Z")
  assert.deepEqual(prayerDate(new Date("2026-12-31T12:00:00Z"), "Pacific/Kiritimati"), { year: 2027, month: 1, day: 1 }, "Timezone date selection crosses year boundaries")
  assert.equal(at({ year: 2026, month: 10, day: 4 }, { h: 2, m: 15 }, "Australia/Lord_Howe"), null, "Reject clocks skipped by half-hour DST transitions")
  assert.equal(at({ year: 2026, month: 10, day: 4 }, { h: 2, m: 45 }, "Australia/Lord_Howe")?.toISOString(), "2026-10-03T15:45:00.000Z")
  assert.deepEqual(prayerDate(boundary, "Asia/Tokyo"), { year: 2026, month: 2, day: 1 })
  assert.deepEqual(prayerDate(new Date("2026-02-01T01:00:00Z"), "America/Los_Angeles"), january)
  assert.equal(at({ year: 2026, month: 2, day: 1 }, { h: 5, m: 15 }, "Asia/Kathmandu")?.toISOString(), "2026-01-31T23:30:00.000Z", "Support fractional-hour offsets")
  const springDate = { year: 2026, month: 3, day: 29 }
  const springNext = nextPrayer(day("05:00", "Europe/London"), day("05:15", "Europe/London"), new Date("2026-03-28T23:30:00Z"))!
  assert.equal(springNext.when.toISOString(), "2026-03-29T04:15:00.000Z", "Tomorrow Fajr uses the new DST offset")
  assert.equal(at(springDate, { h: 1, m: 30 }, "Europe/London"), null, "Do not invent an instant for a skipped local clock")
  assert.equal(at({ year: 2026, month: 10, day: 25 }, { h: 1, m: 30 }, "Europe/London")?.toISOString(), "2026-10-25T00:30:00.000Z", "Repeated clocks choose their first occurrence")
  const fallNext = nextPrayer(day("05:00", "Europe/London"), day("05:15", "Europe/London"), new Date("2026-10-24T22:30:00Z"))!
  assert.equal(fallNext.when.toISOString(), "2026-10-25T05:15:00.000Z", "Tomorrow Fajr uses the winter offset")
  const tokyoNext = nextPrayer(day("05:00", "Asia/Tokyo"), day("05:15", "Asia/Tokyo"), boundary)!
  assert.equal(tokyoNext.name, "Dhuhr", "Location date/clock, rather than device clock, selects today's next prayer")
  assert.equal(tokyoNext.when.toISOString(), "2026-02-01T03:00:00.000Z")
  assert.equal(tokyoNext.when.toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }), "12:00")

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

    const monthly = (month: number, timezone: string) => Array.from({ length: new Date(Date.UTC(2026, month, 0)).getUTCDate() }, (_, index) => ({
      ...day("05:15", timezone), date: { hijri: { day: String(index + 1), month: { en: `Month ${month}` }, year: "1447" } },
    }))
    const months: number[] = []
    const zoneFetch = (timezone: string, onMonth?: (month: number) => void) => async (input: RequestInfo | URL) => {
      const month = Number(new URL(String(input)).pathname.split("/").at(-1))
      months.push(month)
      onMonth?.(month)
      return new Response(JSON.stringify({ data: monthly(month, timezone) }), { status: 200 })
    }
    cache.clear()
    globalThis.fetch = zoneFetch("Asia/Tokyo")
    const tokyoSchedule = await loadPrayerSchedule(1, 2, 2, signal, () => boundary)
    assert.equal(tokyoSchedule.month, "2026-2")
    assert.equal(tokyoSchedule.tomorrow.date.hijri.day, "2")
    assert.deepEqual(months, [1, 2], "Discover the coordinate zone then correct a month ahead of UTC/device date")
    cache.clear(); months.length = 0
    globalThis.fetch = zoneFetch("America/Los_Angeles")
    const laSchedule = await loadPrayerSchedule(1, 2, 2, signal, () => new Date("2026-02-01T01:00:00Z"))
    assert.equal(laSchedule.month, "2026-1")
    assert.equal(laSchedule.tomorrow.date.hijri.day, "1")
    assert.deepEqual(months, [2, 1], "Previous-month location date uses January and cached February for tomorrow")
    cache.clear(); months.length = 0
    let requestNow = new Date("2026-03-31T14:59:00Z")
    globalThis.fetch = zoneFetch("Asia/Tokyo", month => {
      if (month === 4) requestNow = new Date("2026-03-31T15:01:00Z")
    })
    const midnightSchedule = await loadPrayerSchedule(1, 2, 2, signal, () => requestNow)
    assert.equal(midnightSchedule.month, "2026-4")
    assert.equal(midnightSchedule.tomorrow.date.hijri.day, "2", "Midnight during next-month request must not publish yesterday's tomorrow")
    assert.deepEqual(months, [3, 4])
    cache.clear()
    const staleController = new AbortController()
    globalThis.fetch = async () => {
      staleController.abort()
      return new Response(JSON.stringify({ data: januaryDays }), { status: 200 })
    }
    await assert.rejects(loadPrayerCalendar(1, 2, january, 2, staleController.signal), error => (error as Error).name === "AbortError")
    assert.equal(cache.size, 0, "An aborted response cannot populate the calendar cache")
    cache.set(key, JSON.stringify(januaryDays))
    await assert.rejects(loadPrayerCalendar(1, 2, january, 2, staleController.signal), error => (error as Error).name === "AbortError")
    cache.clear()
    globalThis.fetch = zoneFetch("Asia/Tokyo")
    let movingClock = Date.parse("2026-03-01T00:00:00Z")
    await assert.rejects(loadPrayerSchedule(1, 2, 2, signal, () => { movingClock += 86400000; return new Date(movingClock) }), /date changed during loading/, "Date correction retries are bounded")

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
  console.log("Prayer calendar: cache validation, method isolation, location timezone/month/year/DST rollover, midnight request guards, API recovery and geolocation cancellation passed.")
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
