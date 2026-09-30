"use client";

import { useGameReducedMotion as useReducedMotion } from "@/contexts/GameExperienceContext";

import { motion } from "framer-motion";
import { Check, X, LoaderCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { playCue } from "@/lib/sound";
import { playHaptic } from "@/lib/haptics";

export type OptionState = "idle" | "eliminated" | "correct" | "wrong" | "missed";

interface OptionTileProps {
  label: string;
  index: number;
  state: OptionState;
  disabled: boolean;
  onSelect: () => void;
  pending?: boolean;
}

/**
 * One answer choice.
 *
 * Five states, because the reveal has to say more than right/wrong: the choice
 * the player picked and got right (`correct`), the choice they picked and got
 * wrong (`wrong`), the answer they *should* have picked shown alongside their
 * miss (`missed`), a choice removed by 50/50 (`eliminated`), and untouched.
 *
 * Every state pairs colour with a glyph or an opacity change — colour alone
 * would leave a colour-blind player unable to read the reveal.
 */
export function OptionTile({ label, index, state, disabled, onSelect, pending = false }: OptionTileProps) {
  const { t } = useLanguage();
  const letter = String.fromCharCode(65 + index);
  const interactive = state === "idle" && !disabled;
  const reduce = useReducedMotion();

  /**
   * The reveal, felt rather than only read.
   *
   * The states already said right and wrong in colour and glyph; they said it
   * without moving, which made getting one right feel the same as reading a
   * table. A correct answer now pops once, and a wrong one shakes — the two
   * motions every quiz game has used for decades because they map onto what
   * the player already feels.
   *
   * `missed` deliberately does not move. It is the answer the player did not
   * choose, shown beside their mistake; animating it would compete with the
   * shake that is telling them what they did.
   */
  const feedback = reduce
    ? undefined
    : state === "correct"
      ? { scale: [1, 1.035, 1] }
      : state === "wrong"
        ? { x: [0, -7, 6, -4, 3, 0] }
        : undefined;

  return (
    <motion.button
      type="button"
      // Plays its own `tap` below, so the app-wide TapCue listener skips it
      // rather than stacking a second click on the same press.
      data-self-cue=""
      disabled={disabled || state === "eliminated"}
      onClick={() => {
        // The tap, acknowledged in the hand and the ear before the server
        // has said anything. The grade arrives a round trip later and brings
        // its own cue; these only say the press registered, which is the gap
        // that made a slow connection feel like a dead button.
        //
        // The haptic has been here since it was built; the sound had not,
        // which meant anyone on an iPhone — where `navigator.vibrate` does
        // not exist at all — got no acknowledgement of their own tap
        // whatsoever, no matter what they had switched on.
        playCue("tap");
        playHaptic("select");
        onSelect();
      }}
      whileHover={interactive && !reduce ? { scale: 1.02 } : undefined}
      whileTap={interactive && !reduce ? { scale: 0.97 } : undefined}
      animate={feedback}
      transition={
        state === "correct"
          ? { duration: 0.34, ease: "easeOut" }
          : { duration: 0.4, ease: "easeInOut" }
      }
      aria-label={`${letter}. ${label}${pending ? `. ${t("checkingAnswer")}` : state === "correct" || state === "missed" ? `. ${t("correct")}` : state === "wrong" ? `. ${t("incorrect")}` : ""}`}
      aria-busy={pending}
      className={cn(
        "flex min-h-16 w-full items-center gap-4 rounded-2xl border-2 p-4 text-start transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        state === "idle" &&
          "border-transparent bg-surface-container hover:border-primary/50 hover:bg-surface-container-high",
        state === "eliminated" && "border-transparent bg-surface-container opacity-30",
        // The glow is what carries the win at a glance, before the eye reaches
        // the tick.
        state === "correct" &&
          "border-primary bg-primary/10 shadow-[0_0_26px_-6px_rgba(240,205,109,0.65)]",
        state === "wrong" && "border-error bg-error/10",
        state === "missed" && "border-primary/60 bg-primary/5",
        disabled && state === "idle" && "opacity-70",
        pending && "!border-primary/60 !bg-primary/10 !opacity-100",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
          state === "correct" && "bg-primary text-on-primary",
          state === "missed" && "bg-primary/70 text-on-primary",
          state === "wrong" && "bg-error text-on-error",
          (state === "idle" || state === "eliminated") &&
            "bg-surface-container-highest text-primary",
        )}
        aria-hidden="true"
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : state === "correct" || state === "missed" ? (
          <Check className="h-4 w-4" />
        ) : state === "wrong" ? (
          <X className="h-4 w-4" />
        ) : (
          letter
        )}
      </span>

      <span className="min-w-0 flex-1 whitespace-normal font-medium text-on-surface">{label}</span>
    </motion.button>
  );
}
