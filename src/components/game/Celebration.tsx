"use client";

import { useGameReducedMotion as useReducedMotion } from "@/contexts/GameExperienceContext";

import { useEffect, useState } from "react";
import Confetti from "react-confetti";


/**
 * The payoff burst on a won run.
 *
 * `react-confetti` has been a dependency of this project for its whole life
 * and was never once imported, which is why finishing a tier looked much like
 * failing one: the same card, with better numbers on it.
 *
 * Three decisions worth keeping:
 *
 * **The colours are the brand's, not the library's.** The default palette is
 * a primary-school rainbow and would have been the only place in the app
 * showing hues that appear in no token. These five are the gold, the cream and
 * the mint the rest of the interface is built from, so the celebration reads
 * as this app celebrating rather than a plugin firing.
 *
 * **It stops.** `recycle` is false and the piece count is finite, so the burst
 * falls once and is done in a few seconds. An infinite emitter behind a
 * summary screen is a battery drain on exactly the phones this game is played
 * on, and it turns a moment into wallpaper.
 *
 * **It is decoration, and it is honest about that.** `aria-hidden`, no pointer
 * events, and nothing is announced: the screen behind it already states the
 * result in text for anyone who cannot see this. A player who has asked for
 * reduced motion gets no confetti at all, which is why the whole component
 * returns null rather than rendering a still frame.
 */

const BRAND_CONFETTI = [
  "#f0cd6d", // primary, the brand gold
  "#ffe9ad", // primary-fixed, its light step
  "#7fd4b0", // tertiary, the mint that means success
  "#b8f2d8", // tertiary-fixed
  "#dcc9a4", // secondary, warm sand
];

interface CelebrationProps {
  /** Fires the burst when it becomes true. */
  active: boolean;
  /** Roughly how many pieces. Kept low on purpose; see above. */
  pieces?: number;
}

export function Celebration({ active, pieces = 180 }: CelebrationProps) {
  const reduce = useReducedMotion();
  // Confetti needs real pixel dimensions and the library reads `window` to get
  // them. Rendering nothing until after mount keeps this off the server render
  // entirely rather than guessing a size and reflowing.
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  if (!active || reduce || done || !size) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden="true"
      data-testid="celebration"
    >
      <Confetti
        width={size.w}
        height={size.h}
        numberOfPieces={pieces}
        colors={BRAND_CONFETTI}
        recycle={false}
        gravity={0.22}
        initialVelocityY={12}
        tweenDuration={6000}
        // Unmount once the last piece has landed, so nothing is left painting
        // an empty canvas over the summary for the rest of the session.
        onConfettiComplete={() => setDone(true)}
      />
    </div>
  );
}
