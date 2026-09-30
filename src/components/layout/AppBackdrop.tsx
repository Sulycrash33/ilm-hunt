import { IslamicPattern } from "@/components/islamic-pattern"

/**
 * The field every screen in the game sits on.
 *
 * This is the onboarding backdrop with the names lifted out. Onboarding and
 * the game were already drawing the same two glows and the same khatim — the
 * code was duplicated between `(app)/layout.tsx` and `OnboardingBackdrop`, and
 * it had drifted in exactly the way duplicated code does: onboarding held an
 * even field (`flat`) while the game used `masked`, which fades to nothing a
 * screenful down. So the ornament was a property of the opening flow and then
 * quietly disappeared for the rest of the app, on pages that scroll much
 * further than any onboarding screen does.
 *
 * `flat` on both now, from one file.
 *
 * ── Why the names are not here ────────────────────────────────────────────
 * `NamesOfAllahBackdrop` stays in `OnboardingBackdrop` alone. It is a
 * 17,000px drifting column, and putting it behind gameplay would mean the
 * names of Allah scrolling underneath a scoreboard, a shop and a countdown to
 * a prize — the wrong company for them, and a moving layer competing with
 * question text besides. Keeping it to onboarding also keeps it as something
 * that marks the opening rather than wallpaper you stop seeing.
 *
 * Not a client component: three divs, no state, no hooks, no JavaScript.
 */
export function AppBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute top-1/2 -left-24 h-80 w-80 rounded-full bg-secondary/5 blur-[100px]" />
      <div className="absolute inset-0 opacity-50"><IslamicPattern variant="flat" /></div>
    </div>
  )
}
