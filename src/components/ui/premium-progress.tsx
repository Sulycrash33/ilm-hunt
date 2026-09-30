"use client"

import { useGameReducedMotion } from "@/contexts/GameExperienceContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { motion } from "framer-motion"

interface PremiumProgressProps {
  value: number
  max?: number
  size?: "sm" | "md" | "lg"
  variant?: "primary" | "secondary" | "tertiary" | "gradient"
  showLabel?: boolean
  label?: string
  className?: string
}

export function PremiumProgress({
  value,
  max = 100,
  size = "md",
  variant = "primary",
  showLabel = false,
  label,
  className = "",
}: PremiumProgressProps) {
  const reduce = useGameReducedMotion()
  const { t } = useLanguage()
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(value, safeMax)) : 0
  const percentage = (safeValue / safeMax) * 100

  const sizes = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  }

  const variants = {
    primary: "from-primary to-primary-fixed-dim",
    secondary: "from-secondary to-secondary-fixed-dim",
    tertiary: "from-tertiary to-tertiary-fixed-dim",
    gradient: "from-primary via-secondary to-tertiary",
  }

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-on-surface-variant">
            {label || t("overallProgress")}
          </span>
          <span className="text-sm font-bold text-on-surface">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div role="progressbar" aria-label={label ?? t("overallProgress")} aria-valuemin={0} aria-valuemax={safeMax} aria-valuenow={safeValue}
        className={`
          w-full ${sizes[size]}
          bg-surface-container-highest
          rounded-full overflow-hidden
        `}
      >
        <motion.div
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: reduce ? 0 : 0.8, ease: "easeOut" }}
          className={`
            h-full
            bg-gradient-to-r ${variants[variant]}
            rounded-full
            shadow-[0_0_8px_rgba(240, 205, 109,0.3)]
          `}
        />
      </div>
    </div>
  )
}
