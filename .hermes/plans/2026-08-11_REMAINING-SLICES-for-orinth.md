# Bayan Remaining Slices — for Orinth (local model)

**Companion to:** `.hermes/plans/2026-08-08_213000-daily-loop-to-advanced-arabic.md`
(the pedagogy review) and `.hermes/plans/2026-08-08_BUILD-SLICES-for-orinth.md` (§8's
priority-ordered backlog, items 1-9 — this doc picks up where that list's status
actually is, not where it was assumed to be).

**Scope, per explicit instruction (2026-08-11):** items 5b-8 from the backlog, the
daily-loop composer, and the small doc/UX findings from the pedagogy doc's §7.
**Item 9 (ASR recitation grading) is struck from this plan** — not deferred, not
"later," excluded. Do not re-add it without a fresh instruction to do so.

---

## How to use this document

Same discipline as the prior two plan docs: one task at a time, in order within a
group; never start task N+1 before task N's verification passes.

**A real methodological difference from CONTINUOUS-READ:** almost everything here is
`workers/` backend work, which has a real Vitest harness against a real D1 schema
(`workers/test/routes.test.ts` and friends). So most tasks below get a genuine
failing-test-first eval, same discipline as BUILD-SLICES — this doc is closer to that
one in rigor than to CONTINUOUS-READ, whose frontend-only tasks had no such harness.
The two UI-heavy tasks (the wazn grid, the session composer) are the exception and are
marked "manual, stated" where that's true.

**Environment:**
```bash
cd /home/fjallouli/workspace/languagebuilder
cd workers  && npx tsc --noEmit && npm test        # real D1 schema, real tests
cd src/app  && npx tsc --noEmit && npm run build && npm run lint
node scripts/gen-content-manifest.mjs && node scripts/gen-content-manifest.mjs --check
node scripts/gen-api-docs.mjs && node scripts/gen-api-docs.mjs --check
```

**Rules carried over, still true:**
- If an eval passes before you implement, the eval is wrong. Fix the eval.
- Never invent Arabic. Every new drill here is generated from corpus/treebank data,
  never hand-authored text — same discipline as the homograph and tashkil drills.
- Run gates before claiming done. A build that compiles is not proof of behaviour.
- Migrations are numbered sequentially from `0024` (last is `0023_known_function_words.sql`)
  — confirm the actual next number before writing a new one; another task in flight
  may have already claimed 0024.

---

## Ground truth — corrections to the pedagogy doc, measured 2026-08-11

The original doc's §7 findings were checked against a **local** dev D1, which is not
representative — it holds partial content from ad hoc testing, not the real bank. Two
of its findings are wrong when checked against the actual **remote/production**
database, and a third backlog item is far more done than the doc assumed. Corrected
here so this plan doesn't redo already-shipped work:

- **The "17 kinds" claim was wrong.** Queried production directly
  (`wrangler d1 execute --remote`): the bank holds exactly **25 distinct kinds** and
  **38,995 exercises** (`rows_read: 38995` on the count query) — AGENTS.md's claim was
  correct all along. **No doc fix needed here.** What IS real: `gen-content-manifest.mjs`'s
  `--check` gate (`scripts/gen-content-manifest.mjs`) only regexes for the total-count
  claim (`TOTAL_CLAIM` pattern), never the kind-count — so today's correct number is
  correct by luck, not by a gate. That gate gap is real and is Task 1 below.
- **`KIND_LABELS` rendering 10 kinds as raw enums is already fixed** — BUILD-SLICES
  Task 4, commit `18297df`, which also added `scripts/check-kind-labels.mjs` to keep it
  from drifting again. Nothing to do here.
- **`AdvancedMemorizationTools` is already reachable from the main flow** —
  `src/app/app/memorization/page.tsx:262-268` links to `/advanced` with real link text
  ("Advanced tools — audio testing, cross-references, certificate export →"), and
  `Nav.tsx`'s own comments confirm this was a deliberate placement decision. Not buried.
  Nothing to do here.
