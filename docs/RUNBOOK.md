# Question bank runbook

**If you are a fresh session and the instruction was "continue on this project" — this is
the file. Read it first, then act. You do not need to ask what to do next; the database
tells you.**

Written 2026-08-20. The owner has delegated the question bank. Lead it: make the routine
calls yourself, and only stop for him where this file says to stop.

## Where everything is

| | |
|---|---|
| repo | `Sulycrash33/ilm-hunt`, default branch `main` |
| Supabase project | **`ziblpvwiqzpjnkqjwodl`** (name: ilm-hunt) — reached with the `mcp__Supabase__*` tools |
| what to write | `docs/CATEGORY_TIER_MAPS.md` — 29 categories, 261 tier definitions |
| where text comes from | `docs/SOURCES.md` |
| standing context | `docs/HANDOFF.md` |

**There is no `.env.local` in a fresh clone**, so Node scripts cannot reach the database.
The Supabase MCP tools are the execution path. Do not waste a turn trying to build a
`psql` connection.

## State lives in the database, not in a file

Do not keep a progress file — it goes stale and then lies. **Ask the database where you
are.** `scripts/question-bank/status.sql` answers it in one query; run it at the start of
every session:

```
mcp__Supabase__execute_sql(project_id="ziblpvwiqzpjnkqjwodl",
                           query=<contents of scripts/question-bank/status.sql>)
```

It returns every category with how many of its 180 questions exist and which tiers are
short. **The first category showing fewer than 180 is the one you are working on.** That is
the whole of the resume logic.

## The invariants

These do not change and are not yours to relitigate. They came from the owner.

1. **Original questions only.** Never lift or rephrase an existing question set. `opentdb`
   and `the-trivia-api` are live and prohibited; so is any quiz app's bank.
2. **Sunni is the hard condition.** Where the four schools agree, `madhab_tag = 'agreed'`.
   Where they differ, name the school. Never present one school's view as consensus.
3. **Contemporary fatwa is not ijma'.** Keep it distinguishable from classical consensus.
4. **English only** (`language = 'en'`). Translation is a separate later phase.
5. **Never pad to reach 20.** If a bucket cannot sustain twenty distinct questions, report
   it short with its number. The owner would rather hear "Tajwid tier 9 supports 12" than
   receive eight questions nobody can defend.
6. **Difficulty is not obscurity.** Every question must match its line in
   `docs/CATEGORY_TIER_MAPS.md`. A tier-8 question that is a tier-3 fact in harder
   vocabulary gets rewritten, not relabelled.
7. **A weak narration may never ground a ruling question** — only a question about the
   narration itself.
8. Everything written is `review_status = 'ai_drafted'`. Nothing is `published` without a
   scholar. Set `source_type = 'ai_drafted'` (a CHECK constraint allows only 'human' or 'ai_drafted') and `tier_is_estimated = false`.
9. **Vary where the answer sits.** The app serves `choices` in stored order — nothing
   shuffles them for the player. Aim for a roughly even spread across indexes 0-3 within a
   category, and let `validate.sql`'s `answer_index_skew` check confirm it before you call
   the category done. This one bit me: the first five categories were authored straight off
   the insert template, whose example puts the answer at index 1, and they came out ~90% at
   index 1 — a player who always pressed the second button would have scored about 89%
   without knowing a thing. Fixed across all 920 rows by a deterministic rotation keyed on
   `hashtext(id::text) % 4`, rotating `choices` and `choice_meta` together and recomputing
   the index. Safe only because no choice in the bank refers to another by position; check
   that again before ever repeating it.

## The loop — one category at a time

Author **one category completely** — all 9 tiers, all 180 questions — then stop and report
before starting the next. Within a category, **write the full tier spread together**: tier 1
and tier 9 in the same pass, so the gradient is real.

**Step 1 — pick up where the DB says.** Run `status.sql`. Take the first incomplete
category, in the `sort_order` given below.

**Step 2 — reread that category's nine tier lines** in `docs/CATEGORY_TIER_MAPS.md`. Write
to those lines, not to the generic rubric.

**Step 3 — gather source text first, then write.** Pull from the sources in
`docs/SOURCES.md`. For hadith, use the fawazahmed0 mirror and pull whole editions once
rather than per-hadith. Every question needs a real `citation_reference` — this is the
weakest part of what existed before, and the reason web access was opened.

**Step 4 — insert.** Use `scripts/question-bank/insert-template.sql` as the shape. Insert in
batches of one tier (20 rows) so a failure costs one tier, not the category.

**Step 5 — validate. Every category, not at the end.** Run
`scripts/question-bank/validate.sql` with the category slug. It checks all four things the
owner asked to be protected against:

- every tier reads exactly 20;
- no two questions in the category exceed 0.5 trigram similarity;
- no correct answer appears more than twice;
- no question stem ("Who was the first", "How many", "In which year") appears more than four
  times.

**Do not report a category done until the validator comes back clean.** Fix and re-run.

**Step 6 — report to the owner**: the tier counts, the validator output, and any bucket you
had to report short. **Then start the next category without waiting.**

> **Standing instruction, 2026-08-20, from the owner: do not stop for permission between
> tiers or between categories.** This supersedes the handoff's "stop and show him before
> starting the next". Report what you finished and keep going. The four items under *Stop and
> ask the owner only for these* below are still the only reasons to halt.

## If you run out of context mid-category

Nothing is lost. Rows already inserted are in the database, and `status.sql` will show the
partial tier counts. A new session reads this file, runs `status.sql`, and continues from
the first short tier. **Do not delete partial work to start a category cleanly** — fill the
gap instead.

## Two things that are NOT done yet

**1. The wipe and the category rebuild.** Verified 2026-08-20: `attempts`,
`quiz_room_questions` and `user_question_schedule` are all **0 rows**, so the wipe is safe —
**but re-verify immediately before running it**, because the owner may have been testing
since. `scripts/question-bank/00-wipe-and-reseed-categories.sql` does both, and it is
destructive: it deletes all 1,169 existing questions and replaces the 25 existing categories
with the 29 below.

The existing categories are **not** a subset of the new list. 17 are reused, 12 are new, and
8 retire because their content is absorbed elsewhere:

| retired slug | absorbed into |
|---|---|
| `salah`, `zakat_charity`, `hajj_umrah`, `ramadan_fasting` | `five_pillars` |
| `angels_unseen` | `aqeedah` |
| `muslim_scholars`, `islam_world` | `islamic_history` |
| `islamic_calendar` | `five_pillars` and `sacred_places` |

**2. The da'if per-choice migration.** `choices` is `jsonb` holding a plain array of strings,
and `choices: string[]` is typed in six places across the app including multiplayer's
`LiveQuiz`. **Do not reshape `choices` into objects — it breaks the UI.** Add a nullable
`choice_meta jsonb` column instead, aligned by index, holding `{grading, reference}` per
choice; only da'if questions populate it, and every existing reader keeps working.
`scripts/question-bank/01-choice-meta-migration.sql` is written but **not applied**. Apply it
before authoring Hadith Sciences tier 5, which is where the format lives.

