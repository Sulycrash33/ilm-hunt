"use client"

import { useGameReducedMotion as useReducedMotion } from "@/contexts/GameExperienceContext";

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Hand, CheckCircle2, Flame, Trophy, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OnboardingBackdrop } from "@/components/layout/OnboardingBackdrop"
import { SoundToggle } from "@/components/profile/SoundToggle"
import { HapticsToggle } from "@/components/profile/HapticsToggle"
import { VolumeSlider } from "@/components/profile/VolumeSlider"
import { useLanguage } from "@/contexts/LanguageContext"
import { playCue, type SoundCue } from "@/lib/sound"
import { playHaptic, type HapticCue } from "@/lib/haptics"
import type { Translations } from "@/lib/i18n"

/**
 * Sound and vibration setup, shown once between signing up and the explainer.
 *
 * ── Why the screen exists ─────────────────────────────────────────────────
 * Sound is off by default and stays off until somebody says otherwise, for
 * the reasons written at the top of `sound.ts`. The consequence was that the
 * only way to turn it on was to find the profile, which almost nobody does
 * before their first run — so the sound system that had been carefully
 * designed was, for a new player, simply absent. A compact toggle was dropped
 * into the corner of each onboarding screen as a stopgap. A corner icon is
 * not an invitation; this is.
 *
 * ── Why here in the flow ──────────────────────────────────────────────────
 * After the language choice and the intro, before the three profile steps. It
 * was briefly placed after signup instead; this is earlier, and earlier is
 * better for one concrete reason. An AudioContext may not start outside a
 * user gesture, so the tap that switches sound on is also the tap that opens
 * the audio device. Doing that near the top of onboarding means every screen
 * after it can make a sound; doing it at the end meant most of onboarding was
 * silent whatever the player had chosen.
 *
 * It sits outside the "Step N of 3" numbering on purpose. Age, avatar and
 * name build a profile; this sets two device preferences that are not stored
 * on the account at all. Counting it as a fourth step would promise the
 * player their answers here follow them to another phone, and they do not.
 *
 * ── Why the previews ──────────────────────────────────────────────────────
 * A volume slider with nothing to play is a guess. Every cue the game will
 * actually fire at a player is here to be tapped, so the level they choose is
 * one they chose by listening. The failure cue is deliberately not among them:
 * it exists, it is soft by design, and a screen before the first question is
 * not the place to rehearse getting something wrong.
 */

interface Preview {
  cue: SoundCue
  haptic: HapticCue
  labelKey: keyof Translations
  Icon: typeof Hand
}

/** In the order a player meets them: every press, then a right answer, then
 *  the three things worth stopping for. */
const PREVIEWS: Preview[] = [
  { cue: "tap", haptic: "select", labelKey: "cueTap", Icon: Hand },
  { cue: "correct", haptic: "correct", labelKey: "cueCorrect", Icon: CheckCircle2 },
  { cue: "streak", haptic: "streak", labelKey: "cueStreak", Icon: Flame },
  { cue: "levelComplete", haptic: "levelComplete", labelKey: "cueLevelComplete", Icon: Trophy },
  { cue: "rankUp", haptic: "rankUp", labelKey: "cueRankUp", Icon: Crown },
]

export default function SoundSetupPage() {
  const { t, dir } = useLanguage()
  const reduce = useReducedMotion()
  /** Bumped on every preview so the star can answer the sound. A counter
   *  rather than a boolean: tapping the same cue twice has to restart the
   *  animation, and re-setting a boolean to the value it already holds does
   *  not. */
  const [beat, setBeat] = useState(0)

  function preview(p: Preview) {
    playCue(p.cue)
    playHaptic(p.haptic)
    setBeat((b) => b + 1)
  }

  return (
    <div
      dir={dir}
      className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-background p-4 py-8"
    >
      <OnboardingBackdrop />

      {/* Back is real now. When this screen sat after signup there was
          nothing sensible behind it — the account already existed — so it had
          none. Sitting between language and age, the step before it is a step
          the player can genuinely return to. */}
      <div className="absolute start-4 top-4 z-20">
        <Button asChild variant="ghost" size="sm">
          <Link href="/intro">
            <ArrowLeft className="me-2 h-5 w-5" aria-hidden="true" />
            {t("back")}
          </Link>
        </Button>
      </div>

      <div className="absolute end-4 top-4 z-20">
        <Button asChild variant="ghost" size="sm">
          <Link href="/onboarding/age">{t("skip")}</Link>
        </Button>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* The khatim, the same eight-pointed star the backdrop tiles, drawn
            as what it actually is: two squares, one turned forty-five
            degrees. The mockup used an arbitrary star path with eight uneven
            arms, which is a star but not this motif. It answers each cue with
            one pulse, so the page has a visible channel as well as an audible
            one — which is the only feedback anyone gets on an iPhone, where
            `navigator.vibrate` does not exist. */}
        <motion.div
          key={beat}
          initial={reduce || beat === 0 ? false : { scale: 0.94, opacity: 0.75 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="mx-auto mb-6 flex h-28 w-28 items-center justify-center"
        >
          <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <rect x="24" y="24" width="52" height="52" />
              <rect x="24" y="24" width="52" height="52" transform="rotate(45 50 50)" />
            </g>
          </svg>
        </motion.div>

        <div className="mb-6 space-y-2 text-center">
          <h1 className="font-headline text-3xl font-bold text-on-surface">
            {t("soundSetupTitle")}
          </h1>
          <p className="mx-auto max-w-sm text-on-surface-variant">{t("soundSetupSubtitle")}</p>
        </div>

        <div className="space-y-3">
          <SoundToggle />
          <VolumeSlider />
          {/* Renders nothing at all where the device cannot vibrate, which is
              every iPhone. A switch that could not possibly do anything is
              worse than an absent one. */}
          <HapticsToggle />

          <div className="rounded-xl border border-white/10 bg-surface-container p-5">
            <h2 className="mb-3 font-semibold text-on-surface">{t("soundTryTitle")}</h2>
            <div className="flex flex-wrap gap-2">
              {PREVIEWS.map(({ cue, labelKey, Icon, haptic }) => (
                <button
                  key={cue}
                  type="button"
                  onClick={() => preview({ cue, haptic, labelKey, Icon })}
                  className="flex items-center gap-2 rounded-full border border-primary/25 bg-surface-container-high px-3 py-2 text-sm text-on-surface transition-colors hover:border-primary/60 hover:bg-surface-container-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button asChild size="lg" className="mt-6 h-12 w-full">
          <Link href="/onboarding/age">
            {t("continue")}
            <ArrowRight className="ms-2 h-5 w-5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
