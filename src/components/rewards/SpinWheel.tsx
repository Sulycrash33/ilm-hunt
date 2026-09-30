"use client"

import { useGameReducedMotion } from "@/contexts/GameExperienceContext"
import { useEffect, useRef, useState } from "react"
import { playCue } from "@/lib/sound"
import { playHaptic } from "@/lib/haptics"
import { useLanguage } from "@/contexts/LanguageContext"

export interface SpinSegment {
  id: number
  label: string
  type: "coins" | "xp"
  value: number
}

/**
 * The wheel, which until now was a button.
 *
 * The rewards screen had a heading that said "Free Spin", a paragraph that
 * described a spin, and a `<PremiumButton>` that made a server call and printed
 * a sentence. Nothing turned. A player was told they had won something without
 * ever being shown the thing they won it from, which is the weakest possible
 * version of the one moment on this screen that is meant to feel like a gift.
 *
 * ── The outcome is not decided here ───────────────────────────────────────
 * This component cannot pick a prize and does not try to. `spin_wheel_rpc`
 * chooses, awards and records the reward before this animation starts; the
 * wheel is handed the index it must stop on and its only job is to arrive
 * there. So what the player watches land under the pointer is, by
 * construction, the reward already written to their profile — there is no
 * second source of truth to drift from, and no way for a client that lies to
 * itself to pay out differently from the server.
 *
 * ── On spinning something in a children's Islamic app ─────────────────────
 * Migration 0008 took the randomness out of this wheel and out of the chests
 * on purpose, on loot-box grounds: paying a set price for an unknown return is
 * structurally gacha. Read that file before adding any randomness back.
 *
 * Nothing here reintroduces it. The prize is still a fixed function of the
 * date, the same for every player, and the spin costs nothing at all — there
 * is no payment, so there is no wager. What this adds is the reveal, not the
 * gamble: it is the wrapping paper on a gift already chosen, which is why the
 * wheel decelerates into a known answer rather than tumbling toward an unknown
 * one.
 */
export function SpinWheel({
  segments,
  targetIndex,
  spinToken,
  onSettled,
}: {
  segments: SpinSegment[]
  /** Index into `segments` the server chose, or null while idle. */
  targetIndex: number | null
  /**
   * Increments once per spin, and is what actually starts the animation.
   *
   * `targetIndex` alone cannot: the prize is a function of the date, so a
   * player who leaves this tab open overnight and spins again gets a different
   * day's reward — but two spins that happen to land on the same segment would
   * set the same index twice, the effect below would not re-run, and the wheel
   * would sit still with the button stuck on "Spinning..." forever.
   */
  spinToken: number
  /** Fired once the wheel has stopped, so the caller can reveal the prize. */
  onSettled: () => void
}) {
  const { t } = useLanguage()
  const reduced = useGameReducedMotion()
  const [rotation, setRotation] = useState(0)
  const frame = useRef<number | null>(null)
  /**
   * The callback is read through a ref rather than listed as a dependency.
   * `onSettled` is an inline arrow in the parent, so a new function identity
   * arrives on every render; depending on it would cancel and restart the
   * animation each time the parent re-rendered mid-spin — which it does, once
   * a second, because the countdown beside this wheel ticks.
   */
  const settled = useRef(onSettled)
  useEffect(() => {
    settled.current = onSettled
  })

  const count = segments.length
  const arc = count > 0 ? 360 / count : 360

  useEffect(() => {
    if (targetIndex === null || count === 0) return

    // Where that segment's centre sits, measured clockwise from the pointer at
    // twelve o'clock. Rotating the wheel by `360n - centre` brings it back
    // under the pointer after n whole turns.
    const centre = (targetIndex + 0.5) * arc
    const turns = 5
    const from = rotation
    const to = Math.ceil(from / 360) * 360 + 360 * turns - centre


    // No spin under reduced motion. A five-second rotation is precisely the
    // kind of large sustained movement the preference exists to suppress, so
    // the wheel is simply already on the answer and the reveal is immediate.
    if (reduced) {
      setRotation(to)
      settled.current()
      return
    }

    const duration = 4200
    const start = performance.now()
    // Quartic ease-out: fast enough at the top that the labels blur, and a long
    // enough tail that the last two or three segments crawl past the pointer.
    const ease = (p: number) => 1 - Math.pow(1 - p, 4)
    let lastSegment = -1

    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const current = from + (to - from) * ease(p)
      setRotation(current)

      // One tick per segment crossing the pointer, which slows down exactly as
      // the wheel does. This is `tick`, the quietest cue in the set and the one
      // whose own definition says it repeats.
      const crossed = Math.floor(current / arc)
      if (crossed !== lastSegment) {
        if (lastSegment !== -1) playCue("tick")
        lastSegment = crossed
      }

      if (p < 1) {
        frame.current = requestAnimationFrame(step)
      } else {
        frame.current = null
        playCue("rankUp")
        playHaptic("rankUp")
        settled.current()
      }
    }

    frame.current = requestAnimationFrame(step)
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
    // `rotation` is read to start from wherever the wheel came to rest, but it
    // must not retrigger the animation on every frame it sets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinToken, targetIndex, arc, count, reduced])

  if (count === 0) return null

  /** A point on the rim, `deg` clockwise from twelve o'clock. */
  const rim = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180
    return [100 + r * Math.sin(rad), 100 - r * Math.cos(rad)] as const
  }

  return (
    <div className="relative mx-auto mb-5 aspect-square w-full max-w-[260px]">
      {/* The pointer, fixed at twelve o'clock while the wheel turns under it. */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-0 z-20 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[16px] border-x-transparent border-t-primary drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
      />

      <svg
        viewBox="0 0 200 200"
        className="h-full w-full"
        style={{ transform: `rotate(${rotation}deg)` }}
        // The wheel is ornament around a number. The prize is announced in the
        // live region on the page, so describing eight segments here would read
        // out the whole prize table on every focus for no gain.
        aria-hidden="true"
      >
        {segments.map((segment, i) => {
          const [x1, y1] = rim(i * arc, 92)
          const [x2, y2] = rim((i + 1) * arc, 92)
          return (
            <path
              key={segment.id}
              d={`M100,100 L${x1},${y1} A92,92 0 ${arc > 180 ? 1 : 0} 1 ${x2},${y2} Z`}
              // Alternating tints of the surface rather than eight colours: a
              // rainbow wheel is a fairground, and the rest of this app is one
              // gold on one dark ground.
              fill={i % 2 === 0 ? "rgba(240,205,109,0.14)" : "rgba(23,31,51,0.85)"}
              stroke="rgba(240,205,109,0.35)"
              strokeWidth="1"
            />
          )
        })}

        {segments.map((segment, i) => (
          <text
            key={segment.id}
            x="100"
            y="42"
            transform={`rotate(${(i + 0.5) * arc} 100 100)`}
            textAnchor="middle"
            className="fill-on-surface text-[11px] font-bold"
          >
            {segment.value}
            <tspan x="100" dy="11" className="fill-primary text-[8px] uppercase tracking-wider">
              {segment.type === "coins" ? t("coinsWord") : t("xpShort")}
            </tspan>
          </text>
        ))}

        <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(240,205,109,0.5)" strokeWidth="2" />
        <circle cx="100" cy="100" r="14" fill="rgba(23,31,51,0.95)" stroke="rgba(240,205,109,0.5)" strokeWidth="2" />
      </svg>
    </div>
  )
}