## The 29 categories, in authoring order

Author in this order. `sort_order` matches.

| # | slug | name | status |
|---|---|---|---|
| 1 | `aqeedah` | Creed (Aqeedah) | reused |
| 2 | `allah_names` | Allah's Names & Attributes | new |
| 3 | `five_pillars` | Five Pillars | reused |
| 4 | `quran` | Holy Quran | reused |
| 5 | `prophetic_biography` | Prophetic Biography | reused |
| 6 | `hadith` | Hadith Sciences | reused |
| 7 | `tafsir` | Quran Commentary | new |
| 8 | `quran_sciences` | Preservation of the Qur'an | reused |
| 9 | `tajwid` | Tajwid | new |
| 10 | `arabic_language` | Arabic Language | reused |
| 11 | `usul_fiqh` | Usul al-Fiqh | new |
| 12 | `fiqh` | Islamic Law (Fiqh) | reused |
| 13 | `ethics` | Islamic Ethics (Akhlaq) | reused |
| 14 | `dua_dhikr` | Du'a & Dhikr | reused |
| 15 | `tazkiyah` | Sufism & Spirituality | reused |
| 16 | `akhirah` | Afterlife (Akhirah) | new |
| 17 | `companions` | Companions (Sahaba) | reused |
| 18 | `ahl_al_bayt` | Ahl al-Bayt | new |
| 19 | `stories_of_prophets` | Other Prophets | reused |
| 20 | `miracles_signs` | Miracles & Signs | new |
| 21 | `women_in_islam` | Women in Islam | new |
| 22 | `islamic_history` | Islamic History | reused |
| 23 | `sacred_places` | Sacred Geography | reused |
| 24 | `arts_culture` | Islamic Arts & Culture | new |
| 25 | `science_in_islam` | Science in Islam | new |
| 26 | `islamic_finance` | Islamic Finance | new |
| 27 | `family_life` | Marriage & Family Life | reused |
| 28 | `interfaith` | Interfaith Relations | new |
| 29 | `contemporary_issues` | Contemporary Issues | reused |

## Stop and ask the owner only for these

Everything else, decide yourself and tell him what you decided.

- **Before running the wipe** — it is destructive and irreversible.
- **A bucket that cannot sustain 20 questions** — report the number, do not pad.
- **Anything that would change the category list, the tier maps, or the invariants above.**
- **A question touching contested ground** you cannot resolve within the Sunni condition.

## Report honestly

Say plainly what was not done and why. The owner values that over polish, and has said so.
If a category came out weaker than the others, say which and why. If a citation could not be
verified against real source text, say so rather than shipping it quietly.

## Two failures the tooling now prevents

**A failed pre-flight used to still write its file.** `emit.check()` printed `PROBLEMS:` and
returned `False`, and every authoring script then called `emit.build()` regardless. Nothing
enforced the check — it worked only because I happened to re-run after reading the output. It
now raises `SystemExit(1)`, so a failed check can never produce output.

**Staging files must be namespaced per category.** They were named by tier (`t1.sql`…`t9.sql`),
which meant Hadith Sciences and Tajwid both wanted `t1.sql`. Worse, the cross-tier duplicate
loader globs `t*.sql`, so it silently fed one category's stems into another's check and produced
a page of phantom collisions. Staging files now live in `cat/<slug>/<tier>.sql` and the loader is
pointed at one category's directory. Write tier files under the category slug, never at the root.

## Things the schema will reject — learned the hard way

Checked against the live database while authoring Five Pillars. Each of these cost a failed
insert; none of them is guessable from the column list.

- **`source_type` is CHECK-constrained to `'human'` or `'ai_drafted'`.** Not `'ai'`.
- **`daily_challenges` references `categories` and blocks a category delete.** It also holds
  `question_ids` as a bare `uuid[]` with **no foreign key**, so wiping questions leaves it
  pointing at rows that no longer exist and the database will not warn you. It is
  regenerated daily; delete its rows as part of any wipe.
- **Six tables reference `categories`**, not the three the handoff names (those three
  reference *questions*). `mentor_questions`, `hunt_runs` and `forum_topics` are
  `ON DELETE SET NULL` and safe; `questions`, `daily_challenges` and `study_circles` block.
- **The stem cap is category-wide, not per tier.** Across all 180 questions only four may
  share an opening three words. `"What is the"` is exhausted almost immediately — plan
  varied openings from the first tier, because retrofitting them later means rewriting
  questions that were otherwise fine.
- **Budget your question *frames*, not just your facts.** This is the single biggest time
  sink in authoring. The near-duplicate check compares whole question strings, so four
  questions built on one frame — "Which classification applies to Surah X?", "How many verses
  does Surah Y have?", "Applied to an attribute, what does Z mean?" — flag against *each
  other* even though every fact is different. **Cap any one frame at two uses per category**
  and vary the verb as well as the subject. It costs nothing while drafting and is expensive
  to repair afterwards.
- **Trigram similarity ignores word order.** Two questions differing only in the arrangement
  of the same words score **1.000** — "What does naskh al-hukm duna al-tilawa describe?"
  against "What does naskh al-tilawa duna al-hukm describe?" were flagged as identical. Where
  a subject has paired terms that are mirror images of each other, ask about them in genuinely
  different shapes rather than swapping the order.
- **Categories with a dominant shared noun collide hardest.** In Holy Quran nearly every
  question contains "Quran" or "surah", so short questions sit above 0.5 similarity on the
  shared words alone. Write longer, more specific stems there, and prefer frames that name
  something distinctive ("Between al-Isra and Maryam, which surah stands?") over generic ones
  ("Which surah is eighteenth?").
- **Watch the answer cap while drafting too.** In a category about one subject the same
  answer recurs naturally — "Al-Fatihah", "Al-Baqarah", "Sahih", "Hanafi" — and three uses
  trips it. When an answer is about to repeat a third time, recast the question so it tests
  the fact from the other end.
- **Near-duplicate flags usually mean the questions are genuinely redundant.** Three
  questions asking the rak'ah count of three different prayers tripped it. The right fix was
  to replace two with different facts, not to reword them until the checker stopped
  complaining. Rewording to defeat the validator defeats the point of having it.

### Added while authoring Hadith Sciences

- **An insert can land twice, silently.** Three `execute_sql` batches each landed twice —
  tier 5 read **35 rows for 20 questions**. Nothing errored. Migration
  `unique_question_text_per_category` now puts a unique index on
  `(category_id, question_text)` so a repeated batch fails loudly instead. **Still check the
  tier count after every batch**; the index catches exact repeats, not a half-landed batch.
