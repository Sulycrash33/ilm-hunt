# Historical break checkpoint — 1 October 2026

This records the earlier break. PR #102 has since been squash-merged on the
owner's instruction as `87b311c72326c68006d049488fa4a5baa4c86f92`, with a
successful Ilm Hunt production deployment. See `SOLO_GAMEPLAY_RELIABILITY.md`
for its changes and validation. The next review-session improvements are
described in `REVIEW_EXPERIENCE.md` and await the owner's merge instruction.

## Live release

PR #101 is squash-merged as `4a4b895849e8b5163debcffe0716e737b952d448`.
Vercel reports success for the Ilm Hunt production deployment and the signed-in
multiplayer page opens on `www.ilmhunt.app`. PR #100's database changes were
already approved, deployed and verified. A full interactive two-account live
match remains unverified; the owner has one account.

## Saved work in progress

Branch: `claude/ilm-hunt-solo-reliability`, based on merged PR #101.

- Solo timers read deadlines rather than counting browser callbacks. Failed
  grading does not refund thinking time; Time Boost extends the original
  question deadline by exactly 15 seconds.
- Freeze the rank anchor for a run, after profile loading, so rank-ups no longer
  rebuild the ladder mid-run. Replay picks the new rank.
- Immediate answer/lifeline locks, request failure cleanup and guards against
  applying responses to a later question. Pending lifelines disable answers.
- Preserve the last committed speed-round answer in the final summary, including
  responses arriving at expiry. This part still needs interactive verification.
- Localized timer labels in six languages; profile refresh errors release loading.
- Added `test:clock` and pure deadline/boost/final-answer assertions.

## Checks completed

- Final source TypeScript, clock assertions and diff whitespace checks passed.
- Local browser with copied real HuntView and simulated profile/actions: a
  double-click submitted one answer, a profile jump to 10,000 XP preserved the
  selected answer and Continue moved to question 2 rather than resetting.
- Time Boost double-click sent one spend request. A simulated 60-second jump
  expired one question, cost one life and opened the next with its fresh timer.
- Practice grading failure released choices for a successful retry. A thrown
  lifeline request released controls; retry eliminated exactly two choices.
- Temporary simulation was removed from the app. Its source is saved outside the
  repository in `../tooling/solo-review-fixture`; the local dev server is stopped.
  No live coins, accounts or answer attempts were used for these tests.

## Original resume checklist

1. Test Speed Round expiry during pending grading and during the answer reveal,
   ensuring one accepted answer is counted once, then test replay reset.
2. Test a lifeline response after question expiry and exit/unmount, profile-load
   failure, and Arabic/mobile layouts. Review the asynchronous request guards.
3. Run the production build and full relevant regressions, including translations,
   engine, middleware, narration, discovery, multiplayer and edge authorization.
4. Update the draft description with actual results and verify its Vercel preview.
   The owner decides when to merge. No new database migration or edge deployment
   is needed for this work. AI quota work remains last.
