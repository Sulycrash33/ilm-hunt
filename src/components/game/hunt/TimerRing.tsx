"use client";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface TimerRingProps {
  /** Seconds remaining. */
  remaining: number;
  /** Seconds the question started with. */
  total: number;
  /** Suppresses the urgency pulse once an answer is locked in. */
  frozen?: boolean;
}

/**
 * The countdown, as a ring that drains rather than a number that ticks.
 *
 * An SVG circle with a dash offset gives the whole remaining time at a glance
 * in peripheral vision, which matters when the player is reading the question
 * rather than watching the clock. Colour carries the same signal a second time
 * for anyone who can't easily judge the arc: gold while there's room, red under
 * ten seconds.
 */
export function TimerRing({ remaining, total, frozen = false }: TimerRingProps) {
  const { t } = useLanguage();
  const safeTotal = total > 0 ? total : 1;
  const fraction = Math.max(0, Math.min(1, remaining / safeTotal));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const urgent = remaining <= 10 && !frozen;

  return (
    <div
      className="relative h-16 w-16 shrink-0"
      role="timer"
      aria-live="off"
      aria-label={t("soloTimeRemaining", { count: Math.max(0, Math.ceil(remaining)) })}
    >
      <svg className="h-full w-full -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="5"
          className="stroke-surface-container-highest"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={cn(
            "transition-[stroke-dashoffset,stroke] duration-1000 ease-linear",
            urgent ? "stroke-error" : "stroke-tertiary",
          )}
        />
      </svg>
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center font-bold tabular-nums",
          urgent ? "animate-pulse text-error" : "text-tertiary",
        )}
      >
        {Math.max(0, Math.ceil(remaining))}
      </div>
    </div>
  );
}
