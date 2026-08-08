# Improvement Plan — 2026-08-08

## For the executing agent
Before anything else, confirm you are on branch agent-improvements-2026-08-08
(git checkout it if not - never work on main). Work ONE unchecked task at a
time: re-read this file, find the first unchecked box, do it, verify it per
its Verify: line, check the box, commit on this branch, and stop. A new
session picks up the next one. This keeps load on the local model endpoint
(BTL-4, single GPU) to one agent at a time. Do not merge to main.

---

This plan was produced by reading the actual current state of the codebase
on 2026-08-08 (not the stale `AUDIT-2026-08-04.md` / `CONTENT-AUDIT-2026-08-05.md`
docs in the repo root — several of their findings were already fixed by prior
commits; this plan only lists what is still actually broken, verified against
the live files). Tasks are independent and bounded unless a "Requires:" line
says otherwise. Ordered by priority: correctness bugs first, then security/
tooling debt, then silent-failure UX, then accessibility/consistency, then
backend gaps and test coverage, then content depth.

- [x] 1. Fix garbled Makharij articulation-point labels
  `src/app/components/tajweed/MakharijDiagram.tsx:7-27` — the `LETTERS_BY_MAKHARIJ`
  object keys are corrupted strings (`'جddf'`, `'حhat'`, `'همهمه'`, `'ستلقلقل'`,
  `'شفتل'`, `'لسنل'`, `'مخرجين'`, plus several mixed Arabic+English fragments) and
  are rendered verbatim as the on-screen group heading at line 64
  (`<div className="font-semibold mb-3">{name}</div>`). This is core tajweed
  pedagogy showing nonsense text to learners. Replace the map with the correct
  classical five makharij groups and their letters: al-Jawf (الجوف: ا و ي madd
  letters), al-Halq (الحلق, three sub-points: أقصى الحلق ء ه, وسط الحلق ع ح,
  أدنى الحلق غ خ), al-Lisan (اللسان, multiple sub-points covering ق ك ج ش ي ض
  ل ن ر ط د ت ص ز س ظ ذ ث), ash-Shafatan (الشفتان: ف م ب و), al-Khaishum
  (الخيشوم: نون/ميم ghunnah). Use correct Arabic labels as keys (with an
  English gloss alongside, not concatenated into the key), and make sure every
  Arabic consonant appears in exactly the group(s) tajweed sources place it in.
  Verify: `grep -n "جddf\|حhat\|همهمه\|ستلقلقل\|شفتل\|لسنل\|مخرجين" src/app/components/tajweed/MakharijDiagram.tsx` returns nothing, and the object keys are valid standalone Arabic makharij names.

- [ ] 2. Fix Onboarding goal-selection gate that never blocks
  `src/app/components/onboarding/Onboarding.tsx` (goal-selection step) — the
  "Next" button's `disabled={!goal}` check can never fire because `goal`'s
  `useState` default is already `'all'`, so a learner can advance without ever
  choosing a goal, making the goal-selection UI decorative. Grep for the
  `useState` initializing `goal` and remove the default value (initialize to
  `''`/`null` instead) so the disabled gate is reachable, or make the default
  selection visibly pre-selected in the UI so the state matches what's shown.
  Verify: read the component, confirm the initial `goal` state requires a real
  user action before `Next` becomes enabled (either by inspecting the code path
  or `cd src/app && npm run dev` and manually clicking through onboarding without
  selecting a goal card — Next must stay disabled).

- [ ] 3. Fix unreachable path-assignment branch in scoring.ts
  `workers/src/lib/scoring.ts:74-91` — the comment at line 76 says "if literacy
  is moderate (40-70) but comprehension/grammar are lower, Path 2", but the
  branch at line 83 only runs when `weakestArea === 'literacy'`, which by
  definition of "weakest" means comprehension/grammar can never be lower than
  literacy inside that branch. A learner like
  `{literacy:45, comprehension:95, grammar:10, memorization:95}` has a
  catastrophically weak grammar score but literacy isn't the weakest area, so
  they silently fall through to the generic `return 'path2'` at line 91
  regardless of how weak grammar/comprehension actually are. Rewrite the
  function so any of the four module scores below a real low-threshold (not
  just literacy) can route to path1, and add/adjust a unit test in
  `workers/test/scoring.test.ts` covering this exact case.
  Verify: `cd workers && npx vitest run scoring` passes, including a new test
  asserting `{literacy:45, comprehension:95, grammar:10, memorization:95}`
  does not return `'path2'`.

