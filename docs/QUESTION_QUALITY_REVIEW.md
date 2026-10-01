# Question topics and writing review — 1 October 2026

Based on merged PR #103 (`6135c74f80830f8c9a46fe53f5c6aff02404a8c1`).
This change is prepared for an owner-reviewed draft PR.

## Player experience

Questions now carry their actual database category through the shared quiz
service, due review queue, question card and round review. This makes the
subject visible in mixed-topic modes without using the mode title as a guessed
category. The existing translated category label is reused in all six locales;
database category names remain consistent with the subject grid. English is
the default. Missing category metadata hides the label and keeps the question.

The existing separate browsable-subject and arena banks remain separate.
Multiplayer room payloads are outside this change. Neither the answer key nor
an explanation or citation is added to pre-answer player reads.

## Editor experience

The question console can run an on-demand, read-only scan of published text
and choices. It checks unnamed tier/category references, empty text, too few
or blank choices, repeated choices and normalized repeated wording across
scan pages. An administrator can filter flags and open a matching question in
the existing editor, with focus on its question field. Existing drafts disable
the flag shortcut to avoid replacing an edit in progress.

Flags are advisory. They neither verify factual accuracy nor grant scholar
approval. The report shows when it was checked; administrators should scan
again after edits. Query failures offer retry rather than presenting a clean
report. Immediate request locks prevent duplicate scans and late responses
after unmount are ignored. Keyset pages are limited to 1,000 rows; a scan capped
at 50,000 rows explicitly reports itself as partial. Counts stay in admin UI.

## Findings and validation

Read-only checks against the configured Ilm Hunt Supabase project confirmed
English base content, category relationships and matching category pool labels.
The actual joined REST query and its 1,000-row paging were exercised against
published content. Some wording references unnamed tiers or repeats across
topics. Those are candidates for editorial review, not confirmed factual
errors. The detailed audit is saved outside the repository and is not uploaded.
Published text, answers and review statuses were not changed.

`test:quality` exercises the real writing helper and server action through the
installed Supabase client with simulated HTTP responses: cross-page duplicates,
publication filters, admin authorization, paging, failures and retry. Review
tests cover topic preservation through English/translation fallback and missing
metadata. Engine, clock, six-locale copy, narration, discovery, middleware,
multiplayer and edge-authorization checks pass. Production build and TypeScript
pass; existing Genkit/Handlebars/OpenTelemetry dependency warnings remain.

Browser checks used copies of final components with published wording and
visibly labelled simulated services. They verified category labels during play
and round review, scan failure/retry, a double-click producing one held request,
flag filters, and the correct editor opening with keyboard focus. English and
Arabic player screens and the English admin panel fit a 360-pixel viewport
without horizontal overflow. English and the normal viewport were restored.
Temporary routes were removed before the production build. Screenshots are
saved outside the repository in `outputs/question-quality`.

No migration, permission change, question-bank upload, edge-function deployment
or production data write is required. Full live two-account multiplayer remains
unverified because the owner has one account. AI quota work remains last.
