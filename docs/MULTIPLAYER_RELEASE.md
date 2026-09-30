# Invitations and reliable multiplayer rounds

This release follows the player-experience update in PR #99. Gameplay/social
features and performance/bugs are the priority; AI quota work remains last.

## Player experience

- Copy a room invitation using the current domain, including the custom domain.
  Invitations prefill the join code and preserve it across login/signup links.
  They do not join rooms automatically or accept arbitrary redirect URLs.
- Refreshing in the same browser tab restores the saved room after checking
  membership against the database. The original timer and submitted choice
  are restored. The saved room is scoped to the signed-in user and removed
  only after a successful leave. Disabled browser storage degrades gracefully.
- Room snapshots reflect host transfers and restarts. Connection feedback,
  retry, returning to a visible tab, and reconnecting refresh missed updates.
- All new labels are present in English, Hausa, French, Arabic, Malay and Indonesian.

## Reliability and performance

The previous start routine could assign nonconsecutive question numbers,
left rooms in `starting`, and the app never completed that transition.
Question advancement used two separate writes, including a question-timer
update for which the host had no update policy. This release uses constrained
database functions so room transitions and timers commit together.

Any joined player may complete an elapsed countdown, so losing the host's
connection does not strand the start. Only the host may advance. The expected
question number makes duplicate advance requests harmless. Seeding checks
the available bank and rolls back if it cannot supply the requested match.

Grading checks room membership, question ownership, active question and expiry.
Speed points use server time. Retried answers return the existing result without
awarding twice. Clients can change readiness, but cannot write scores or insert
their own graded answers. Each player can read only their own submitted answers.
Questions still come exclusively from the safe view; answer keys are not returned.

The three independent room reads now run concurrently. Realtime event bursts
are batched into one snapshot, with a trailing refresh for events received
while a request is running. Refreshes never overlap, and disposed subscriptions
ignore late responses. This improves bursts; no production latency benchmark
is claimed. An isolated single player event now reads a complete snapshot.

## Validation

- Production build and TypeScript check passed. Existing Genkit/Handlebars and
  OpenTelemetry build warnings remain unchanged.
- Engine, i18n, middleware, narration, subject-discovery and edge-authorization
  regressions passed.
- `npm run test:multiplayer`: invitation validation, fixed server deadline,
  burst coalescing, trailing refresh, cancellation, retry and server-action auth.
- `npm run test:multiplayer-db`: actual migration executed in isolated PGlite
  PostgreSQL against the original multiplayer table constraints and identity
  trigger. Covers sequence, countdown, nonmember/guest/anonymous rejection,
  repeated start/answer/advance, server-time scoring, inactive/expired choices,
  readiness permission, denied direct score/answer writes, answer privacy,
  missing-question rollback, insufficient-bank rollback and match completion.
- Browser checks used real components with sample players: desktop and 360px
  mobile lobby, actual clipboard URL, Arabic RTL with no horizontal overflow,
  restored selected answer and an 18-second remainder on a 30-second question.
  Signed-out invitation redirected to login retaining the code.
- Temporary preview route removed before the build. Screenshots are stored
  locally, outside the repository. No production match or test account was created.

## Deployment order

1. Apply `20260930160000_reliable_multiplayer_rounds.sql` to the Ilm Hunt
   Supabase project, `ziblpvwiqzpjnkqjwodl`, before merging the app update.
   It adds begin/advance RPCs and replaces start/grading in place. It changes
   neither the content bank nor learning XP/ranks, and needs no edge deployment.
2. Verify function privileges and test a complete two-account match, including
   refresh, host departure, repeated clicks, restart and finishing.
3. Merge the app pull request and verify Vercel deployment for `ilm-hunt` and
   `www.ilmhunt.app`. Other Vercel projects are outside this release.

The migration has not been applied to production. Live verification remains
pending. Email-confirmation redirects and sending an invitation to another
person were not exercised; the tested auth flow covers login/signup navigation.
Keep the app PR unmerged until the database step is complete. If a rollout
needs to be reversed, first stop new matches and preserve the deployed function
definitions/grants; then coordinate the app and database rollback together.