- [ ] 4. Fix division-by-zero in tutor weak-areas calculation
  `workers/src/routes/tutor.ts:69-70` — `attempt.questions_correct /
  attempt.questions_answered` has no zero-guard. `questions_answered` can be 0
  (e.g. `workers/src/routes/learning.ts` writes a `quiz_attempts` row with
  `questions_answered = 0` when a learner posts `{}` with no answers to
  `POST /api/learning/lessons/:id/submit`), producing `NaN` that silently
  corrupts the `weakAreas` sort used to shape tutor chat context. Add a guard
  so a zero-answered attempt is skipped or treated as 0% rather than NaN.
  Verify: add a test in `workers/test/tutor-grounding.test.ts` (or nearest
  relevant file) seeding a `questions_answered = 0` attempt and asserting the
  computed rate/ordering has no `NaN`; `cd workers && npx vitest run` passes.

- [ ] 5. Validate onboarding payload before writing to D1
  `workers/src/routes/auth.ts:55-84` (`POST /api/auth/onboarding`) — `goal`
  is destructured from the request body with no validation, but `users.goal`
  is `NOT NULL` in the schema. Posting `{}` runs an `UPDATE ... SET goal = NULL`
  which SQLite rejects as a constraint violation, and the generic catch at
  line 82-84 turns that into a vague `{error: 'Internal server error'}` 500
  instead of a proper 400. Add validation (reject with 400 + a clear message
  when `goal` is missing/not a string) before the `db.run` call.
  Verify: add a test to `workers/test/routes.test.ts` posting `{}` to
  `/api/auth/onboarding` and asserting a 400 response with a descriptive
  error, not a 500; `cd workers && npx vitest run routes` passes.

- [ ] 6. Validate sentence body on /api/grammar/parse
  `workers/src/routes/grammar.ts:75-82` (`POST /api/grammar/parse`) —
  `sentence` is never validated; posting a valid-but-empty JSON body (`{}`)
  leaves `sentence` as `undefined`, and `parseArabicSentence(undefined)` throws
  inside `workers/src/lib/grammar-parser.ts` (`sentence.trim()`), caught by the
  route's generic catch and surfaced as a vague 500 instead of a 400. Add a
  check that `sentence` is a non-empty string before calling
  `parseArabicSentence`, returning 400 otherwise.
  Verify: add a test to `workers/test/routes.test.ts` posting `{}` to
  `/api/grammar/parse` and asserting 400, not 500; `cd workers && npx vitest run routes` passes.

- [ ] 7. Stop leaking internal error text on /api/auth/profile
  `workers/src/routes/auth.ts:48` and `:52` — the two catch blocks in the
  `GET /api/auth/profile` handler include `details: (error as Error).message`
  in the JSON response body. Every other route in `workers/src/routes/` returns
  just `{ error: 'Internal server error' }` on a 500 with no internal message
  leaked to the client. Remove the `details` field from both responses (keep
  logging the full error server-side via the existing `console.error` calls).
  Verify: `grep -n "details:" workers/src/routes/auth.ts` returns nothing; `cd workers && npx vitest run` still passes.

- [ ] 8. Use constant-time comparison for the shared bearer token
  `workers/src/index.ts:141` — the token-mode auth check compares
  `c.req.header('authorization') !== \`Bearer ${expected}\`` with a plain
  string `!==`, which is not constant-time and is a timing side-channel on the
  shared bearer token. Replace it with a constant-time comparison (e.g. compare
  UTF-8 byte lengths first, then use the Web Crypto `crypto.subtle` timing-safe
  approach available in Workers, or a small manual constant-time byte-compare
  helper — do not add a new npm dependency for this).
  Verify: `cd workers && npx vitest run` passes; a new/updated test in
  `workers/test/routes.test.ts` still confirms both a correct token succeeds
  and an incorrect one returns 401.

