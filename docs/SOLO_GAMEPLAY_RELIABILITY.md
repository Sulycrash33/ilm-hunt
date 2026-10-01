# Solo gameplay reliability — PR #102

Solo runs keep their initial rank anchor until replay. Loading the profile
before choosing that anchor prevents a rank update from rebuilding a run in
progress. Profile refresh failures release loading and retain the last loaded
balance and rank; a later refresh can recover.

Question and Speed Round clocks read elapsed wall time from deadlines. Delayed
callbacks catch up, retries do not refund thinking time, and Time Boost extends
the original question deadline by exactly 15 seconds. This is a client UX
correction; grading and credited XP remain server controlled.

Answer and lifeline requests acquire immediate locks before awaiting the
server. Failed requests release controls. Question changes, completed rounds,
replay and unmount invalidate old responses. The second 50/50 request checks its
epoch and deadlines too. Pending lifelines disable conflicting answer choices.
A server spend that completes after expiry may still have been charged; these
guards do not promise a refund or undo a server transaction.

Speed Round waits for an answer submitted before expiry to finish grading. It
applies that accepted outcome once before producing the final summary, whether
expiry interrupts grading or the reveal. Timer accessibility labels use all
six supported languages.

## Verification

Local browser tests used the real HuntView source with simulated profile and
server actions. A test-only toolbar advanced the clock and released delayed
requests. No live coins, accounts or attempts were used. The temporary route
was removed; the reusable fixture remains outside the repository.

- Double-clicking an answer submitted one request. A profile jump to 10,000 XP
  preserved the selected answer, and Continue advanced to question 2.
- Time Boost submitted one spend on double-click. Pure clock assertions verify
  the exact 15-second extension and retry/background catch-up behavior.
- A simulated elapsed-time jump expired one question, took one life and opened
  the next question with its fresh timer.
- Failed grading and thrown lifeline requests released controls for a retry.
  Retried 50/50 removed exactly two wrong options.
- Speed Round expiry during pending grading and during the reveal produced one
  correct answer and 10 earned XP, with one accepted answer in the run record.
  Replay returned to question 1 with a fresh run clock and enabled controls.
- A late Time Boost response after question expiry left question 2 unchanged.
  Answers and lifelines returning after exit left the newly mounted run intact.
- Delayed 50/50 choices released after expiry and replay did not eliminate any
  option in the new run.
- The actual profile hook was evaluated with controlled React/client mocks:
  authentication failures, thrown query failures and returned query errors
  released loading; refresh failures retained the loaded profile; retry and
  sign-out succeeded.
- Arabic at a 360-pixel viewport displayed RTL gameplay, translated timer
  labels and usable answers/lifelines. Main content had equal client and scroll
  widths, with no horizontal overflow.
- Engine, clock, six-language translation, middleware, narration, subject
  discovery, multiplayer and edge authorization checks passed.
- Standalone TypeScript and diff whitespace checks passed after the build.
- Production build completed, with existing Genkit/Handlebars/OpenTelemetry
  warnings and two caught network-denied fetches during prerendering. No sample
  test route appears in its output. The preview deployment supplies the remote
  build check.

No database migration, Edge Function deployment or production gameplay test is
part of this PR. Existing live multiplayer two-account testing is a separate
outstanding item. AI quota work remains last in the owner's priority order.