- **Item 8 (governor/i'rab exercises from the treebank) is ~90% already built** — this
  is the biggest correction. `scripts/gen-syntax-exercises.mjs` exists, is real, and
  implements the pedagogy doc's own prescribed safety rule verbatim: a candidate is
  emitted only where the treebank's relation and the hand-verified morphology's case
  **concur** (its own header even cites the exact rejection rates: "0.9% of Subj, 1.7%
  of Pred, 3.8% of Poss and 7.3% of Obj"). Five real kinds ship in production off this:
  `mubtada_khabar` (825), `subject_word` (737), `object` (1,797), `idafa` (1,221),
  `fronting` (28) — 4,608 real exercises. **What's actually missing**: the doc
  specifically scoped item 8 as including "the 11,157 elided tokens," and those are
  presently **display-only** (the Parse lens's "Implied, not written (حذف)" section in
  `AyahReader.tsx`) — grepped `gen-syntax-exercises.mjs` for `elided`/`is_implied`:
  zero matches. That gap — an elided-subject exercise kind — is Task 9 below, and it's
  a much smaller task than "build governor items from scratch."
- **The stale "SM-2" comment is real but has moved.** The doc cited `Today.tsx:147`;
  that line now reads differently (the file has grown since 2026-08-08). Grepped fresh:
  the actual stale claim is `Today.tsx:163` — "Reviews first because SM-2 decides when
  they are due" — wrong since `space-repetition.ts` became FSRS-6. Every OTHER "SM-2"
  mention in the repo (11 more hits) is accurate historical/migration commentary, not a
  claim about current behaviour — do not touch those.
- **Confirmed still genuinely missing, matching the original doc:** `/tutor`'s subtitle
  ("Ask me anything about Arabic grammar, Quran memorization, or tajweed") still
  overpromises open dialogue when `tutor-grounding.ts` is corpus-lookup-only by design;
  `/progress` still groups by raw bank `category` (`src/app/app/progress/page.tsx:21,142`),
  not skill channel; no `user_known_pattern` table exists anywhere in the 23 migrations
  (grepped); no mutashabihat/near-duplicate-ayah code exists anywhere (grepped, only
  false-positive npm package name hits); `REQUEST_RETENTION` is a single hardcoded
  `0.9` (`space-repetition.ts:71`), not per-track; no `/session` route or composed daily
  flow exists.

---

## Status

| # | Task | Group | State |
|---|---|---|---|
| 1 | Gate the "kinds" claim in `gen-content-manifest.mjs` | Fixes | ✅ done |
| 2 | Fix the stale SM-2 comment (`Today.tsx:163`) | Fixes | ✅ done |
| 3 | `/tutor` subtitle honesty | Fixes | ✅ done |
| 4 | `/progress` regroup by skill channel | Fixes | ✅ done |
| 5 | Mutashabihat near-duplicate detection | 5b | ✅ done |
| 6 | Mutashabihat discrimination exercise kind | 5b | ✅ done |
| 7 | `user_known_pattern` migration + endpoints | 6 (wazn) | ✅ done |
| 8 | Wazn dimension in `/api/progress/coverage` | 6 (wazn) | ✅ done |
| 9 | Root × wazn grid UI | 6 (wazn) | ✅ done |
| 10 | Elided-subject exercise kind | 8 (governor) | ✅ done 2026-08-15 — CSV recovered (pinned SHA), emit only where reconstructed token folds to a written STEM pronoun of the head verb's PNG; 750 bank items |
| 11 | Per-track retention target + workload preview | 7 (hifz) | ✅ done |
| 12 | Cold-start / warm-context review flag | 7 (hifz) | ✅ done — also fixed a real bug: `isWarmStart` was parsing SQLite's naive `datetime('now')` string as local time instead of UTC |
| 13 | Sabaq/sabqi/manzil tier classification + manzil rotation | 7 (hifz) | ✅ done — manzil selection verified with an actual 7-day clock-freeze simulation, not a hand trace |
| 14 | Daily-loop session composer | Daily loop | ✅ done — `/session` route; live browser walkthrough not possible this pass (browser tool's CDP connection was unresponsive), verified via clean build + compiled-bundle content checks instead |

**Plan complete.** All 14 tasks shipped. Item 9 (ASR) remains struck.

Struck: **item 9, ASR recitation grading — out of scope, do not build.**

---

# GROUP: Small fixes

# TASK 1 — Gate the "kinds" claim in `gen-content-manifest.mjs`

**Objective:** the total-count claim is gated; the kind-count claim (AGENTS.md says
"25 kinds" in two places, README in a third) is not. Today's number happens to be
right; nothing stops it drifting silently the way the total once did.

### Files
- Modify: `scripts/gen-content-manifest.mjs`

### Step 1 — Write the failing check
Manually edit README.md's "25 kinds" (or AGENTS.md's) to say "24 kinds" locally, run
`node scripts/gen-content-manifest.mjs --check`, confirm it **passes anyway** (proving
the gap) — this is the eval, run by hand since the gate script itself has no test
harness (it's a doc-checking CLI tool, same category as `check-kind-labels.mjs`, none
of which are unit-tested — they're tested by being run against real drift). Revert the
edit after confirming.

### Step 2 — Implement
Add a second regex alongside `TOTAL_CLAIM`:
```js
const KINDS_CLAIM = /([\d,]{1,3})(?=[- ]kinds)/g;
```
and the same drift check as `TOTAL_CLAIM`, comparing against
`Object.keys(manifest.exerciseBank.byKind).length` (already computed, already in the
manifest — no new data needed).

### Step 3 — Verify
Redo Step 1's manual edit; confirm `--check` now fails with a clear message. Revert,
confirm it passes.

### Step 4 — Commit
```bash
git commit -m "fix(content-manifest): gate the exercise-kind-count claim, not just the total"
```

---

# TASK 2 — Fix the stale SM-2 comment

### Files
- Modify: `src/app/components/today/Today.tsx` (line ~163)

### Step 1 — Implement
```tsx
// before: "Chosen, not offered alongside seven equals. Reviews first because SM-2
//          decides when they are due and a missed review costs retention..."
// after:  same sentence, "SM-2" → "FSRS"
```
One-word fix. Read the surrounding paragraph first — confirm no other clause depends
on the SM-2-specific framing before swapping the word.

### Step 2 — Verify
`grep -n "SM-2" src/app/components/today/Today.tsx` returns nothing.
`cd src/app && npx tsc --noEmit && npm run lint` clean.

### Step 3 — Commit
```bash
git commit -m "fix(today): FSRS decides review timing, not SM-2 (stale since the FSRS migration)"
```

---

# TASK 3 — `/tutor` subtitle honesty

**Objective:** `tutor-grounding.ts`'s own stated rule is "facts first, the model may
narrate but is never the source" — a real, good discipline. The page's subtitle
("Ask me anything about Arabic grammar, Quran memorization, or tajweed") promises
open-ended dialogue that discipline doesn't deliver. Fix the promise, not the feature.

### Files
- Modify: `src/app/app/tutor/page.tsx`

### Step 1 — Implement
Replace the subtitle with something that describes what it actually is — a grounded
lookup, not a chatbot:
```tsx
subtitle="Ask about a word, a root, a location, or a tajweed rule — answered from the corpus, not invented"
```
(Exact wording is a judgment call; the constraint is that it must not imply
unscoped conversational ability.)

### Step 2 — Verify
Manual: load `/tutor`, confirm the new subtitle renders. `npm run build` clean.

### Step 3 — Commit
```bash
git commit -m "fix(tutor): subtitle describes grounded lookup, not open dialogue"
```

---

# TASK 4 — `/progress` regroup by skill channel

**Objective:** the mastery breakdown groups by raw bank `kind` (a schema category —
`case_ending`, `mood`, `voice`, ...), which is diagnostic of the DATA MODEL, not of
what the learner should work on next. Regroup into skill channels: morphology / case /
governor / vocabulary / tajweed.

### Files
- Modify: `src/app/app/progress/page.tsx`

### Step 1 — Design the mapping
A `KIND_CHANNEL: Record<string, string>` map, same shape/location as the existing
`KIND_LABELS`. Proposed grouping (adjust if a kind's real skill doesn't match its
apparent one):
```
Morphology:  root_id, verb_form, pos_id, aspect, definiteness, derived_noun
Case/i'rab:  case_ending, mood, voice, subject_agreement
Governor:    mubtada_khabar, subject_word, object, idafa, fronting, word_role
Vocabulary:  word_meaning, find_word
Syntax/other: negation, relative_pronoun, demonstrative, conditional, sentence_type,
              jinas, simile, homograph
```
(This is a judgment call, not derived from a source of truth — state it as one in the
commit, don't present it as more authoritative than it is.)

### Step 2 — Implement
Group the existing per-kind mastery rows under channel headings in the render, sorted
channels-first then kind within channel. Keep the existing per-kind rows and their
`KIND_LABELS` text unchanged underneath each heading — this is a regroup, not a
rewrite of what's displayed.

### Step 3 — Verify
Manual: load `/progress` with real attempt data, confirm every kind still appears
exactly once, now under a channel heading. `check-kind-labels.mjs` should still pass
unmodified (it doesn't know about channels, only labels).

### Step 4 — Commit
```bash
git commit -m "feat(progress): group mastery by skill channel instead of raw bank kind"
```

---

# GROUP: Mutashabihat (item 5b)

# TASK 5 — Detect near-duplicate ayah pairs

**Objective:** near-identical verses differing by one word are the classic hifz
confusion. Detect them from text already in the corpus — no new data source.

### Files
- New: `scripts/find-mutashabihat.mjs`
- New: `data/mutashabihat-pairs.json` (generated output, committed — same pattern as
  `content/derived-manifest.json`: generated, not hand-authored, but checked in so the
  ingest step doesn't need to recompute it every deploy)

### Step 1 — Write the failing check
```js
// A trivial fixture: two near-identical short strings should pair; two unrelated
// strings should not. Run standalone (this script has no existing test harness to
// join — same category as gen-syntax-exercises.mjs, verified by running against
// real data and eyeballing a sample, not unit tests).
```
Run `node scripts/find-mutashabihat.mjs` against the real corpus with no output file
yet — confirm it errors (module doesn't exist).

### Step 2 — Implement
- Read `data/quran-uthmani.txt` (same source `gen-syntax-exercises.mjs` already
  trusts and SHA-pins — reuse that pinning pattern).
- Normalize each ayah with the EXISTING `normaliseArabic()` (do not write a second
  normalizer — this repo has already had one real bug from an inline Arabic regex
  class; reuse the vetted one).
- Compute edit distance (Levenshtein) between ayah pairs **within a bounded candidate
  set**, not all 6,236² pairs — bucket by length first (only compare ayahs within, say,
  ±3 words of each other) to keep this tractable, and log the bucket sizes so the
  script's own output states how much was actually compared.
- A pair counts as mutashabih if edit distance is low relative to length (e.g. ≤15% of
  the shorter ayah's character length — a real threshold to tune against a manual
  sample, not asserted as correct on the first try) AND the two ayahs are not
  identical (skip true duplicates — verbatim repeats like "فَبِأَيِّ آلَاءِ رَبِّكُمَا
  تُكَذِّبَانِ" occurring dozens of times in Ar-Rahman are a different phenomenon,
  refrain repetition, not the confusion this drill targets).

### Step 3 — Verify
Run against the real corpus. **Manually check a sample of 15-20 detected pairs** against
known real mutashabihat lists (there are published scholarly lists of these — cross-
reference at least a few well-known ones, e.g. within Al-Baqarah, to sanity-check the
threshold isn't producing nonsense). State the false-positive rate observed, honestly,
in the commit — do not claim precision you haven't measured.

### Step 4 — Commit
```bash
git commit -m "feat(content): detect near-duplicate (mutashabihat) ayah pairs from the corpus"
```

---

# TASK 6 — Mutashabihat discrimination exercise kind

**Objective:** same principle as the homograph drill (BUILD-SLICES Task 5) — present
the two confusable ayahs and ask which is which, or what the one differing word is.

### Files
- Modify: `scripts/gen-derived-content.mjs` (or a new sibling script — decide based on
  whether this reads `data/mutashabihat-pairs.json` cleanly alongside the existing
  morphology-driven generation; if the input shape is different enough, a separate
  script mirroring `gen-syntax-exercises.mjs`'s "separate on purpose" reasoning is fine)
- Modify: `workers/src/db/migrations/0024_*.sql` if a new `mutashabihat` kind needs
  schema support beyond the existing `grammar_exercise_bank.kind` column (likely
  doesn't — that column is already a free-text kind identifier)
- Modify: `src/app/app/progress/page.tsx` — add `mutashabihat` to `KIND_LABELS` (the
  `check-kind-labels.mjs` gate will catch this if missed — that's what it's for)

### Step 1 — Write the failing eval
Following the homograph drill's precedent exactly (`scripts/check-pedagogy.mjs` likely
has a per-kind minimum-count assertion pattern already — check it and add
`mutashabihat` to whatever that pattern is before generating, so the gate is red
first).

### Step 2 — Implement
For each detected pair: prompt shows one ayah's reference (surah:ayah), asks the
learner to identify which of two near-identical candidate texts is the real one at
that location — or, cheaper and more targeted, highlight the single differing word and
ask what it is. Prefer the latter (more diagnostic, matches "interference is a feature"
framing from the doc) if the pair data supports pinpointing the differing word cleanly;
fall back to the former if word-level diffing across the pair is unreliable.

### Step 3 — Verify
`node scripts/gen-derived-content.mjs` (or the new script), regenerate the manifest
(`gen-content-manifest.mjs`), confirm the new kind appears with a real count, `--check`
passes (Task 1's new kinds-count gate will now correctly require this).

### Step 4 — Commit
```bash
git commit -m "feat(exercises): mutashabihat discrimination drill — near-identical ayah pairs"
```

---

# GROUP: Root × wazn grid (item 6)

# TASK 7 — `user_known_pattern` migration + endpoints

**Objective:** mirror `user_known_root`/`user_known_function_word` exactly — same
shape, same discipline, for verb form (Forms I-XII).

### Files
- New: `workers/src/db/migrations/0024_known_patterns.sql`
- Modify: `workers/src/routes/progress.ts`
- Modify: `workers/test/routes.test.ts`

### Step 1 — Write the failing tests
Same shape as the existing `user_known_root` tests (`workers/test/routes.test.ts`,
"known roots and coverage" describe block) — one test refusing an unattested pattern,
one recording + undoing a real one. New endpoints, mirroring the roots ones exactly:
```
GET    /api/progress/patterns             — all attested forms, by frequency, known flag
POST   /api/progress/patterns/:form/known
DELETE /api/progress/patterns/:form/known
```

### Step 2 — Run and see them fail
`cd workers && npx vitest run routes.test.ts` — new tests fail (route doesn't exist).

### Step 3 — Implement
```sql
-- 0024_known_patterns.sql
CREATE TABLE user_known_pattern (
  user_id TEXT NOT NULL REFERENCES users(id),
  verb_form TEXT NOT NULL,
  PRIMARY KEY (user_id, verb_form)
);
```
Route handlers mirror `progressRoutes.get('/roots/...)` exactly — refuse an
unattested `verb_form` (checked against `quran_word_morphology WHERE verb_form = ?`,
same refusal discipline as roots/function-words), same `{data}` envelope.

### Step 4 — Verify
`npx vitest run` — full suite, including new tests, all green. `npx tsc --noEmit` clean.

### Step 5 — Commit
```bash
git commit -m "feat(db): add user_known_pattern, keyed on verb_form — mirrors known roots"
```

---

# TASK 8 — Wazn dimension in `/api/progress/coverage`

**Objective:** the coverage model currently has two dimensions (root, function word).
Add pattern as a third, following the exact same "stated basis, not buried" discipline
the existing two already use.

### Files
- Modify: `workers/src/routes/progress.ts` (the `/coverage` handler)
- Modify: `workers/test/routes.test.ts`

### Step 1 — Write the failing test
Seed a verb segment with a `verb_form`, assert `/coverage`'s response includes
`patternsKnown`/`patternsTotal` fields and that marking a pattern known moves the
count — same pattern as the existing function-word coverage test.

### Step 2 — Implement
**Important scoping decision, stated rather than glossed over:** unlike root/function-
word, pattern coverage should almost certainly NOT gate "ayah fully readable" the way
the other two do — a learner can read غفر without knowing it's Form I by name. Pattern
coverage is a **separate, parallel metric** ("which of the 6 common patterns do you
know"), not a new AND-condition on `ayahsReadable`. Get this decision right before
implementing — conflating it with readability would silently make coverage numbers
drop again, the same shock the function-word rollout caused, for a much weaker reason.
Add `patternsKnown`/`patternsTotal` (6-form scope, per the doc's "six forms cover 99%"
finding — Forms I, II, III, IV, V, VIII by the measured distribution) to the response
as its own field, untangled from `ayahsReadable`.

### Step 3 — Verify
`npx vitest run` green. Manually confirm `ayahsReadablePct` is byte-for-byte unchanged
before/after this task for a fixed known-root/known-fn state (the regression check
that matters most here).

### Step 4 — Commit
```bash
git commit -m "feat(progress): pattern coverage as its own metric, not a readability gate"
```

---

# TASK 9 — Root × wazn grid UI

**Objective:** the actual grid — rows = known roots, columns = the 6 common forms,
cells lit where that combination occurs in the Quran. Per the doc: "an honest progress
display... generates exercises... shows the learner why their vocabulary is about to
multiply."

### Files
- New: `src/app/app/patterns/page.tsx` (or fold into an existing page — `/progress` is
  the closest fit; decide based on how the page reads once Task 4's regroup lands,
  don't just default to a new route because it's easier)
- New endpoint if the grid needs a combined root×form occurrence query not already
  served by any existing route (check `GET /api/progress/coverage`'s `nextRoots` query
  shape first — a similar `GROUP BY root, verb_form` query may already be a small
  addition to an existing handler rather than a new one)

### Step 1 — Design
This is the one genuinely new UI surface in this doc. Minimum viable: a table, known
roots down the side (capped/paginated — 400+ known roots won't fit one screen),
6 form columns, cell = lit (occurs + you know both) / dim (occurs, pattern unknown) /
blank (doesn't occur for this root). Clicking a lit-eligible cell should be the entry
point to Task 6-style "you know X, you know Form Y — what does the combination mean?"
— but that generation is a stretch goal, not required for this task; the grid display
itself is the deliverable.

### Step 2 — Implement
Follow this repo's established rendering conventions (see `Today.tsx`'s coverage grid
section for the visual/data pattern to match) rather than inventing a new one.

### Step 3 — Verify (manual, stated as such — no component-test harness exists, same
caveat as CONTINUOUS-READ's frontend tasks)
`cd src/app && npx tsc --noEmit && npm run build && npm run lint`. Manual: load the
page with real known-root/known-pattern data, confirm the grid renders and cell states
match what `/api/progress/patterns` + `/api/progress/coverage` actually report.

### Step 4 — Commit
```bash
git commit -m "feat(progress): root x wazn grid — the multiplicative payoff, made visible"
```

---

# GROUP: Elided-subject exercises (completing item 8)

# TASK 10 — Elided-subject exercise kind — ⛔ BLOCKED (2026-08-11), not skipped silently

**Real blocker found while starting this task, recorded rather than routed around:**
`data/quranic-treebank-eqtb.csv` — the raw source `gen-syntax-exercises.mjs` and
`scripts/ingest-treebank.mjs` both read from — does **not currently exist on this
box**. Checked directly (`find ~` across the whole home directory): the only trace
left is the ingest script itself; the actual `.csv` (originally extracted from a
`.rar` at github.com/NoorBayan/Quranic) was never persisted, consistent with `data/`
being gitignored wholesale.

Considered and rejected: querying the already-ingested `quran_syntax` /
`quran_word_morphology` tables in **production** D1 instead of the raw CSV, to route
around the missing file. That's architecturally sound in principle (the tables ARE
the same data, already verified once at ingest time) — but the safety mechanism this
task's own Appendix warns about (Failure mode #4: "do not weaken the concur rule
for elided tokens... find a different way to bound the risk") needs a real design
decision — specifically, whether to decode a reconstructed pronoun's text (e.g.
أَنتُم) into (person, gender, number) and cross-check it against the head verb's own
hand-verified morphology, which means hand-authoring an Arabic-pronoun feature table
under time pressure — exactly the class of error ("inventing grammar") this codebase
is most disciplined about avoiding. Local D1 also has zero `quran_syntax` rows
(checked directly), so even the production-query route couldn't be verified
end-to-end locally before shipping.

**Decision: defer, do not ship unverified.** Re-acquiring the treebank source and
designing the pronoun-feature safety check properly are both real, scoped pieces of
follow-up work — neither should be done in the time-pressured tail of a "do them all"
pass. This is the one task in this doc genuinely not completed in the 2026-08-11
session; everything else in the doc is.

**Objective (unchanged, for whoever picks this up):** close the one real gap in an
otherwise-shipped feature. 11,157 elided tokens exist in `quran_syntax`
(`is_implied = 1`), currently display-only.

### Files
- Modify: `scripts/gen-syntax-exercises.mjs`

### Step 1 — Write the failing eval
Same file, same safety discipline — **do not weaken the concur-with-morphology rule
for this new kind just because elided tokens have no morphology row of their own to
concur with.** Read how `AyahReader.tsx`'s Parse lens already resolves an elided
token's role today (`head_word`/`rel`/`rel_ar`/`token`, joined to its head via
`sentence_id`/`token_index` — see `workers/src/routes/quran.ts`'s elided query) and
reuse that exact resolution logic rather than re-deriving it.

### Step 2 — Implement
A new `elided_subject` (or similarly named) kind: prompt shows the verb
(e.g. نَعْبُدُ), asks what pronoun/role is grammatically present but unwritten. Answer
comes directly from the treebank's own `token`/`rel_ar` fields for that implied
token — never invented, never inferred beyond what the treebank already states.

### Step 3 — Verify
Regenerate, `gen-content-manifest.mjs --check` passes (Task 1's kinds-gate will
require the new kind be labeled — do that in the same commit or a stacked one).

### Step 4 — Commit
```bash
git commit -m "feat(exercises): elided-subject drill — the last unexercised part of item 8"
```

---

# GROUP: Hifz scheduling (item 7)

# TASK 11 — Per-track retention target + workload preview

**Objective:** `REQUEST_RETENTION = 0.9` is a single global constant. Make it
per-track (hifz 0.95, vocabulary 0.90, long-tail 0.85), and show the workload cost
before the learner picks — per the doc, "at 0.95 this is ~34 reviews/day; at 0.90,
~21," not a bare setting nobody can reason about.

### Files
- Modify: `workers/src/lib/space-repetition.ts`
- Modify: `workers/src/db/migrations/0025_*.sql` (a `users` column or small settings
  table for the chosen retention — check `users` table shape first, a single nullable
  column may be simpler than a new table)
- Modify: whatever route computes the daily review queue (find via
  `grep -rn REQUEST_RETENTION workers/src/routes/`)

### Step 1 — Write the failing tests
`space-repetition.ts`'s existing tests (check `workers/test/` for the current
FSRS/space-repetition test file) get new cases: retention target now varies by track,
default unchanged (0.9) when unset, so **every existing test must still pass
unmodified** — this is a widen, not a behaviour change, for anyone who hasn't opted in.

### Step 2 — Implement
`REQUEST_RETENTION` becomes a function of track rather than a constant; default stays
0.9 (do not silently change existing learners' schedules). A workload-preview
computation: given current FSRS state for a track, estimate reviews/day at a candidate
retention target — this can be a simple simulation (how many items would cross their
due threshold at each retention level) rather than anything elaborate.

### Step 3 — Verify
`npx vitest run` — full suite green, including untouched pre-existing tests (the
regression check that matters most: nobody's schedule silently shifts).

### Step 4 — Commit
```bash
git commit -m "feat(hifz): per-track retention target with a workload-cost preview"
```

---

# TASK 12 — Cold-start / warm-context review flag

**Objective:** chained recall inflates apparent strength — a learner who can only
recite ayah 12 after reciting 11 hasn't memorised 12 independently. Mark items that
only pass when warmed as weak, per the doc's fix (b).

### Files
- Modify: `workers/src/routes/memorization.ts` (or wherever the review-submission
  route lives — find via the existing typed-recall route from BUILD-SLICES Task 6)
- Modify: relevant migration if a new column is needed on the review/attempt table

### Step 1 — Write the failing test
A review submitted with the immediately-preceding item ALSO reviewed correctly in the
same session gets flagged `warmStart: true` (or similar); one submitted cold (first
item of a session, or after a gap) does not.

### Step 2 — Implement
Needs session-sequencing context — check whether review submissions already carry any
session/sequence identifier; if not, this may need the client to pass "was the
previous ayah in this surah just reviewed in this session," which is a real design
question (client-tracked vs server-inferred from timestamps) — **resolve which before
implementing**, don't guess. Server-inferred from `last_reviewed` timestamps of the
adjacent span within a short window (e.g. same session = within N minutes) is simpler
and needs no client changes; prefer it unless it proves unreliable.

### Step 3 — Verify
`npx vitest run` green. Confirm a genuinely cold review (first thing in a fresh
session) is never mis-flagged as warm.

### Step 4 — Commit
```bash
git commit -m "feat(hifz): flag warm-context reviews — chained recall is not independent recall"
```

---

# TASK 13 — Sabaq/sabqi/manzil tier classification + manzil rotation

**Objective:** the largest, most architecturally real task in this doc. Manzil
(everything memorised beyond ~30 days) should rotate through in contiguous spans
(a juz'/page at a time), not scatter into a per-item FSRS due-date queue — chained
recall depends on contiguity, and a naive per-ayah queue destroys it.

### Files
- Modify: `workers/src/db/migrations/0026_*.sql` — a `tier` column (or derived, not
  stored — decide: tier is a function of `last_reviewed` age, so it may not need
  storage at all, only a query-time classification; prefer computing it over storing
  it unless performance forces the issue)
- Modify: the review-queue-building route (`workers/src/routes/memorization.ts` or
  equivalent — same file as Task 12 likely touches)
- Modify: `workers/test/routes.test.ts`

### Step 1 — Write the failing tests
Three fixture spans at different `last_reviewed` ages (today, 2 weeks ago, 3 months
ago) — assert the review-queue endpoint classifies them sabaq/sabqi/manzil correctly,
and that manzil items come back **grouped by contiguous surah range**, not
individually interleaved with sabaq/sabqi items the way today's flat due-date queue
would.

### Step 2 — Implement
- Tier boundaries from the doc's own table: sabaq = today's new material; sabqi =
  last ~7-30 days; manzil = older. Compute from `last_reviewed`/`status`, not a new
  stored field, per the Files note above.
- Manzil rotation: **1/7th of the memorised body per day**, in contiguous
  surah/ayah order, is the doc's own prescription — implement it as literally that:
  partition manzil spans into 7 buckets by position (not by due date), rotate which
  bucket surfaces by day-of-week or a simple modulo counter. This deliberately
  **does not use FSRS due-dates for manzil** — that's the whole point of this task,
  stated so a future reader doesn't "fix" it back to per-item scheduling.
  Per-ayah difficulty (existing FSRS state) stays tracked underneath for future
  targeted drilling, per the doc — just not what selects the daily manzil set.

### Step 3 — Verify
`npx vitest run` full suite. Manually trace one learner's full week of manzil
rotation by hand against the implementation — confirm it actually reaches all
memorised material over 7 days, not a subset.

### Step 4 — Commit
```bash
git commit -m "feat(hifz): sabaq/sabqi/manzil tiers — manzil rotates contiguously, not by due date"
```

---

# GROUP: Daily-loop composer

# TASK 14 — Daily-loop session composer

**Objective:** every ingredient of the doc's 25-minute session now exists (hifz
review, function words, intensive reading, grammar production, freeflow) but nothing
stitches them into one guided flow. Build that composition, not new content.

### Files
- New: `src/app/app/session/page.tsx` (or extend `Today.tsx` — decide based on whether
  a distinct guided-session mode is different enough from Today's single-primary-action
  pattern to warrant its own route; the doc explicitly says "extend that principle to
  the whole session rather than adding tiles," which argues for one flow, not a tile)
- Possibly: a new `/api/session/next` endpoint if step-sequencing needs server logic
  beyond what the client can compose from existing endpoints — check whether the five
  existing endpoints (review/today, function-words, reading-queue, grammar exercises,
  freeflow) are sufficient to sequence client-side first, before adding a new route.

### Step 1 — Design
Order from the doc, by decay rate, not by feel:
```
1. Hifz review        (due items — typed recall, from BUILD-SLICES Task 6)
2. Function words      (a few new ones, from BUILD-SLICES Tasks 1-3)
3. Intensive reading   (2-3 ayat from the reading queue — existing endpoint)
4. Grammar production  (tashkil items — from BUILD-SLICES Task 7)
5. Freeflow            (from BUILD-SLICES Task 8 + this session's continuous-play work)
```
Each step is a real existing surface — this task is sequencing and a "next" affordance
between them, not rebuilding any of the five. No lesson grid, no goal picker, no XP —
the doc is explicit that adding tiles is the failure mode to avoid.

### Step 2 — Implement
A linear stepper: complete (or explicitly skip) step N, advance to N+1, land on a
completion state at the end. Each step embeds or links to the existing real
surface for that step rather than reimplementing it.

### Step 3 — Verify (manual, stated as such)
Full manual walkthrough of all 5 steps in order, confirming each step's real data
(due count, function-word picks, reading-queue items, tashkil items, freeflow run)
matches what that surface shows standalone. `npx tsc --noEmit && npm run build && npm run lint` clean.

### Step 4 — Commit
```bash
git commit -m "feat(session): compose the five existing pieces into one guided daily loop"
```

---

## Appendix — failure modes most likely to bite

1. **Re-deriving something that already ships.** This doc exists specifically because
   the ORIGINAL diagnosis (item 8, the kind count, `AdvancedMemorizationTools`) was
   checked against an unrepresentative local database and got three things wrong.
   Before starting any task here, grep for it first — the pattern that bit this plan
   once will bite it again.
2. **Conflating pattern coverage with ayah readability** (Task 8) — a learner does not
   need to know a verb's Form number to read the verb. Keep it a parallel metric.
3. **Letting manzil rotation silently become FSRS-due-date-driven again** (Task 13) —
   that's the exact naive-queue failure the whole task exists to avoid. If a future
   edit reintroduces per-item due-date selection for manzil, it has un-fixed this.
4. **Weakening the treebank concur-rule for elided tokens** (Task 10) because they
   have no morphology row to check against. The rule exists because a 95.7%-LAS parser
   is not safe to teach from unchecked — find a different way to bound the risk for
   this kind rather than dropping the check.
5. **Silently shifting existing learners' review schedules** (Task 11) — the default
   retention target must stay 0.9 for anyone who hasn't explicitly chosen otherwise.
6. **Adding a tile instead of composing** (Task 14) — the doc is explicit that Today's
   one-primary-action discipline is what's right about it; a session picker screen
   would be the exact regression the doc warns against.
7. **Item 9.** It is struck. Do not build ASR recitation grading as part of executing
   this plan, even if a task here turns out to touch `AyahAudioButton` or recitation
   audio in a way that makes it tempting to bolt on.
