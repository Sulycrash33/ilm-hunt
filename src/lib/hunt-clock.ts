/** Read elapsed time rather than counting callbacks, which browsers may delay. */
export function secondsUntil(deadline: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** Time boosts extend the deadline once; grading latency never extends it. */
export function questionTimeLeft(startedAt: number, seconds: number, boostMs = 0, now = Date.now()): number {
  return Math.max(0, startedAt + seconds * 1000 + boostMs - now);
}
