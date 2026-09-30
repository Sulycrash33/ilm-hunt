"use client"

import { motion } from "framer-motion"
import { type ReactNode } from "react"
import Link from "next/link"
import { useGameReducedMotion } from "@/contexts/GameExperienceContext"

interface PremiumButtonProps {
  children: ReactNode
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
  href?: string
  onClick?: () => void
  className?: string
  disabled?: boolean
  fullWidth?: boolean
  "aria-label"?: string
  "aria-busy"?: boolean
  type?: "button" | "submit" | "reset"
}
const MotionLink = motion.create(Link)

export function PremiumButton({ children, variant = "primary", size = "md", href, onClick,
  className = "", disabled = false, fullWidth = false, type = "button", "aria-label": ariaLabel, "aria-busy": ariaBusy }: PremiumButtonProps) {
  const reduce = useGameReducedMotion()
  const variants = {
    primary: "bg-primary text-on-primary shadow-lg hover:bg-primary-fixed",
    secondary: "bg-surface-container-high text-on-surface border border-white/10 hover:bg-surface-container-highest",
    ghost: "bg-transparent text-on-surface hover:bg-white/5",
    danger: "bg-error text-on-error hover:opacity-90",
  }
  const sizes = { sm: "px-4 py-2 text-sm rounded-xl", md: "px-6 py-3 text-base rounded-xl", lg: "px-8 py-4 text-lg rounded-full" }
  const classes = `game-button inline-flex min-h-11 items-center justify-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed ${fullWidth ? "w-full" : ""} ${variants[variant]} ${sizes[size]} ${className}`
  const motionProps = { whileTap: reduce || disabled ? undefined : { scale: 0.97 }, whileHover: reduce || disabled ? undefined : { y: -2 } }
  if (href && !disabled) return <MotionLink {...motionProps} aria-label={ariaLabel} aria-busy={ariaBusy} href={href} onClick={onClick} className={classes}>{children}</MotionLink>
  return <motion.button {...motionProps} aria-label={ariaLabel} aria-busy={ariaBusy} type={type} onClick={onClick} disabled={disabled} className={classes}>{children}</motion.button>
}
