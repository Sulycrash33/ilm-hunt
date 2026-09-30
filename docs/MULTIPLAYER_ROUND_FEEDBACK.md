# Multiplayer round feedback

This update follows merged PR #100. It needs no database migration, edge-function
deployment, dependency change or AI request. AI quota work remains last.

## Player experience

- Answer feedback announces checking, correct/incorrect and timeout states. A
  successful answer displays the speed points returned by server grading.
- Guests see a waiting-for-host message after answering or timing out. Players
  can leave during the countdown or active quiz through the existing leave flow.
- Focus the question card or a choice and press 1-4 to answer. Keyboard shortcuts
  stay inside the question area; selected choices expose their pressed state.
- Equal scores share competition ranks (1, 1, 3). Results show shared first place
  rather than choosing a winner by row order, including an all-zero match.
- Positive-score leaders receive the existing finite celebration. Correct/wrong
  sound cues respect the player's opt-in setting and do not replay on restoration.
  Calm effects and reduced motion continue to apply.
- Timer corrections for the same question preserve the selected answer and lock.
  The timer stops ticking at zero; a new question resets answer feedback.
- New copy covers all six languages. Results accommodate long player names and
  wrapped mobile actions, including Arabic RTL.

## Validation

- Production build, TypeScript and engine, translations, middleware, narration, discovery,
  multiplayer and edge-authorization checks passed.
- Existing Genkit/Handlebars and OpenTelemetry build warnings remain.
- Multiplayer assertions cover tied ranks, zero-score ties, empty standings and
  input immutability, alongside the existing invitation and refresh checks.
- Two local browser tabs exercised the actual multiplayer page and components
  with a temporary auth/service simulation: joining, readiness, countdown,
  keyboard/tapped answers, refresh restoration, expired questions, host departure,
  five-question completion and replay. Separate scenarios covered tied results,
  all-zero scores, calm effects and 50-character names at 360px in Arabic RTL.
  The document width was 354px within the 360px viewport.
- The simulation was removed before the production build and is not part of the
  app or repository. Screenshots remain local and use sample players only.

## Release boundary

PR #100 is merged and deployed. Its signed-in production room creation, invitation
copying, refresh and leave smoke checks passed, and its database lifecycle checks
ran against deployed routines inside rollback-only transactions.

The owner has one account, so a complete interactive match with two independent
live authenticated sessions remains unverified. Local UI simulation does not
substitute for that production check. This update is submitted as a draft PR for
the owner's merge decision; it does not alter scoring rules or host advance policy.