- [ ] 9. Fix broken ESLint tooling in src/app
  `src/app/package.json` declares `"eslint": "^8.57.1"` in devDependencies (and
  it's present in `package-lock.json`), but it is not actually present in
  `node_modules` — `npm run lint` (→ `next lint`) currently fails outright with
  "ESLint must be installed", and Next's build-time lint step silently no-ops
  during `npm run build` for the same reason. Investigate why `npm install`
  isn't landing eslint (check for a `postinstall`/prune script, an npm
  `omit=dev` config, or a corrupted lockfile entry) and fix it so
  `cd src/app && npm install && npm run lint` actually runs the linter against
  the real source tree. Fix any lint errors it then reports in files this
  plan's earlier tasks already touched; leave unrelated pre-existing lint
  warnings for a follow-up rather than fixing the whole codebase in this task.
  Verify: `cd src/app && rm -rf node_modules && npm install && npm run lint`
  runs ESLint successfully (no "must be installed" error) and exits 0 or with
  only pre-existing warnings, not the installation error.

- [ ] 10. Surface tutor chat send failures instead of failing silently
  `src/app/components/tutor/TutorChat.tsx` — a failed chat request only logs
  to `console.error`; the UI shows nothing, so the learner sees their message
  vanish with no feedback. Add a visible error state (an inline error bubble
  or banner) with a retry affordance, consistent with how `ExerciseRunner` and
  `AyahReader` handle fetch failures elsewhere in the app.
  Verify: `cd src/app && npm run dev`, open `/tutor`, temporarily point the API
  base at an unreachable URL (or stop the workers dev server) and send a
  message — confirm a visible error appears instead of a silently vanished
  message. `npx tsc --noEmit` in `src/app` still passes.

- [ ] 11. Distinguish "flashcards fetch failed" from "nothing due today"
  `src/app/components/learning/*Flashcard*` (grep `src/app/components/learning`
  for the flashcards component) — a failed fetch currently renders the same
  empty-state UI as "no cards due," which misleads the learner into thinking
  they're caught up when the request actually failed. Add a distinct error
  state (message + retry button) separate from the legitimate empty state.
  Verify: temporarily make the flashcards fetch call reject (e.g. throw in a
  local test edit, or stop the workers dev server) and confirm the UI shows an
  error state distinguishable from the "all caught up" empty state; revert any
  temporary test edit before committing.

- [ ] 12. Fix SurahProgress showing false 0% on fetch failure
  `src/app/components/memorization/SurahProgress.tsx` — a failed fetch
  currently renders as a 0% progress bar, which looks like real (bad) progress
  data rather than a failed request. Add an explicit error state that doesn't
  render the progress bar at 0% when the fetch itself failed.
  Verify: temporarily stop the workers dev server, load `/memorization`, and
  confirm SurahProgress shows an explicit error/retry state rather than a 0%
  bar; restart the dev server and confirm normal data still renders correctly.

- [ ] 13. Surface silent failures in AdvancedMemorizationTools
  `src/app/components/memorization/AdvancedMemorizationTools.tsx` — both the
  certificate-generation call and the "next ayah" fetch fail silently
  (console-only) with no visible feedback to the user. Add visible error
  states with retry affordances for both actions.
  Verify: `cd src/app && npm run dev`, open `/advanced`, trigger certificate
  export and the next-ayah lookup with the workers dev server stopped, and
  confirm both show a visible error instead of doing nothing.

