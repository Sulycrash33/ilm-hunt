# Security and player-flow rollout — 30 September 2026

This change closes the room-question view's RLS bypass, restricts internal
translation helpers, checks callers before privileged edge work, and clears
lifeline spends, earned chests and mode runs when a player resets progress.
It preserves identity/settings and shared multiplayer history.

The arena importer reads `content-banks/arena/bank.json` from private Supabase
Storage. It accepts a trusted service credential or a verified admin session.
The translation and reminder workers accept trusted service credentials only;
the hadith tools also accept verified admins. Legacy service-role keys and the
runtime's named modern secret keys are supported. Include `_shared/privileged-request.ts`
in deployments. A retained legacy key that differs from the runtime key is
verified through Supabase Auth's service-only admin endpoint. Forged tokens,
ordinary user credentials and Auth verification outages fail closed. Auth
user data is discarded and never logged or returned.
Keep gateway JWT verification enabled for
the current legacy-key cron setup; modern secret-key requests need the gateway
configuration documented by Supabase, with the in-function check still enabled.

The translation dashboard shows the latest retained batch's actual output and
rate limits. Its target counts only the category bank, matching the queue.
The live batch samples on this date wrote zero of twelve claimed jobs and
reported twelve rate-limited requests. Gemini quota/billing requires an account
owner action; the application cannot raise an external account's allowance.
Missing arena translations use the same per-question English fallback as the
category path. The game's share metadata now uses `https://ilmhunt.app`.

## Verification and release order

1. Run typecheck, production build, engine, i18n, middleware, narration and
   `npm run test:edge-auth`. The edge check executes all five real handlers with
   fake services and asserts that rejected requests perform no privileged work.
2. Rehearse the four `20260930` migrations and `supabase/smoke/security-and-reset.sql`
   in one transaction ending in ROLLBACK. The smoke file also begins its own
   transaction so running it alone cannot leave QA users behind. It checks
   anonymous denial, room isolation, answer-key denial, admin denial, repeated
   reset, other-player isolation and the content-trigger enqueue path.
3. After explicit production approval, apply the migrations in filename order.
   Upload the arena bank as
   `content-banks/arena/bank.json` using a trusted backend credential. The bucket
   must remain private, with no anonymous or authenticated object-read policy.
   Verify the stored object before deploying the updated importer.
4. Deploy the five edge functions with their shared dependency. Verify denied
   requests, an authorized importer dry run, and one normal cron response. Do
   not call the reminder worker merely to test it: it sends real notifications.
5. Merge/deploy the app changes and inspect a signed-in player session: daily
   challenge, repeated reward claims, one category level, review, rewards,
   reset, and a two-player battle. A compiled route or login redirect does not
   prove that signed-in gameplay works.
6. Make the GitHub repository private using the owner's GitHub account. Public
   answer data remains in Git history; removing one working-tree file does not
   close that exposure. The private Storage importer removes the need to keep
   GitHub public for imports. Verify the GitHub app/Vercel integration still has
   repository access after the visibility change.

The Vercel connector currently exposes only the separate `Clashfree` project.
Both the Vercel game URL and `ilmhunt.app` serve Ilm Hunt, but the correct Vercel
account/project still needs to be connected to verify this PR's deployment.

## Current validation limits

Typecheck, production build, engine, i18n, middleware, narration and edge
authorization checks pass. The local production server also serves the public
entry routes and protects the game/admin routes when signed out.

The owner explicitly approved the rehearsal and production rollout. The four
migrations are applied and all five updated functions are active with gateway
JWT verification enabled. The transaction rehearsal and post-deployment smoke
both passed; zero QA accounts remain. Public anon-key calls to all five
functions returned 401. The private bank was copied from the current database
to preserve corrections: 5,246 questions. The authorized importer dry run
returned HTTP 200, 5,246 already present, zero to insert and zero skipped.
The scheduled translation batch after deployment returned HTTP 200, claimed
12, wrote zero and released all 12 after rate limits.

PR #97 remains a draft and is unmerged. Its Vercel preview check reports a
failure; the connected build-log tool is unavailable, so its cause has not
been established. No signed-in browser journey has been verified in this
session. Gemini quota, repository visibility and the correct Vercel connection
remain owner actions.
