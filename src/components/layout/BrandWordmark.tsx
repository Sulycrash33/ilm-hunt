import { IlmHuntStar } from "@/components/icons/IlmHuntMark"

/**
 * The wordmark, as it appears at the top of the home screen.
 *
 * What was there: the two words in Inter, semibold, with a left-to-right gold
 * gradient clipped to the text. The owner's verdict on it was "not fine at
 * all, boring", and the diagnosis is not really taste — three things were
 * actually wrong.
 *
 *   1. **It was set in the wrong face.** Every other place the brand appears —
 *      the opening screen, sign-up, sign-in, the password screens — sets it in
 *      Source Serif at display size. The home screen, the screen a player sees
 *      more often than all of those put together, was the one that did not,
 *      so the app's own name changed typeface when you signed in.
 *   2. **The mark was not on it.** `IlmHuntMark` and `IlmHuntGlyph` are drawn,
 *      committed and used on five routes. The home header had no mark of any
 *      kind, which is why it read as a heading rather than as a masthead.
 *   3. **Nothing moved.** A masthead does not need to move, but a gold one on
 *      a dark ground that is completely inert reads as flat paint, which is
 *      exactly the complaint.
 *
 * So: the serif, the brand's own star as the ornament, and a hairline that
 * fades out under the words — a rule that stops rather than a box that closes,
 * which is what stops a small lockup looking like a button.
 *
 * ── The motion, and its limits ────────────────────────────────────────────
 * Two CSS animations, both defined in `tailwind.config.ts`, both slow: gold
 * travelling through the letters over nine seconds, and the star breathing
 * over six and a half. The periods are deliberately coprime-ish so they drift
 * against each other instead of locking into one shared pulse, which is what
 * makes a decoration start looking like a progress indicator.
 *
 * Both carry `motion-reduce:animate-none`. That is not politeness — this is
 * a fixed header, in view for the whole session, and a player who has asked
 * their system for reduced motion has asked for exactly this to stop.
 *
 * No `framer-motion` here on purpose. Everything above is paint, so it belongs
 * to the compositor; wiring it to React state would re-render the top of the
 * most-visited screen in the app sixty times a second to animate a gradient.
 */
export function BrandWordmark({ className = "" }: { className?: string }) {
  /*
   * Keep the name on one line. Phone typography steps independently of the
   * header's layout: the home header puts its counters on a separate row
   * below sm so they cannot overlap this lockup at narrow widths.
   */
  return (
    <span className={`inline-flex flex-col items-start leading-none ${className}`}>
      <span className="flex items-center gap-1.5">
        <IlmHuntStar className="h-2 w-2 shrink-0 text-primary drop-shadow-[0_0_6px_currentColor] animate-star-twinkle motion-reduce:animate-none" />
        {/* Both ends of the gradient are gold and only the middle is cream,
            so every frame of the sweep is a lit wordmark. The first version
            ran dark gold → cream → dark gold, and at rest that put `#c9962f`
            under "ILM" and the highlight under "Hunt": half the name looked
            switched off. A masthead may shimmer; it may not appear to have
            two brightnesses.

            `bg-[length:220%_100%]` is what makes the sheen possible: the
            gradient is painted more than twice the width of the text, so there
            is somewhere for it to slide to. At 100% it would have no travel
            and the animation would render as nothing at all. */}
        <span className="font-headline whitespace-nowrap text-[17px] min-[360px]:text-[19px] min-[400px]:text-[21px] font-semibold leading-none tracking-[0.01em] bg-gradient-to-r from-[#dcae45] via-[#fff6dc] to-[#dcae45] bg-[length:220%_100%] bg-clip-text text-transparent drop-shadow-[0_1px_8px_rgba(240,205,109,0.22)] animate-wordmark-sheen motion-reduce:animate-none">
          ILM Hunt
        </span>
      </span>
      {/* Decoration, and told so: a screen reader announcing "horizontal rule"
          after the app's name is noise. */}
      <span
        aria-hidden="true"
        className="mt-[5px] h-px w-full bg-gradient-to-r from-primary/55 via-primary/20 to-transparent"
      />
    </span>
  )
}