- **Check for near-duplicates across the whole category before inserting, not within a tier.**
  A per-tier pre-flight passed cleanly and the category-wide validator then flagged five
  near-duplicate pairs and three over-used stems — every one of them a *cross-tier* collision
  ("What does the grade munkar indicate?" in tier 3 against "What does the grade shadh
  indicate?" in the same tier; "Which statement about the five conditions is accurate?" in
  tier 4 against "Which statement about the six collections is accurate?" in tier 2). Load the
  category's existing stems and compare against them while drafting.
- **Authoring naturally puts the correct answer first every time.** Twenty questions written in
  a sitting will have all twenty answers at index 0, because that is the order you think in.
  The app serves choices in stored order — nothing shuffles them. Apply a deterministic
  rotation before emitting SQL (`emit.rebalance` in the scratchpad tooling) rather than
  hand-tuning positions, which turns into whack-a-mole against the skew check.
- **Do not parse SQL literals with a regex.** `'((?:[^']|'')*)'` is ambiguous on rows
  containing `''` and mis-aligns its capture groups, which will hand you a defect report about
  the wrong choices in the wrong rows. Write a real character scanner.
- **Corpus text needs a quality filter before it reaches a player.** The translations carry
  leading stray parentheses, OCR artifacts (`9saw`, `waived meaning`), mid-sentence
  truncations, and cross-reference fragments that are not standalone narrations. Filter on all
  of these, and reject any text ending in `(ﷺ)` — in this corpus that reliably marks a cut-off
  sentence. Beware over-filtering too: the Abu Dawud translation routinely omits a final full
  stop on complete sentences, so "no terminal punctuation" alone is not a defect.

### Added while authoring Quran Commentary

- **The pre-flight now computes the validator's own number.** It used to score stems by 4-gram
  Jaccard while `validate.sql` used pg_trgm, so pairs passed locally and failed in the database —
  three did, including the *same quotation* used as the subject of two questions in different
  tiers. `scripts/question-bank/trgm.py` is now a faithful port of pg_trgm `similarity()`, and
  `emit.check` uses it at the validator's threshold of 0.5.

  The algorithm, confirmed against `show_trgm()` on the live database: lower-case, split on every
  non-alphanumeric character, pad each word with **two leading spaces and one trailing**, take
  sliding windows of 3, collapse to a **set**, then `|A n B| / (|A| + |B| - |A n B|)`.

  Two details that matter for this project's text: Postgres treats **U+FDFA (ﷺ) as a word
  character** — it hashes the multibyte trigrams, which is why `show_trgm` prints them as hex —
  while **curly quotes and em dashes are separators**. Python's `str.isalnum()` agrees on all
  three, so the port needs no special-casing; `trgm.py`'s self-test pins this down. Verified
  end-to-end against all 16,110 pairs in one finished category: same count above threshold, same
  maximum, same sum.

  **Keep the threshold in `emit.check` in step with `validate.sql`.** Run the database check
  anyway when a category is done — it also covers tier counts, answer repeats, stem repeats and
  answer-position skew, which the pre-flight only partly duplicates.
- **Watch for one source item reused as the subject of two questions.** Not the same wording — the
  same *thing*. Ibn 'Abbas's "I am among those firmly grounded in its ta'wil" anchored a tier-5
  question and a tier-8 question. Keep a list of the specific narrations, quotations and incidents
  already used as subjects, not just the stems already written.
- **Mirror-image question pairs remain the most common self-inflicted flag.** "If X means A, then…"
  beside "If X means B, then…" is the same trap as the parallel constructions in Allah's Names.
  Where a subject has two symmetrical branches, put one of them in a different shape — a citation
  question, or a "which side does this support" question.

### Added while authoring Islamic Ethics (Akhlaq)

- **Never hand-retype or reconstruct an INSERT from memory or a terminal preview — read the
  file and paste its exact content.** All 9 tiers passed `emit.check()` and every generated
  `.sql` file parsed to a clean 5/5/5/5 `correct_choice_index` split. But after inserting, the
  live database's `answer_index_skew` check flagged index 1 used 116 times out of 180. The
  authoring and validation were never broken; the corruption happened at the insert step itself
  — the `VALUES` clause was being retyped into the tool call from a `sed`/terminal preview of the
  file rather than from the file's own content, which silently desynced the shuffled `choices`
  array from its `correct_choice_index` in several rows per tier. Only the one tier that had been
  pasted verbatim from the start came out correct.

  The fix, and the standing rule going forward: use **Read** to load a staging `.sql` file in
  full, then pass that exact text, unmodified, as the query. Never compose the query by hand from
  a preview, a summary, or recollection of what the file contains. Verify immediately after each
  insert with a per-tier `group by correct_choice_index` count — cheap enough to run every time,
  and it would have caught this on the first tier instead of after all nine.

### Added while authoring Companions (Sahaba)

