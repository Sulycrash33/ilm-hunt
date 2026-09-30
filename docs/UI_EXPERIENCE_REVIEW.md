# Ilm Hunt experience update · 30 September 2026

This update completes the remaining player screens after PR #98. The existing navy, gold and mint identity, rank emblems, avatars and achievement art remain the basis of the interface. New icons use the existing Lucide library.

## Journey review and changes

1. **Profile — fixed.** A responsive page header replaces the crowded title row. Rank progress has a named progress bar; dates follow the selected language. Empty learning and activity panels offer a next step. Settings include a persistent Reduce effects switch alongside sound, vibration and reminders. Profile identity falls back to the learner label rather than an email address.
2. **Shop — fixed.** Search filters translated item names and descriptions. Cards distinguish owned quantities, unaffordable items, unavailable items and pending purchases. Purchases require a named confirmation dialog and use the existing server item-ID action; balances update only after success. A request lock prevents duplicate submissions.
3. **Rewards — fixed.** Shared header and balance styling, readable daily reward tiles on phones, a centered gift panel and coordinated action locks. Pending state lasts for the whole async operation on React 18. Copy describes a free coin gift; the fixed server reward and cooldown remain authoritative.
4. **Community — fixed.** Readable scrolling tabs, useful empty panels and clear form labels. Create, join, forum and mentoring requests keep controls pending, release locks after failures and show errors. Forum and mentorship initial load failures have retry controls. Public discussions and existing moderation rules remain unchanged.
5. **Achievements and leaderboard — fixed.** Responsive headers, selected-tab semantics and compact phone layouts. The daily challenge button now goes to `/play/daily`. Empty weekly rankings offer a learning action. Long player names fit the leaderboard and multiplayer podium.
6. **Multiplayer — fixed.** Join code input is named and sanitized; joining shows progress and failure feedback. Lobby codes can be copied with a status message. Repeated room events no longer reset an active answer, and question updates use the latest room state. Failed answer submissions unlock choices for retry, with an elapsed-time deadline rather than a paused clock. Late answers cannot overwrite feedback for the next question. Start, Ready, Next and Play Again are locked during requests; restarting is offered only to the host. Countdown intervals are cleaned up. Match scores are labeled as score, not learning XP.
7. **Shared controls and finishing — fixed.** Dialogs use the existing Radix focus trap, Escape handling, opener focus restoration, logical close-button placement and a phone-width gutter. Page headers, empty states, buttons, inputs and progress bars share accessible sizing and semantics. Reduced effects apply to the refreshed screens, home entrances and reward reveal. Lifelines use recognizable library icons with pending indicators. Authentication back buttons follow Arabic direction; admin navigation wraps on narrow screens.

## Verification

- TypeScript and optimized Next.js production build.
- Existing hunt-engine, six-language copy/placeholder, middleware, narration, subject discovery and edge authorization regression suites.
- Browser review of real components in a temporary public introductory preview with visibly labeled sample data. The route was removed before the build and is excluded from this PR. No authentication rules were changed.
- Phone checks at 320 and 360 pixels, desktop checks at 1280 pixels, and Arabic RTL checks. No document-level horizontal overflow in the inspected shop, profile, community form, leaderboard or match results. Dialog width at 320 pixels was 288 pixels with its contents fitting inside.
- Shop search/no-result state, disabled inventory states, confirmation and Escape cancellation; opener focus restoration verified in Arabic.
- Effects switch checked and unchecked; named rank progress verified with current/max values.
- Two simulated multiplayer submission refusals both allowed another choice. Room-code copying announced success. Guest results had Leave Room and no host restart control. Daily challenge link verified as `/play/daily`.

## Scope limits

Browser fixtures verified presentation and interaction without spending production coins, claiming gifts, posting content or playing a live two-account match. Full production transactions and a two-player realtime match were not repeated in this UI review. Admin receives shared control improvements, not a new reporting system. Existing Genkit/Handlebars/OpenTelemetry bundler warnings remain. Push reminder setup and provider quota are operational topics outside this interface update.

Local before/after screenshots and the detailed audit are retained with the task under `outputs/complete-review`; they are not published to this public repository. The owner will merge after review.
