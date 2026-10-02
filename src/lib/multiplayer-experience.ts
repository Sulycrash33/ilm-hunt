/** Only room codes can become invitation destinations, never arbitrary URLs. */
export function parseRoomCode(value: string | null): string | null {
  const code = value?.trim().toUpperCase() ?? ""
  return /^[A-Z0-9]{6}$/.test(code) ? code : null
}

export function roomInvitePath(code: string | null, fallback = "/home"): string {
  const valid = parseRoomCode(code)
  return valid ? `/multiplayer?room=${valid}` : fallback
}

export function questionDeadline(startedAt: string | null | undefined, seconds: number, now = Date.now()): number {
  const start = startedAt ? Date.parse(startedAt) : NaN
  return (Number.isFinite(start) ? start : now) + seconds * 1000
}

/** Equal scores share a rank; joining first must not decide a winner. */
export function rankPlayers<T extends { id: string; score: number }>(players: T[]): Array<T & { rank: number }> {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  let rank = 1
  return sorted.map((player, index) => {
    if (index > 0 && player.score !== sorted[index - 1].score) rank = index + 1
    return { ...player, rank }
  })
}

/** Batch bursts and serialize refreshes so older responses cannot overwrite newer ones. */
export function coalescedRefresh<T>(load: () => Promise<T>, apply: (value: T) => void, onError: () => void, delay = 50, retryDelay = 1000) {
  let disposed = false
  let running = false
  let dirty = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let failures = 0
  let retrying = false
  function schedule(wait: number, retry = false) {
    retrying = retry
    timer = setTimeout(run, wait)
  }
  async function run() {
    timer = undefined
    retrying = false
    if (disposed) return
    running = true
    dirty = false
    let failed = false
    try {
      const value = await load()
      if (!disposed) apply(value)
      failures = 0
    } catch {
      failed = true
      failures++
      if (!disposed) onError()
    } finally {
      running = false
      if (!disposed && (dirty || failed)) {
        // A failed snapshot must recover even if no further Realtime event arrives.
        schedule(dirty ? delay : Math.min(retryDelay * 2 ** Math.min(failures - 1, 5), 30000), !dirty)
      }
    }
  }
  function trigger() {
    if (disposed) return
    dirty = true
    if (timer !== undefined && retrying) {
      clearTimeout(timer)
      timer = undefined
    }
    if (running || timer !== undefined) return
    schedule(delay)
  }
  return { trigger, dispose() { disposed = true; if (timer !== undefined) clearTimeout(timer) } }
}
