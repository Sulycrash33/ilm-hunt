"use client"

import { motion } from "framer-motion"
import { type ReactNode, type KeyboardEvent } from "react"
import { useGameReducedMotion } from "@/contexts/GameExperienceContext"

interface PremiumCardProps {
  children: ReactNode
  className?: string
  variant?: "glass" | "solid" | "gradient"
  hover?: boolean
  animate?: boolean
  delay?: number
  onClick?: () => void
}

export function PremiumCard({ children, className = "", variant = "glass", hover = false,
  animate = true, delay = 0, onClick }: PremiumCardProps) {
  const reduce = useGameReducedMotion()
  const variants = {
    glass: "glass-card",
    solid: "bg-surface-container border border-white/10",
    gradient: "bg-gradient-to-br from-surface-container to-surface-container-high border border-white/10",
  }
  const classes = `${variants[variant]} rounded-2xl ${hover || onClick ? "interactive-card" : ""} ${className}`
  const interactive = onClick ? {
    role: "button", tabIndex: 0, onClick,
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick() }
    },
  } : {}
  if (!animate || reduce) return <div {...interactive} className={classes}>{children}</div>
  return <motion.div {...interactive} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay: Math.min(delay, 0.25) }} className={classes}>{children}</motion.div>
}
