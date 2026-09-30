"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { MotionConfig, useReducedMotion } from "framer-motion"

const ExperienceContext = createContext({ calm: false, setCalm: (_value: boolean) => {} })
const STORAGE_KEY = "ilm-hunt-reduce-effects"

export function GameExperienceProvider({ children }: { children: ReactNode }) {
  const [calm, setCalmState] = useState(false)
  useEffect(() => {
    try { setCalmState(localStorage.getItem(STORAGE_KEY) === "true") } catch {}
  }, [])
  useEffect(() => {
    document.documentElement.dataset.calmEffects = String(calm)
    return () => { delete document.documentElement.dataset.calmEffects }
  }, [calm])
  const setCalm = (value: boolean) => {
    setCalmState(value)
    try { localStorage.setItem(STORAGE_KEY, String(value)) } catch {}
  }
  return <ExperienceContext.Provider value={{ calm, setCalm }}>
    <MotionConfig reducedMotion={calm ? "always" : "user"}>{children}</MotionConfig>
  </ExperienceContext.Provider>
}

export const useGameExperience = () => useContext(ExperienceContext)

export function useGameReducedMotion() {
  const systemPreference = useReducedMotion()
  const { calm } = useGameExperience()
  return calm || Boolean(systemPreference)
}