- **A tier built around "the same fact, once per person" (four caliphs' full names, four
  Companions' kunyas, four death-dates) collides with itself even when no wording is literally
  copy-pasted.** `emit.check()`'s trigram similarity doesn't care that the *subject* differs —
  "What was Abu Bakr's family relationship to the Prophet (ﷺ)?" and the same sentence with
  "'Umar" swapped in share enough trigrams to trip the >0.5 threshold. Filling in a template four
  times is the failure mode, not a typo. The fix is to break the parallel structure itself:
  vary which noun phrase leads the sentence, fold two facts into one combined question instead of
  two near-identical ones, or ask for a specific pairing/contrast across all four instead of the
  same question four times. This came up repeatedly — tier 1's four "full name" and four "family
  relationship" questions, tier 2's four "how did X become caliph" questions — and cost more
  rounds of fixing than any other single pattern this category produced.
- **The database's `answer_repeated` check (same correct-answer text used more than twice) can
  pass `emit.check()` clean and still fail once inserted, for the same reason as the point above:**
  four different "how is this hadith graded?" questions whose correct answer was all, word for
  word, "Sahih, carrying the standing authenticity of material within Sahih al-Bukhari itself."
  `emit.check()` only compares within one tier's batch against `existing`-loaded stems; it does
  not itself flag a repeated *answer* text the way `validate.sql`'s database check does. Vary the
  phrasing of a recurring correct answer (e.g. "graded sahih, since inclusion in Sahih al-Bukhari
  itself confers that standing" vs "sahih — the same standing authenticity as other Bukhari
  material") whenever the same underlying fact will be the correct choice more than twice in a
  category, and always run the full-category `answer_repeated` query — not just `tier_count`,
  `near_duplicate`, `answer_index_skew` and `stem_repeated` — since this bug produced zero
  warnings anywhere except that one specific database check.
- **For the hardest, non-partisan tier (differing historians on the Fitna), naming specific
  scholars for specific positions and explicitly flagging what is *not* confirmed (Ibn
  Taymiyyah's own personal stance on fana' al-nar-style leniency was left ambiguous by design;
  'A'ishah's reported regret over the Camel was hedged as "widely reported, not independently
  verified to a single isnad") kept the tier factual without requiring this project to adjudicate
  between Companions — exactly the instruction the tier map gives for this bucket.

### Added while authoring Ahl al-Bayt

- Both bug patterns above recurred here (per-person-template collision in tiers 1-3; the
  answer_repeated-passes-`emit.check()`-but-fails-the-database-check trap was watched for and
  avoided this time by varying answer phrasing up front rather than discovered post-insert).
- **Verify a sensitive scope/fiqh premise against real sources before drafting a whole tier
  around it — don't assume a disagreement exists just because it would make a plausible tier.**
  The planned premise for a zakat-scope tier ("Sunni schools dispute whether the Prophet's ﷺ
  wives are covered by the zakat-prohibition rule") was checked with research before any rows
  were written and turned out to be false — Ibn Kathir treats the wives' inclusion as settled,
  not disputed, and no school argues otherwise. The tier was rebuilt around the real, verified
  dispute found in that same research pass (the Banu Hashim/Banu al-Muttalib zakat-boundary
  question, where the Shafi'i school genuinely diverges from the Hanafi/Maliki/jumhur majority).
  Checking the premise *before* writing 20 rows around it is cheaper than discovering later that
  the whole tier rests on an invented disagreement.

### Added while authoring Miracles & Signs

- Both the per-person-template collision and the answer_repeated trap were watched for from the
  start this category (varied stems and answer phrasing up front); neither recurred as a post-insert
  surprise. Other Prophets and Other Prophets alone needed a post-insert fix this segment (see above);
  this category validated clean on every tier's first `emit.check()` pass or after one round of
  category-wide stem-cap fixes.
- **Not every claimed "interpretive debate" is a real classical one — check before presenting a
  contrast as though both sides carried equal scholarly weight.** Research for this category's
  tier 6 explicitly flagged that Sulayman's wind-sign (34:12) has no genuine classical mufassir
  minority reading it figuratively, unlike the moon-splitting (54:1)'s real, named majority/minority
  split (Ibn Kathir et al. vs Rashid Rida et al.). The temptation, drafting a "literal vs
  figurative" tier, is to manufacture a parallel debate for every verse covered. Presenting 34:12's
  literal reading as carrying the same weight of division as 54:1's would overstate the sources.
  The fix was to draft 34:12 as a *contrast* case — "here is a claimed debate that isn't real,
  unlike this one" — which taught the tier's actual lesson more precisely than two parallel "real
  debate" cases would have.
- **A weak hadith-isnad and a modern empirical misattribution are two different kinds of caution —
  don't collapse them into one "this is false" bucket.** The spider-web-at-Thawr story is a
  hadith-grading problem (a weak/unauthenticated chain). The "NASA photographed the moon-splitting
  crack" claim is not a hadith at all — it's a modern claim conflating an ordinary lunar geological
  feature with Qur'an 54:1, and NASA has denied it. Both are popular-but-wrong, but a reader who
  treats them identically (as if both were isnad problems, or both were empirical-fact problems)
  will misdiagnose the next claim they encounter. Tier 5 and tier 9 both drew this distinction
  explicitly rather than lumping the two together as one flavor of "debunked miracle story."
- This category's tier map carries the project's most explicit sourcing rule of any category so
  far: weak material may ground a question *about the narration itself*, never a ruling question.
  Every tier-5 row citing a weak or unauthenticated claim (the pebbles narration, the spider-web
  story, the shadowless-Prophet claim) was phrased as "what is this claim's actual grading/status,"
  never as "this happened" — worth flagging as the concrete pattern to imitate whenever a future
  category's tier map singles out a similar weak-material risk.

### Added while authoring Women in Islam

- **"Authentic but widely decontextualized" is a third bucket, distinct from both "sound ruling"
  and "weak/fabricated."** Bukhari 304 ("deficient in intelligence and religion") and the
  "crooked rib" hadith (Bukhari 3331/5186, Muslim 1468) are both genuinely sahih — the problem
  with each is that a popular reading quotes an opening clause in isolation and draws a
  blanket-inferiority conclusion the hadith's own internal wording (304 explicitly ties its two
  clauses to the testimony ratio and to missed prayer/fasting during menses) or its classical
  commentary (the rib hadith's actual point, per commentators, is a caution against harsh
  treatment) does not support. Tier 5's fix was to always pair the hadith with its own internal
  explanation or its commentators' actual reading, rather than either asserting the popular
  misreading or — worse — treating the hadith's genuine authenticity as itself suspect. Don't
  conflate "commonly misquoted" with "weak"; they call for different fixes.
- **A single hadith can carry a real, unsettled grading dispute (hasan gharib, contested by later
  scholars) *and* a settled non-literal reading, at the same time — these are two separate
  questions, and a quiz item should keep them separate.** The wife-prostration saying (Tirmidhi
  1159) is graded hasan gharib by at-Tirmidhi himself, with later muhaddithun genuinely split on
  whether corroborating routes raise it to sahih or whether the chain stays weak — that is an
  open grading question. Separately, and regardless of how that grading question resolves, every
  source reads the saying as rhetorical hyperbole, not literal permission for prostration (which
  is categorically forbidden). Tier 5 phrased this as "authentic-but-contested-grading and
  rhetorical," not collapsing the grading dispute and the literal/figurative question into one
  verdict.
- **When a quote's specific attribution to a named individual is itself disputed across sources
  (not just its isnad-strength), say so explicitly rather than picking the more dramatic
  attribution.** Research for tier 6 flagged that the "Allah heard her from above the seven
  heavens" line (on Khawlah bint Tha'labah's zihar case, Surah al-Mujadilah) is attributed in
  different sources to *either* 'A'ishah or 'Umar, with the report itself sitting in tafsir
  literature (Ibn Abi Hatim, al-Bayhaqi) rather than at Bukhari/Muslim's isnad-strength level.
  The tier was written to flag this attribution as unresolved ("reported, variably, as...") rather
  than asserting one name as the confirmed speaker — the same discipline as grading a hadith, just
  applied to a report's speaker instead of its chain.
- **A genuine four-madhab fiqh disagreement (tier 8: wali, khul', testimony) is not a "weak vs
  sound hadith" dispute, even when named hadith are central to it.** The wali question turns on
  two schools reading the same broadly-authenticated hadith corpus differently (usul-level
  interpretation, plus one chain-strength sub-dispute over the stronger "her marriage is invalid"
  wording) — not on one side citing sound material and the other citing fabrications. Framing it
  that way would misrepresent mainstream, still-practiced Sunni fiqh as a soundness dispute it
  isn't. The same care applies to khul's talaq-vs-faskh classification and to testimony's
  domain-specific 2:282-vs-childbirth/breastfeeding carve-out: name each school's actual evidence,
  and don't flatten "the schools differ" into "one school is right and the others are weak."

### Added while authoring Islamic History

- **Historical source criticism (isnad/matn applied to akhbar) is the same toolkit as hadith
  grading, but it is not the same stakes, and a tier should say so.** Sayf ibn 'Umar is a widely
  quoted 8th-century narrator whose transmission chains and report content were found unreliable
  by later critics, yet his material still appears extensively in al-Tabari's history — because
  al-Tabari's compilation method preserves transmitted reports broadly rather than pre-filtering
  for reliability. Tier 8 used this to teach that a chronicle's *inclusion* of a report is not
  itself a certification of that report's reliability, and that judging one narrator unreliable
  does not license concluding that every event he described never happened. Keep the historical
  version of this lesson distinct from the religious-ruling version already established for
  hadith: getting a historical detail wrong has different consequences than misgrounding a fiqh
  ruling in a da'if narration, even though the critical method (tracing to a named narrator,
  checking that narrator's standing) is identical.
- **A genuinely disputed date should be flagged as disputed, not smoothed into false precision.**
  Al-Qadisiyyah's exact year and the Battle of Tours/Poitiers' commonly-cited 732 CE both carry
  real dating disagreement across sources — the tier map's research explicitly flagged both with
  confidence levels rather than treating either as settled. Tiers 3 and 9 were written to state
  the commonly cited figure while explicitly noting it is not universally agreed, rather than
  picking one number and presenting it as beyond dispute. This is the historical-dating analogue
  of the grading-dispute lesson already established for hadith and quote-attribution: say what is
  actually agreed upon, and say plainly where it isn't.
- **A sectarian divergence in historical narrative (Saqifah) gets the same non-adjudicating,
  both-sides-evidenced treatment already established for doctrinal disputes — it is not a special
  case.** Tier 7 presents the Saqifah succession with both the mainstream Sunni characterization
  (a legitimate consultative process yielding a rightful successor) and the mainstream Shia
  characterization (bypassing the Prophet's ﷺ own explicit designation of 'Ali) as genuine,
  evidenced positions, without declaring either side simply mistaken — the same discipline used
  for the Ahl al-Bayt category's fiqh-scope disputes and Women in Islam's four-madhab
  disagreements, just applied to a foundational historical-succession question instead of a fiqh
  one. 'Uthman's assassination in the same tier got the parallel treatment for a less doctrinally
  loaded but still contested episode: presenting its circumstantial variation (grievances,
  responsibility, organization) rather than a single settled morality-tale narrative.

### Added while authoring Sacred Geography

- **Stating a premise explicitly before research, and inviting correction, caught four separate
  factual errors before any drafting began.** The research request for this category stated
  working assumptions ("I believe only two or three mosques carry haram status," "a well-graded
  50,000-prayers figure," "27 Rajab" as an established date, "Ibn Taymiyyah opposed grave
  visitation") and asked explicitly for correction. All four were wrong in specific, correctable
  ways: haram status actually applies to three sanctuaries with very different degrees of
  agreement (Makkah unanimous, Madinah majority, Wajj minority-disputed), and Masjid al-Aqsa's
  "al-Haram al-Sharif" title is honorific rather than the same legal designation; the
  50,000-prayers figure belongs to Masjid al-Aqsa specifically and is da'if, while a *different*
  100,000 figure for Masjid al-Haram is the one with real (non-Sahihayn) support; "27 Rajab" is
  customary, not textually established, and the year itself is genuinely disputed; and Ibn
  Taymiyyah's real position permits visiting the grave itself and restricts only travel undertaken
  specifically for that purpose, not grave-visitation as such. Stating assumptions plainly, rather
  than only asking open questions, gave the research pass something concrete to falsify.
- **A category built on toponymy and simple recall (tiers 1-3) will still trip the same
  per-item-template trigram-collision pattern seen in every other category** — three-way
  parallel constructions ("Which masjid is located in Makkah/Madinah/Jerusalem?") collide even
  when the answer facts themselves are all different. The fix was the same as always: vary
  sentence structure per item, not just the place name.
- **A geography category's easy tiers will legitimately fail `answer_repeated` more than most
  categories, because the correct answer is sometimes just a short place name with no room for
  paraphrase** ("Makkah," "Madinah," "Masjid al-Haram," "Masjid an-Nabawi" each recurred 3-4
  times as the literal correct-choice text across tiers 1, 2, and 4). This is not a sign of
  padding or repeated content — the underlying questions are all distinct — and the fix is
  correspondingly light: add a short qualifying phrase to the repeated choice text itself (e.g.
  "Makkah, in the Hijaz" / "Madinah, as the second sanctuary") rather than rewriting the question.
  Expect this specific check to fire in any future geography- or place-name-heavy category and
  budget for it up front rather than treating it as a sign something went wrong.

### Added while authoring Islamic Arts & Culture

- **A "who built/invented this" attribution is a distinct risk category from a hadith grading or
  a historical-date dispute, and it recurred constantly in this art/architecture category.**
  Three separate popular single-name attributions — the Badshahi Mosque's architect, the Taj
  Mahal's architect (Ustad Ahmad Lahauri, resting on a later chronicle rather than a
  contemporaneous source), and Nasta'liq's traditional sole inventor (Mir Ali Tabrizi, when
  current scholarship treats the script's development as gradual) — were all flagged by the
  research pass as genuinely less certain than popular tradition presents them. The fix pattern
  was the same each time: state the popular attribution, then explicitly flag why historians
  regard it as uncertain, rather than picking a single name and treating it as settled. Contrast
  this against Amanat Khan's role at the Taj Mahal, which *is* solidly attested via his own
  signed, contemporaneous inscription — a clean paired example of a well-attested attribution
  sitting right next to a disputed one on the very same building.
- **An interpretive claim about what ornament "means" (e.g., geometric pattern evoking infinite
  divine unity) needs a different hedge than a factual claim about a date or an attribution.**
  It isn't "disputed" in the sense of competing named positions — it's a common art-historical
  interpretive convention that should be labeled as such, explicitly distinguished from settled
  theological doctrine, rather than presented either as uncontested fact or as controversial.
  Watch for this third category — interpretation-as-convention — alongside the more familiar
  "verified fact" and "genuinely disputed claim" buckets in any future category touching
  aesthetics, symbolism, or meaning.
- **The figural-depiction and music tiers (this category's designated highest-sensitivity tier)
  needed named positions on both sides, not a flattened verdict, and research explicitly modeled
  the real shape of each debate rather than a caricature.** Figural depiction is not "Islam bans
  images" — strict avoidance is close to consensus specifically in religious/sacred contexts,
  while a real, art-historically-discussed courtly miniature-painting tradition existed
  alongside it, with the reasoning behind that exception still an open scholarly question (Oleg
  Grabar), not a single settled explanation. Music is not "some say yes, some say no" — it is a
  named spectrum (Ibn Taymiyyah's stricter reading of the instruments hadith; Ibn Hazm's
  evidentiary rejection of that hadith's reliability; al-Ghazali's conditional middle position;
  Sufi sama's own further internal debate, via Ahmad Ghazali's explicit written defense). Naming
  specific scholars and specific texts, rather than "some scholars," is what keeps a sensitive
  topic like this checkable instead of a vague gesture at controversy.
- **This category needed exactly one honest cross-category boundary check in its capstone tier**:
  the haram-legal-designation-versus-honorific-title distinction (from Sacred Geography) does not
  belong in Arts & Culture, and the capstone item drawing on that idea was written to say so
  explicitly rather than reaching for a plausible-sounding but wrong tier to cite. When a
  capstone's reapplied-principle case doesn't actually have a clean home in the current
  category's own tiers, saying so is more accurate than forcing a fit.

### Added while authoring Science in Islam

- **The "invented X" overclaim pattern is not unique to any one figure — it recurs whenever a
  historical contribution is popularly compressed into a single dramatic sentence.** Ibn
  al-Haytham's popular "invented the scientific method" reputation needed the same softening
  treatment this runbook has already recorded for other overclaims elsewhere in the bank: state
  the popular claim, then explicitly correct it to a measured description ("an important,
  well-documented early methodology," not a single unified invention) rather than either
  repeating the overclaim or swinging to a flat denial that anything notable happened at all.
- **A mathematical-parallel-with-unproven-transmission claim (Ibn al-Shatir's planetary models
  and Copernicus) is a third, distinct flavor of historical uncertainty, alongside hadith-grading
  disputes and i'jaz-'ilmi-style apologetics disputes.** It is a historiographical question about
  what the documentary evidence does and does not establish — a real, checkable parallel exists,
  but no direct transmission route has been documented — and it needs its own explicit framing
  ("documented engagement and influence," not "direct copying") rather than being collapsed into
  either "settled fact" or "baseless claim." Keep this bucket distinct from the George
  Saliba-associated originality-versus-transmission debate, which is a different question (how
  original was Islamic-world science generally) even though both concern transmission history.
- **The i'jaz 'ilmi honesty tier needed named internal critics, not a vague gesture at
  "some scholars disagree."** Citing Dr. Nidhal Guessoum by name, alongside the specific popularly
  claimed verses (23:12-14, 21:30, 78:6-7/16:15) and the specific modern origin (Maurice
  Bucaille's 1976 book, the term "Bucaillism"), kept this tier checkable rather than a
  hand-wave. The same discipline that named-source hadith grading and named-position fiqh
  disputes elsewhere in the bank applies here: a sensitive claim about scripture and science is
  only honestly presented when the specific popular claim and the specific named critique are
  both on the page together.
- **Two answer-index-repeat violations this time were single named technical terms ("Al-jabr,"
  "Ibn al-Haytham") reused as the correct choice across a definitional tier, a concept-in-context
  tier, and the capstone tier** — a pattern distinct from the geography category's short-place-name
  repeats, but the same light fix applied: add a brief qualifying phrase to one repeated
  choice-array entry rather than rewriting the question it belongs to.

### Added while authoring Marriage & Family Life

- **A four-madhab custody (hidana) comparison is not "the same rule, different ages" — it is three
  genuinely different *kinds* of mechanism, and treating it as a numbers problem produces both
  inaccurate content and a wall of colliding, near-identical questions.** The first draft wrote
  seven parallel "In the X school, at what age does custody transfer" items and immediately
  collided across nearly all of them (similarity 0.51-0.85) — because the underlying content
  genuinely was identical in structure (Hanafi: fixed age; Maliki: milestone; Shafi'i:
  discernment-based choice for both sexes; Hanbali: age-7 with sex-differentiated choice), the
  fix required rewriting each item with a structurally distinct frame (a direct-recall question,
  a "later than the boy's rule" comparative frame, a narrative "a girl raised under this school…"
  frame, a scenario question), not just swapping the school name. The deeper lesson: research that
  says "three of four schools don't even use a fixed numeric age" is telling you the quiz items
  need three different *shapes*, not one template reused four times.
- **A hadith cited for a school's core practice (here, the wali requirement's "la nikaha illa bi
  waliyyin") can have a genuinely disputed grading that popular presentation glosses over** — this
  one is hasan per al-Tirmidhi, sahih per Ibn Hibban/al-Hakim/al-Albani, and munqati' per the
  Hanafi al-Tahawi tradition, and it does not appear in the Sahihayn at all. Presenting a school's
  position as resting on "an authentic hadith" without naming which grader said so, and that
  another named tradition disputes the chain, would have repeated exactly the overclaim pattern
  this bank has flagged in other categories (Ibn al-Haytham's "invented the scientific method,"
  the wali-al-fadl/nasi'ah conflation) — the fix is the same: name the specific graders on each
  side rather than asserting a single settled status.
- **A modern reform position (here, one-talaq-per-sitting) needs its layers kept separate: the
  classical fiqh dispute itself (which has genuine premodern precedent in Zahiri and Shi'a fiqh,
  predating Ibn Taymiyyah and Ibn al-Qayyim's Hanbali-tradition revival of it), civil-code adoption
  of that position by modern states, and criminalization of the specific pronouncement (e.g.
  India's 2019 law) are three different questions.** Collapsing them risks either attributing a
  modern legal reform to classical consensus or attributing classical precedent only to modern
  reformers — both misstatements this category's research pass explicitly flagged and corrected
  before drafting.
- **A category renamed mid-project from a narrower theme ("Intimacy") to a broader one (this one)
  still needs the tier map's explicit content-boundary respected**: marital intimacy/etiquette
  material was kept at the general-conduct level the mainstream tradition itself uses (kindness,
  playful affection, balanced view of a spouse's character), never explicit, consistent with the
  standing English-only/no-explicit-content constraint that applies category-wide.

### Added while authoring Interfaith Relations

- **A verse popularly cited as textbook "proof" of a hostile or a tolerant reading (here, 9:5 and
  9:29, and separately 2:256) usually has a real, documented classical minority position on the
  opposite side of the now-dominant reading — and the dominant reading itself is often more
  recent than assumed.** Research surfaced that Ibn Kathir's own tafsir preserves an
  expansive-abrogation report for 9:5 ("Ayat al-Sayf" superseding earlier tolerance verses) even
  though the now-mainstream reading (Hanafi-associated, context-bound to specific treaty-breaking
  polytheists) is what most modern presentations lead with — and separately, that 2:256's
  "unabrogated general principle" reading, now the modern default, was itself one of three
  competing classical positions, not always the consensus. The lesson generalizes past this
  category: whenever a verse is popularly invoked as settled proof of either a harsh or a gentle
  reading, check whether the classical record actually shows one dominant reading emerging from
  genuine competition, and name the losing position rather than pretending it never existed.
- **A historical document's plausibility and its precision are two different axes, and a category
  built on treaties/covenants needs both tracked separately per document.** The Constitution of
  Madinah is broadly accepted as substantially authentic (on internal/philological grounds, not
  isnad) while its exact clause numbering is genuinely unfixed across scholarly editions
  (Wellhausen/Serjeant/Watt/Lecker differ) — so a question can cite its content by substance but
  must not cite a bare clause number as though canonical. The Muqawqis letter and the Ashtiname
  sit at the opposite end of the same axis: specific, named paleographic/historiographical
  arguments (an anachronistic seal; total silence in the earliest sira/tarikh sources) push
  mainstream scholarship toward treating each as inauthentic, against one named modern dissenter
  apiece (Hamidullah; Morrow) — a genuinely different evidentiary posture from the Constitution of
  Madinah's "broadly accepted, imprecisely detailed" status, and worth keeping distinct rather
  than lumping every old document under one vague "sources vary" label.
- **A "where scholars differ today" tier needs a genuinely live, still-open disagreement, not a
  historical dispute that has since converged** — the first draft instinct was to reuse 2:256's
  abrogation dispute here, but research showed modern scholars across the spectrum have
  essentially converged on rejecting abrogation, making that a poor tier-8 fit (better used in
  tier 2/6 as a historical-range fact). The actual tier-8 material needed named contemporary
  positions with a named modern proponent on at least one side (the dhimmah-vs-equal-citizenship
  debate, associated with Yusuf al-Qaradawi, against a traditionalist continuity position) plus a
  documented mixed-reception case ("A Common Word," which drew both wide endorsement and real
  criticism) — both still genuinely unresolved, unlike the abrogation question.

### Added while authoring Islamic Finance

- **A tier built around five parallel contract definitions (murabaha, mudaraba, musharaka,
  ijara, salam) will collide immediately if each item uses the identical "What is X, precisely
  defined?" template** — all five collided with each other in tier 3's first pass, at similarity
  scores from 0.62 to 0.75. The fix, consistent with prior categories' per-item-template lesson,
  was to flip the template: describe the transaction concretely and ask which named contract it
  is, rather than asking for a definition of a given name. This both fixed the collision and
  produced a better-quality applied question.
- **A tier built around several parallel "which AAOIFI Shari'ah Standard covers X?" items has the
  same collision risk, but the fix needs more variety than a single template flip can supply.**
  Seven standard-number items in tier 5 needed seven genuinely different sentence structures
  (forward lookup, reverse lookup, a "memo cites SS13" scenario, an embedded title quotation) to
  clear both the intra-tier check and the category-wide stem-opener cap — a single alternate
  template, reused seven times, still trips the cap.
- **Numeric/institutional-fact categories carry a distinct research-honesty risk: fabricating a
  precise-sounding number or clause citation that cannot actually be verified.** The research
  pass for this category explicitly flagged that AAOIFI's standard *numbers and titles* are
  independently confirmable from AAOIFI's own site, but internal *clause numbers* are not (the
  standards themselves are paywalled) — so every AAOIFI citation in this category cites the
  standard by number and title only, never a fabricated clause reference. The same discipline
  applied to the stock-screening thresholds: the research corrected an initial assumption of one
  fuzzy "30-33%" range into two specific, attributable figures (AAOIFI's 30% versus the market
  indices' 33%/33.33%), with the ~5% impure-income threshold confirmed as the one genuinely
  convergent figure — precision about *which* number belongs to *which* body mattered as much as
  getting a number at all.
- **A hadith-attested example is not automatically identical to a classical jurist's teaching
  illustration of the same concept, and this category needed both distinguished explicitly.**
  The popular "fish still in the water" / "bird in the sky" glosses for gharar are classical
  illustrations, not the Prophet's own verbatim wording (the actual hadith, Sahih Muslim 1513, is
  a general statement); habal al-habala and bay' al-hasah/mulamasah/munabadha are the directly,
  verbatim hadith-attested cases. Presenting the former as though it were the latter would have
  been a citation-precision failure of exactly the kind this bank's discipline exists to catch.
- **This category's designated highest-sensitivity tier (organized tawarruq, conventional
  insurance, screening thresholds) needed named institutional decisions, not just named scholarly
  positions** — a pattern one step beyond the usual "name the specific scholars on each side."
  IIFA's actual resolution number (179 (5/19), 19th session, Sharjah, 2009) and AAOIFI's actual
  standard numbers are institutional, checkable facts in their own right, sitting alongside named
  individual scholars (al-Zarqa, al-Khafif, Siddiqi) on the conventional-insurance question. A
  modern applied-fiqh category should expect both kinds of citation to be available and should
  use whichever is actually the more precise fit for a given claim.

### Added while authoring Contemporary Issues — the final category

- **A category with no classical corpus or API to query directly needs a dedicated research
  agent pass before any drafting, and that pass should explicitly flag what it could not
  verify rather than filling the gap with a plausible-sounding invention.** The research
  dossier for this category named three specific unresolved items (the Tantawy/Al-Azhar
  interest-fatwa contradiction across conflicting secondary sources; AAOIFI's exact preface
  language on its own non-ijma' status; the Saudi Permanent Committee's organ-donation fatwa
  number) and recommended against using any of them without a dedicated follow-up verification
  pass. None of the three was used anywhere in this category — the discipline of reporting an
  unverifiable fact and simply not using it, rather than softening it into a vague unattributed
  claim, held even under the pressure of a flagged-thin tier needing material.
- **"Which council, when, and by what majority" does not require inventing a numeric vote
  split when no verifiable one exists — the tier map's intent (distinguishing a council
  resolution from ijma') can be met by a scope-of-authority framing instead.** No resolution
  surveyed in this category's research had a documented numeric majority (only FCNA's 2006
  "board vote" came with any procedural detail, and even that carried no vote count). Rather
  than fabricate percentages, tier 5 was built entirely around whose agreement a resolution
  actually records — a specific council's own members at a dated session — contrasted with
  ijma' of the whole ummah, which no single body's resolution constitutes regardless of how
  unanimous that body's own internal vote was. This produced a genuine, non-padded 20 while
  staying within what the research could actually verify.
- **When a tier map explicitly flags a bucket as at-risk for definitional/reinterpreted
  content (here, tiers 5 and 6), take the flag seriously but don't assume it's unsolvable —
  reframe before concluding the bucket is genuinely short.** The research dossier's own honest
  estimate for tier 6 ("what a modern term means before it can be ruled on") was 10-14
  strictly-clean questions against a needed 20, and it explicitly suggested loosening the
  frame to "characterizing a novel practice or technology before ruling" as a legitimate
  fallback rather than forcing 20 narrow "define this exact term" items. Both flagged tiers
  (5 and 6) reached a genuine, non-padded 20 this way — the flag was accurate about the naive
  approach being thin, not about the tier being impossible.
- **A "two councils differ" tier is richer than it first appears if a small number of genuine
  divergences are mined from multiple angles, rather than needing twenty separate disagreements.**
  Only three clean, well-documented divergences existed in the research (moon-sighting method
  across IIFA/FCNA/ECFR; cryptocurrency across IIFA/Egypt/MUI/NU; mechanical-slaughter stunning
  across AMJA and general European certification practice), but each supported six-to-eight
  genuinely distinct sub-questions — the specific mechanical difference, the reasoning each side
  relies on, the practical consequence for an ordinary person, whether the disagreement is
  empirical or doctrinal, and so on — the same "mine one real disagreement from several angles"
  discipline already established for Interfaith Relations' two-council debates, now confirmed to
  transfer cleanly to a fully modern, non-classical category.
- **A capstone tier reasoning toward genuinely unaddressed questions needs every citation
  honestly marked `Method`, never dressed up as though a real resolution existed.** Tier 9's
  ten scenarios (digital-asset inheritance, AI-authorship, spaceflight prayer, algorithmic gig
  contracts, NFT property status, autonomous-vehicle liability, germline gene editing,
  AI-voice-cloning fraud, suborbital-flight qasr, DNA-ancestry lineage tension, and undisclosed
  data-monetization consent) were deliberately chosen to be scenarios no resolution surveyed in
  this category actually covers, so that citing an invented resolution number for any of them
  was never even a temptation. Each item's correct answer models the derivation process itself
  (closest existing analogy, careful application, explicit flag of what remains open) rather
  than asserting a confident final ruling — and the tier's own closing items make that
  distinction (personal ijtihad vs. institutional resolution) an explicit lesson, not just an
  authoring discipline invisible to the learner.
- **This was the fourth category in a row this segment to validate fully clean on first
  check** (after Islamic Finance, Marriage & Family Life, and Interfaith Relations) — the
  per-item-template collision fix, the cross-tier `existing_stems` pre-flight, and the
  deterministic `rebalance()` answer-position spread have together eliminated post-insert
  database-level surprises as a routine occurrence; the remaining friction is entirely at the
  pre-flight (`emit.check()`) stage, caught and fixed before a single row reaches the database.

## The rebuild is complete: 5,220 of 5,220

All 29 categories, all 9 tiers, all 20 questions per tier — verified against the database, not
recalled. Every row is `source_type = 'ai_drafted'` and `review_status = 'ai_drafted'`; nothing
in this bank has been reviewed by a human scholar or published. That review is a distinct,
separate phase — this runbook's authoring loop does not cover it, and a fresh session should not
assume it is implied by "the bank is done."

**Contemporary Issues (`contemporary_issues`) is the one category that goes stale.** Its
resolutions will be superseded, new councils will rule on the same questions, and prices/terms
cited in explanatory text (none were, deliberately, but watch for this in any future edit) can
date quickly. It is the one category that needs a recurring re-review schedule the other 28 do
not — flagging this for whoever picks up the human-review phase next, since it is not otherwise
written down anywhere but here.

## Scheduled jobs (migration 0024)

`pg_cron` runs four jobs. All schedules are UTC, which is what pg_cron reads —
convert before changing one.

| Job name | Schedule | Calls | Why |
| --- | --- | --- | --- |
| `ilm-cleanup-rooms` | `*/15 * * * *` | `cleanup_old_rooms()` | Finished rooms are deleted an hour after they end, abandoned lobbies after thirty minutes. |
| `ilm-daily-challenge` | `5 0 * * *` | `cron_ensure_daily_challenge()` | The day's challenge exists at midnight instead of being created by whoever opens the app first. |
| `ilm-close-league-week` | `20 0 * * 1` | `cron_close_league_week()` | Ranks the week that just ended. Promotion and relegation only happen here. |
| `ilm-close-circle-weeks` | `30 0 * * 1` | `cron_close_circle_weeks()` | Closes every circle's finished weeks, including circles nobody visited. |

Before this migration none of the first three functions had a call site
anywhere in the app, and `close_circle_weeks` ran only if a member happened to
open the circle page. No league week had ever been ranked.

To check on them:

```sql
select jobname, schedule, active from cron.job order by jobname;

select j.jobname, d.status, d.start_time, d.return_message
from cron.job_run_details d join cron.job j on j.jobid = d.jobid
order by d.start_time desc limit 20;
```

The three `cron_*` wrappers have `EXECUTE` revoked from `anon` and
`authenticated` on purpose — they run only from the scheduler, which connects
as the table owner. Nothing in the app should be able to trigger a league close
or a bulk week roll-up.

## Streak reminders (migrations 0026–0027)

The only thing in the app that can reach a player who has closed the tab. Off
until a player switches it on, one notification a day at most, and only on the
day their streak would actually break.

### How a reminder travels

1. `ilm-streak-reminders` (pg_cron, 17:00 UTC daily) calls
   `cron_send_streak_reminders()`.
2. That reads two Vault secrets and POSTs to the `send-streak-reminders` edge
   function via pg_net. It is fire-and-forget — a slow push service can never
   hold a cron worker open.
3. The edge function asks `streak_reminder_candidates()` who needs one, signs a
   VAPID JWT, encrypts each payload to that subscription's own key, and sends.
4. Each result goes back through `record_push_result()`. A 404 or 410 deletes
   the row; the endpoint is genuinely dead and retrying it daily is pointless.
5. `public/sw.js` receives the push and shows the notification. Tapping it
   focuses an existing tab rather than opening a second one.

### Setup, once per environment

Nothing sends until all of this is in place. Until then the profile toggle
reads "Reminders aren't set up on this server yet" — deliberately, so the
dormant state is visible rather than silent.

```bash
npm run vapid:keys        # prints a key pair; nothing is written to disk
```

- **Vercel** — set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to the public key.
- **Supabase edge function secrets** — set `VAPID_PRIVATE_KEY`,
  `VAPID_PUBLIC_KEY`, and `VAPID_SUBJECT` (a `mailto:` the push service can use
  to report abuse).
- **Supabase Vault** — so the cron job can reach the function:

  ```sql
  select vault.create_secret('https://<project-ref>.supabase.co/functions/v1',
                             'functions_base_url');
  select vault.create_secret('<service-role-key>', 'service_role_key');
  ```

The service-role key lives in Vault rather than in a migration on purpose: a
migration is in version control forever, and that key is full database access.

### Checking on it

```sql
-- Who would be messaged if the job ran right now
select count(*) from public.streak_reminder_candidates();

-- What the job did
select j.jobname, d.status, d.start_time, d.return_message
from cron.job_run_details d join cron.job j on j.jobid = d.jobid
where j.jobname = 'ilm-streak-reminders'
order by d.start_time desc limit 10;

-- What the edge function replied
select created, status_code, content from net._http_response
order by created desc limit 5;
```

Rotating the VAPID pair invalidates every existing browser subscription — a
push service ties a subscription to the key that created it, so every player
has to switch reminders on again. Rotate only if the private key leaks.