- [ ] 14. Add back navigation to /root, /learning, /assessment
  Per the pattern documented on `PageHeader` ("for pages reached by exactly
  one in-app link and absent from the top nav"), three routes still lack a
  `backHref`: `src/app/components/read/RootStudy.tsx` has `Link href="/today"`
  back buttons only in its error branch (~line 134) and its post-mark-known
  branch (~line 188), but not in the default "just viewing a root" render path
  starting at line 142; `src/app/components/learning/LearningPage.tsx` (renders
  its own `<h1>` at line 225, no `PageHeader`/`backHref` at all — reached from
  Today's "Grammar lessons" card and Tutor's practice links); and
  `src/app/app/assessment/page.tsx` (two `PageHeader` calls at lines 41 and 61,
  neither passing `backHref`, despite `/assessment` being reached only from
  Onboarding and Progress's empty-state CTA — link back to `/today` or `/progress`
  respectively). Add `backHref`/`backLabel` consistent with how `/calibrate`,
  `/tajweed`, and `/advanced` already do it.
  Verify: `grep -n "backHref" src/app/components/read/RootStudy.tsx src/app/components/learning/LearningPage.tsx src/app/app/assessment/page.tsx` shows a `backHref` on every page-level render path, not just error/success branches.

- [ ] 15. Fix duplicate `<h1>` on /grammar, /learning, /assessment
  Three routes render two `<h1>` elements each: `PageHeader.tsx:39` already
  renders one `<h1>` for the page title, and the child view renders a second —
  `components/grammar/DeepDiveView.tsx:135`, `components/learning/LearningPage.tsx:225`,
  and `components/assessment/AssessmentResults.tsx:65`. Demote each child
  heading to `<h2>` (or remove it if it's purely redundant with the
  `PageHeader` title) so each page has exactly one `<h1>`.
  Verify: for each of `/grammar` (deep-dive tab), `/learning`, and `/assessment`
  (results view), confirm via `npm run dev` + browser devtools or
  `grep -c "<h1"` across the rendered component tree that only one `<h1>`
  exists per page.

- [ ] 16. Fix ReviewSession's inconsistent Arabic text markup
  `src/app/components/memorization/ReviewSession.tsx:84` uses the deprecated
  `.arabic-text` CSS class and is missing `lang="ar"` (it only has `dir="rtl"`),
  unlike every other Arabic-script element in the app (Today, AyahReader,
  RootStudy, Calibration, Flashcards, TutorChat, AssessmentFlow all pair `dir`
  with `lang="ar"` and use the current design-system font classes, not
  `.arabic-text`). Replace `.arabic-text` with the current `.text-naskh`/
  `font-arabic` styling used elsewhere and add `lang="ar"`.
  Verify: `grep -n "arabic-text" src/app/components/memorization/ReviewSession.tsx`
  returns nothing; `grep -n "lang=\"ar\"" src/app/components/memorization/ReviewSession.tsx`
  finds it; `node scripts/gen-design-system.mjs --check` still passes.

- [ ] 17. Add lang="ar" to Vocabulary tab components
  `src/app/components/vocabulary/RootCard.tsx:40`,
  `FunctionWordCard.tsx:29`, `WordDetail.tsx:65`, and
  `RootFamilyDetail.tsx:35,109` all render Arabic-script text with `dir="rtl"`
  and inline `fontFamily` styling but never set `lang="ar"`, inconsistent with
  the rest of the codebase's Arabic-text convention. Add `lang="ar"` alongside
  each existing `dir="rtl"` in these four files.
  Verify: `grep -L "lang=\"ar\"" src/app/components/vocabulary/RootCard.tsx src/app/components/vocabulary/FunctionWordCard.tsx src/app/components/vocabulary/WordDetail.tsx src/app/components/vocabulary/RootFamilyDetail.tsx` prints nothing (i.e. every file now contains `lang="ar"`).

- [ ] 18. Fix color-only status signaling in SurahProgress ayah grid
  `src/app/components/memorization/SurahProgress.tsx` — the per-ayah grid
  distinguishes mastered/learning/reviewing/new states only by background
  color, which fails for colorblind users and anyone on a low-quality screen.
  Add a non-color differentiator (e.g. a small icon, pattern, or text/
  `aria-label` per cell stating its status) alongside the existing color.
  Verify: inspect the rendered grid cells (`npm run dev`, `/memorization`) and
  confirm each cell exposes its status via something other than color alone
  (e.g. `aria-label` or visible glyph), and that a screen reader / browser
  accessibility inspector announces the status per cell.

- [ ] 19. Validate surahId route params consistently
  `workers/src/routes/tajweed.ts:14-25` and
  `workers/src/routes/memorization.ts:13-22` accept `surahId` path params
  without validating they're an integer in the valid 1-114 range — a
  non-numeric or out-of-range value currently returns an empty `data: []`
  with 200, inconsistent with `workers/src/routes/quran.ts:142-145`'s explicit
  "reject out-of-range before querying" pattern for the same kind of input
  elsewhere in the same codebase. Add the same range/type validation (400 on
  invalid) to both handlers.
  Verify: add tests to `workers/test/routes.test.ts` requesting
  `GET /api/tajweed/verses/abc` and `GET /api/memorization/surah/9999`,
  asserting 400 responses; `cd workers && npx vitest run routes` passes.

- [ ] 20. Validate recalledAyah on POST /api/memorization/:id/recall
  `workers/src/routes/memorization.ts:175` — `recalledAyah` is used unchecked
  (`recalledAyah === nextAyah`), silently grading a missing/malformed value as
  `'again'` instead of rejecting it with 400, unlike the sibling
  `POST /:id/review` endpoint which validates `grade` strictly (lines 103-105).
  Add the same strict validation style to `/recall`.
  Verify: add a test to `workers/test/routes.test.ts` posting a missing/
  malformed `recalledAyah` to `/api/memorization/:id/recall` and asserting a
  400 response; `cd workers && npx vitest run routes` passes.

- [ ] 21. Delete dead workers/src/lib/quran.ts module
  `workers/src/lib/quran.ts` is entirely dead code, self-documented as broken
  in its own header comment (nothing imports it), with a padding bug in
  `getAudioUrl`, a non-real Tanzil URL template, a wrong reciter code, and an
  unused `KVNamespace` constructor param with no KV binding declared anywhere
  in `wrangler.toml`. Delete the file and confirm nothing references it.
  Verify: `grep -rn "lib/quran'" workers/src/` (excluding the deleted file)
  returns nothing; `cd workers && npx tsc --noEmit && npx vitest run` both pass.

- [ ] 22. Remove dead getWeeklyProgress function
  `workers/src/routes/progress.ts:49-75` defines `getWeeklyProgress`, which is
  never called anywhere (leftover from the deleted `/dashboard` route per the
  comment at lines 42-46). Delete the function.
  Verify: `grep -n "getWeeklyProgress" workers/src/routes/progress.ts` returns
  nothing; `cd workers && npx tsc --noEmit && npx vitest run` both pass.

- [ ] 23. Add index on quran_word_gloss.arabic
  `workers/src/db/migrations/0014_word_glosses.sql` indexes `(surah_id,
  ayah_id)` and `english` but not `arabic`, even though `arabic` is queried
  with exact-match and prefix-`LIKE` in `workers/src/routes/tutor.ts` (hit on
  every tutor-chat lookup of a pasted word, `answerWord`) and in a correlated
  subquery in `workers/src/routes/learning.ts` (`vocabulary/start`'s `fromPlan`
  CTE) — both currently full-table-scan 77,429 rows. Add a new numbered
  migration (`workers/src/db/migrations/00NN_*.sql`, next number after the
  highest existing one) creating an index on `quran_word_gloss(arabic)`.
  Verify: `ls workers/src/db/migrations/` shows the new file with no gap/dupe
  in numbering; `node scripts/gen-db-types.mjs --check` passes;
  `cd workers && npx wrangler d1 migrations apply languagebuilder --local`
  applies cleanly.

- [ ] 24. Correct AGENTS.md's false rate-limiting claim
  `AGENTS.md:153` ("Rate limiting: 100 req/min per IP") and `:315` ("Rate
  limiting on API endpoints") describe a control that does not exist anywhere
  in `workers/src/` (confirmed: no rate-limiting code in the middleware chain
  in `workers/src/index.ts` or anywhere else). Either implement a minimal
  rate limiter (e.g. a simple per-IP counter backed by D1 or Cloudflare's
  built-in rate-limiting rules, scoped small) or — the smaller, safer option —
  correct AGENTS.md to state plainly that no rate limiting is currently
  implemented, removing the false claims. Prefer correcting the docs unless
  implementing a minimal limiter is truly small; do not attempt a complex
  distributed rate limiter in this task.
  Verify: `grep -n "Rate limiting" AGENTS.md` shows text that accurately
  reflects the current code (either "not yet implemented" or a description
  matching real code you added), not the old false "100 req/min" claim without
  backing.

- [ ] 25. Add test coverage for Access-JWT auth mode
  `workers/src/lib/identity.ts`'s `verifyAccessJwt` (lines ~51-71) has zero
  test coverage, and every one of the 290 existing tests runs exclusively in
  shared-bearer-token mode (`workers/test/helpers/harness.ts` hardcodes
  `env = { DB, API_TOKEN }` with no `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD`), so the
  production Cloudflare Access auth path (`workers/src/index.ts:93-130`) is
  entirely untested despite AGENTS.md calling it the mode production runs in.
  Add a test harness variant (or a new test file) that sets
  `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` and exercises both a valid and an invalid/
  missing Access JWT against a real route, asserting correct 200/401 behavior.
  Verify: `cd workers && npx vitest run` passes including the new test(s);
  `grep -rn "ACCESS_TEAM_DOMAIN" workers/test/` now returns matches.

- [ ] 26. Add route test for GET /api/progress/reading-queue
  `workers/src/routes/progress.ts` (`reading-queue` handler, ~line 209) has
  non-trivial SQL (three CTEs) and zero test coverage —
  `grep -rn "reading-queue" workers/test/` currently returns nothing. Add a
  test in `workers/test/routes.test.ts` that seeds minimal data and asserts
  a 200 with the expected shape, plus an auth-required check consistent with
  the other endpoints' coverage pattern in that file.
  Verify: `grep -rn "reading-queue" workers/test/routes.test.ts` finds the new
  test; `cd workers && npx vitest run routes` passes.

- [ ] 27. Add correctness tests for grammar-parser.ts
  `workers/src/lib/grammar-parser.ts` backs the live `POST /api/grammar/parse`
  endpoint but has no dedicated unit test — it's only indirectly touched by
  auth/malformed-body checks in `workers/test/routes.test.ts`, never asserting
  the actual parse output is correct. Add a new
  `workers/test/grammar-parser.test.ts` exercising `parseArabicSentence` and
  `checkGrammarErrors` directly against a handful of representative Arabic
  sentences, asserting the returned parse structure (particles, pronouns,
  verb detection) is correct for those inputs, so future edits to this file
  have a regression net.
  Verify: `cd workers && npx vitest run grammar-parser` passes with the new
  test file present and containing real assertions (not just "doesn't throw").

- [ ] 28. Add particle/pronoun/conjunction vocabulary to core-100
  `content/vocabulary/core-100.json` has 103 entries with 0 classified as
  particles, conjunctions, pronouns, or demonstratives (71 nouns, 6 verbs, 13
  adjectives, 5 participles, 7 prepositions, 1 proper noun) despite these word
  types making up 40-50% of Quranic text and being entirely absent. Add
  20-30 new entries for the most frequent Quranic particles/pronouns (e.g.
  و، مِن، إِلَى، عَلَى، فِى، الَّذِى، هُوَ، هِىَ، هُم، نَحْنُ، هَذَا، ذَلِكَ, and
  similar high-frequency function words), following the exact schema of
  existing entries (same fields, same sourcing conventions as the rest of the
  file — check `AGENTS.md`'s attribution requirements for any word data
  sourced from the licensed corpora).
  Verify: `node scripts/check-content.mjs` passes; `node scripts/check-vocab-imports.mjs` (if applicable) passes; a quick count shows particles/pronouns/conjunctions now present and non-zero in `content/vocabulary/core-100.json`.

- [ ] 29. Fix grammar lesson prerequisite sequencing
  `content/grammar/lessons.json` — `grammar-08` (Derived Verb Forms, level 3)
  currently only requires `grammar-04` (Present Tense), letting a learner reach
  verb forms via 01→02→04→08 without ever taking `grammar-05` (Case Endings),
  even though `grammar-11` (Balagha, level 3) explicitly requires `grammar-05`.
  Add `grammar-05` as a prerequisite of `grammar-08` (case endings are
  foundational to understanding derived verb forms), keeping the DAG acyclic.
  Verify: `node scripts/check-pedagogy.mjs` passes (reachability check still
  holds); `node scripts/gen-lessons-sql.mjs --check` passes; manually confirm
  in the JSON that `grammar-08`'s `prerequisites` array now includes
  `"grammar-05"`.

- [ ] 30. Add estimated_minutes and richer rules to root lessons
  `content/grammar/root-lessons.json` — none of the 408 generated root lessons
  have an `estimated_minutes` field (all 11 authored lessons in
  `content/grammar/lessons.json` do), and each root lesson's `rules` field is
  a single generic "Words on X" entry versus authored lessons' structured,
  named rules. Add a computed/estimated `estimated_minutes` value (base it on
  the number of examples/exercises the lesson already has, consistent with how
  authored lessons' minutes roughly scale with content volume) to every root
  lesson, and expand each `rules` entry into 2-3 more specific, corpus-grounded
  statements about the root's pattern (not hand-authored grammar claims —
  derive them from data already present in the lesson, e.g. its part-of-speech
  distribution or example count).
  Verify: `node scripts/check-content.mjs` and `node scripts/check-pedagogy.mjs`
  both pass; a quick check (`grep -c "estimated_minutes"
  content/grammar/root-lessons.json`) shows 408 occurrences; regenerate the
  seed via `node scripts/gen-lessons-sql.mjs` and confirm
  `--check` passes afterward.
