import assert from "node:assert/strict"
import { isHapticsEnabled, playHaptic, setHapticsEnabled } from "../src/lib/haptics"

const originals = Object.fromEntries(["window", "document", "navigator"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
const store = new Map<string, string>()
let systemReduced = false
let vibrations = 0
const dataset = { calmEffects: "false" }
try {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    matchMedia: () => ({ matches: systemReduced }),
    localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) },
  } })
  Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { dataset } } })
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { vibrate: () => { vibrations++; return true } } })
  assert.equal(isHapticsEnabled(), true)
  playHaptic("select")
  assert.equal(vibrations, 1)
  dataset.calmEffects = "true"
  assert.equal(isHapticsEnabled(), false, "The game's reduced-effects preference also silences sensory vibration")
  playHaptic("correct")
  assert.equal(vibrations, 1)
  dataset.calmEffects = "false"
  systemReduced = true
  assert.equal(isHapticsEnabled(), false, "System reduced-motion always takes precedence")
  systemReduced = false
  setHapticsEnabled(false)
  assert.equal(isHapticsEnabled(), false)
  setHapticsEnabled(true)
  assert.equal(isHapticsEnabled(), true)
  console.log("Haptics: defaults, manual reduced effects, system reduced motion and explicit preference passed.")
} finally {
  for (const [key, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
}
