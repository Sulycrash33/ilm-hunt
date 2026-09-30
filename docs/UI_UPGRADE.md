# Interface upgrade

The welcome, subject discovery, mode selection and quiz feedback now share a clearer visual hierarchy. Shared cards, buttons, focus treatment and navigation carry the update to the rest of the app.

## Player changes

- Responsive welcome with clear entry actions and warmer intro copy.
- Search subjects by name or description, ignoring accents and diacritics. Filter started/unstarted subjects and optionally pick a playable subject from the current results.
- One navigation component across desktop and mobile, with an accessible More sheet exposing modes, multiplayer, community, achievements, rewards and review.
- A device-local Reduce effects preference, combined with the operating system motion preference. Existing confetti, particles, count animations and achievement effects honor both.
- Selected-answer pending feedback, live grading status, translated difficulty names, RTL answer alignment and a consistent question surface.
- Encouraging completion/loss text, mistake-only review and optional sharing/copying of a score summary.
- Removed unsupported advertised mode reward multipliers and changed the tournament label to the actual multiplayer feature.

## Product rules retained

The question-bank size stays private. Displayed counts describe the player's record or the subjects, never the bank total. Server grading and rewards, levels-cleared home progress, once-daily challenge rules and the absence of pause in timed modes are preserved.

## Validation

Passed: production build, TypeScript, engine, narration, middleware, i18n and subject-discovery checks. Run `npm run test:discovery` for accent, Arabic diacritic, multiword, availability and filter cases.

Browser checks: public welcome/language/intro; local real components with labelled fixture data for subject filtering, menu focus/Escape, persisted motion setting, answer states, review filters, clipboard text and Arabic direction. Narrow widths 320/360 and desktop 1280 were checked without horizontal overflow in the inspected screens. The temporary fixture route was removed before the build.

Native system sharing was invoked but not verified to completion; explicit clipboard copying passed. Live authenticated screens and transactions require an authenticated browser. No production database changes are included.

The build retains existing Genkit/OpenTelemetry/Handlebars dependency warnings.
