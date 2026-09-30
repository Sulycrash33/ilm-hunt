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

/** Batch bursts and serialize refreshes so older responses cannot overwrite newer ones. */
export function coalescedRefresh<T>(load: () => Promise<T>, apply: (value: T) => void, onError: () => void, delay = 50) {
  let disposed = false
  let running = false
  let dirty = false
  let timer: ReturnType<typeof setTimeout> | undefined
  function trigger() {
    if (disposed) return
    dirty = true
    if (running || timer !== undefined) return
    timer = setTimeout(async () => {
      timer = undefined
      if (disposed) return
      running = true
      dirty = false
      try {
        const value = await load()
        if (!disposed) apply(value)
      } catch {
        if (!disposed) onError()
      } finally {
        running = false
        if (dirty && !disposed) trigger()
      }
    }, delay)
  }
  return { trigger, dispose() { disposed = true; if (timer !== undefined) clearTimeout(timer) } }
}
