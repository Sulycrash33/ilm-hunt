/**
 * The game's touch.
 *
 * This is the third feedback channel, alongside colour and sound. It exists
 * because the two that were already here both fail in the situation this app
 * is most often used in: a phone, in a pocket-sized moment, with the ringer
 * off. Sound is off by default and deliberately so (see `sound.ts`); colour
 * needs the eye to already be on the thing that changed. A short vibration
 * needs neither.
 *
 * ── What this deliberately is not ─────────────────────────────────────────
 * There is no vibration on a wrong answer that is longer or harsher than the
 * one for a right answer. A buzz is felt before it is interpreted, and a
 * punishing one on a learning app teaches the hand to dread the screen. Wrong
 * gets a single soft tap that says "registered", not "bad".
 *
 * ── On support ────────────────────────────────────────────────────────────
 * `navigator.vibrate` is Android and desktop Chrome. **iOS Safari does not
 * implement it at all**, and no amount of feature detection changes that, so
 * roughly half the audience will never feel any of this. That is the honest
 * position and the reason haptics are an enhancement layered on top of the
 * existing colour and sound feedback rather than a replacement for any of it:
 * every cue here has a visible counterpart that already works everywhere.
 *
 * ── On defaults ───────────────────────────────────────────────────────────
 * Unlike sound, haptics default to ON. A vibration is private: it does not
 * carry to the person sitting beside you on a bus, which is the whole reason
 * sound defaults off. It is still switchable, and it is switched off
 * automatically for anyone who has asked their device to reduce motion, since
 * the same setting is what people with vestibular and sensory sensitivities
 * reach for.
 */

export type HapticCue =
  | "select"
  | "correct"
  | "wrong"
  | "levelComplete"
  | "rankUp"
  | "comboUp"
  | "streak"

const STORAGE_KEY = "ilm-haptics-enabled"

/**
 * Patterns in milliseconds. `navigator.vibrate` takes either a single duration
 * or an alternating vibrate/pause array.
 *
 * Everything here is short. The longest total is the rank promotion at 260ms
 * across three pulses, which is roughly the length of a knock on a door; the
 * common ones are 10 to 40ms, at the threshold where a pulse reads as a click
 * rather than a buzz.
 */
const PATTERNS: Record<HapticCue, number | number[]> = {
  // The lightest thing the API can express. Fires on every option tap, so it
  // has to be nearly subliminal or it becomes an irritation by question three.
  select: 10,
  // Two quick taps, rising in feel. Affirmative without being a fanfare.
  correct: [18, 40, 26],
  // One soft tap. Shorter than `correct`, never longer: see above.
  wrong: 24,
  // The earned moment at the end of a tier.
  levelComplete: [30, 50, 30, 50, 60],
  // The rarest, nine times in a whole playthrough.
  rankUp: [40, 60, 40, 60, 80],
  // The multiplier stepping up. Two light taps: more than `correct`, well
  // short of `levelComplete`, because it can happen several times a run.
  comboUp: [14, 34, 22],
  // A streak carried into another day. Two unhurried pulses with a longer gap
  // than any other cue here: this one is not reacting to something the player
  // just did, it is greeting them, so it should feel like a nod rather than a
  // buzz.
  streak: [22, 90, 30],
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

/** On unless the player has explicitly turned it off, and never when the
 *  device has asked for reduced motion. */
export function isHapticsEnabled(): boolean {
  if (typeof window === "undefined") return false
  if (prefersReducedMotion() || document.documentElement.dataset.calmEffects === "true") return false
  try {
    // Absent means "not yet chosen", which is on. Only an explicit "false"
    // turns it off, so a cleared storage returns to the default rather than
    // to silence.
    return window.localStorage.getItem(STORAGE_KEY) !== "false"
  } catch {
    // Private windows and blocked site data throw on access rather than
    // returning null. A thrown storage read must not decide the default.
    return true
  }
}

export function setHapticsEnabled(on: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "true" : "false")
  } catch {
    /* nothing to do; the setting simply does not persist this session */
  }
}

/** Whether this device can vibrate at all. Used by the settings UI to avoid
 *  offering a switch that could not possibly do anything. */
export function hapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
}

/**
 * Fire a cue. Silent, and free, when haptics are off, when the browser has no
 * vibration API, or when anything at all goes wrong: a game must never fail
 * because a phone would not buzz.
 */
export function playHaptic(cue: HapticCue): void {
  if (!isHapticsEnabled()) return
  if (!hapticsSupported()) return
  try {
    navigator.vibrate(PATTERNS[cue])
  } catch {
    /* a failed cue is never worth breaking a run over */
  }
}

/** Stop any pattern still running. Called when a run is abandoned mid-cue. */
export function cancelHaptics(): void {
  if (!hapticsSupported()) return
  try {
    navigator.vibrate(0)
  } catch {
    /* nothing to do */
  }
}
