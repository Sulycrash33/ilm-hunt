"use client"

import { useGameReducedMotion } from "@/contexts/GameExperienceContext"
import { motion } from "framer-motion"
import { ReactNode } from "react"

interface PremiumStatProps {
  label: string
  value: string | number | React.ReactNode
  icon?: ReactNode
  /**
   * What the figure is over.
   *
   * A percentage with no denominator is not a statistic, it is a riddle. The
   * profile printed a bare **40%** under the word ACCURACY next to a rank and
   * a streak, and the owner's reading of it was the only reasonable one: that
   * the number had come from nowhere, since all they had played was the daily
   * challenge. It had not — it was two of the five questions in that
   * challenge — but nothing on the card said five, so nothing on the card
   * could be checked. This line says it.
   */
  hint?: ReactNode
  trend?: "up" | "down" | "neutral"
  trendValue?: string
  className?: string
}

export function PremiumStat({
  label,
  value,
  icon,
  hint,
  trend,
  trendValue,
  className = "",
}: PremiumStatProps) {
  const reduce = useGameReducedMotion()
  const trendColors = {
    up: "text-success",
    down: "text-error",
    neutral: "text-on-surface-variant",
  }

  const trendIcons = {
    up: "↑",
    down: "↓",
    neutral: "→",
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`text-center ${className}`}
    >
      {icon && (
        <div className="flex items-center gap-1 justify-center mb-1">
          {icon}
          <span className="font-bold text-headline-md text-on-surface">
            {value}
          </span>
        </div>
      )}
      {!icon && (
        <span className="font-bold text-headline-md text-on-surface block">
          {value}
        </span>
      )}
      <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
        {label}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs leading-tight text-on-surface-variant tabular-nums">
          {hint}
        </p>
      )}
      {trend && trendValue && (
        <div className={`flex items-center justify-center gap-1 mt-1 text-xs ${trendColors[trend]}`}>
          <span>{trendIcons[trend]}</span>
          <span>{trendValue}</span>
        </div>
      )}
    </motion.div>
  )
}
