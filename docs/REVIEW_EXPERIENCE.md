# Review experience — 1 October 2026

Based on merged PR #102 (`87b311c72326c68006d049488fa4a5baa4c86f92`).
This change stays unmerged until the owner says to merge.

## Player experience

- Serve the entire due batch, up to 15 questions, oldest due first with a stable
  question-ID tie break. Correct streaks and mistakes cannot reorder it.
- Untimed review with unlimited attempts and held explanations. No hearts,
  countdown, lifelines or stale-batch replay. Untimed Practice also stops
  awarding the previously hidden pace bonus; timed modes retain theirs.
- Returning from a run reloads the queue. A refresh failure offers retry and
  never presents a false "caught up" state. Overlapping requests are blocked;
  responses arriving after unmount are ignored.
- Counts and questions both exclude unpublished content. Reuse the quiz's
  translation overlay, with English as default and per-question fallback.
  New interface text covers all six locales; upcoming dates are localized.
- Keep the existing SM-2 scheduler's UTC dates. No migration, function deployment,
  permission change, bank upload or production data write is required.

## Verification

The review test executes the actual server actions and localisation helper
through the installed Supabase client with a simulated HTTP boundary. It checks
owner/publication filters, all 15 questions, deterministic ordering, batch limits,
English and translation fallbacks, fresh counts after rescheduling, and query or
authentication errors. No answer key, explanation or citation is selected.

Engine checks cover all 15 questions after correct streaks and after 15 misses,
without mutating the question pool. Existing engine and clock checks also pass.
The production build, TypeScript, six-locale copy/placeholder checks, narration,
subject discovery, middleware, multiplayer and edge-authorization checks pass.
The build retains the existing Genkit/Handlebars/OpenTelemetry dependency warnings.

Local browser checks used copies of the final components, published Quran text
and explicitly labelled simulated queue/grading services. They verified:

- A 600-second jump cannot time out review; explanations wait for Continue.
- Exiting after one answer reloads a 14-due/1-scheduled queue.
- A failed refresh shows retry; a double click starts only one held request.
- All 15 simulated mistakes reach completion, with 15 answers and zero pace
  points. There is no Play Again button. Back to review reloads 0 due and 15
  scheduled, with a localized next date.
- Three fast simulated correct answers also earn zero pace points.
- English and Arabic entry screens fit a 360-pixel viewport without horizontal
  overflow. Arabic uses right-to-left layout. The browser was restored to English
  and its normal viewport.

Screenshots are saved in the workspace's `outputs/review-experience` folder;
the test toolbar is visible to distinguish simulations from production. Temporary
test routes were removed before release checks. No live attempts or coins changed.

The live signed-in review page was checked read-only in English. The live
schedule currently has no rows, so a due-session production flow cannot be
claimed from that empty screen. Read-only SQL confirmed the joined published
schedule query. Full live two-account multiplayer remains unverified because
the owner has one account. AI quota work remains last.
