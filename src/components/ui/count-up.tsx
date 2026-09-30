"use client"

import { useGameReducedMotion as useReducedMotion } from "@/contexts/GameExperienceContext";

import { useEffect, useRef, useState } from "react"


/**
 * A number that counts up to its value instead of appearing at it.
 *
 * Numbers that snap into place read as data. Numbers that climb read as
 * something you earned — which is the whole difference between a dashboard and
 * a game. This is the cheapest piece of juice in the app: no layout change, no
 * new colour, and it makes XP, coins and streaks feel like they moved.
 *
 * Two things it deliberately does not do:
 *
 * - It never animates on a value it has already shown. Re-running the climb on
 *   every re-render would turn a stable screen into a slot machine.
 * - It respects `prefers-reduced-motion` and renders the final value at once.
 *   Counting digits is exactly the kind of motion that setting exists for.
 */
export function CountUp({
  value,
  durationMs = 900,
  className,
  format = (n: number) => n.toLocaleString(),
}: {
  value: number
  durationMs?: number
  className?: string
  format?: (n: number) => string
}) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(value)
  const fromRef = useRef(value)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (reduce) {
      setShown(value)
      fromRef.current = value
      return
    }

    const from = fromRef.current
    if (from === value) return

    const start = performance.now()
    // Ease-out: fast off the mark, settling into the final number rather than
    // stopping dead on it.
    const ease = (t: number) => 1 - Math.pow(1 - t, 3)

    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1)
      setShown(Math.round(from + (value - from) * ease(t)))
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      fromRef.current = value
    }
  }, [value, durationMs, reduce])

  return <span className={className}>{format(shown)}</span>
}
