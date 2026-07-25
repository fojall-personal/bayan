# Language Builder — Full Code Audit

**Date:** 2026-07-25
**Scope:** `src/app` (Next.js frontend), `workers/` (Cloudflare Workers API), `content/`, `scripts/`, CI/CD
**Method:** read every source file; built the frontend; typechecked both projects; computed the route
reachability graph; cross-checked every SQL statement against `schema.sql`; cross-checked every
`fetch()` against the handler that serves it; inspected the *built* CSS and JS bundles.

Live URLs could not be probed from this environment (the network policy 403s `pages.dev` and
`workers.dev`), so every runtime claim below is derived from source plus build output, not an HTTP
check. Anything marked **[needs live confirm]** should be verified against the deployed site.

---

## 1. What the app is trying to be

From `PLAN.md`: a single integrated platform for Classical Arabic + Quran, filling a gap no
competitor covers — (1) Arabic script literacy assessment, (2) nahw/sarf/balagha grammar,
(3) hifz with comprehension tracking, (4) adaptive paths driven by a diagnostic test.

The intended shape:

| Pillar | Intended behaviour |
|---|---|
| Diagnostic assessment | 30–45 min, 4 modules, ~60 questions, **audio recording** for literacy (read 20 words aloud) and memorization (recite 5 surahs) → weighted composite (0.20/0.30/0.25/0.25) → path assignment |
| Adaptive learning | Lessons + exercises + flashcards, path1/2/3 curricula with week-by-week focus |
| Memorization | SM-2 spaced repetition, surah progress, next-verse recall, audio self-review |
| Progress | Dashboard, streaks, weekly goals, score-history charts |
| Phase 2 | Tajweed colour-coding by rule, makharij diagrams; grammar deep-dive with sentence parsing + conjugation tables |
| Phase 3 | AI tutor (chat explanations, adaptive question generation, feedback on recordings), advanced memorization, teacher/parent mode |

Explicit non-negotiables stated in the plan: **no fake metrics, no placeholder stats**, every screen
has a clear next action, Arabic line-height 2.0, tajweed colours functional not decorative,
design tokens as the single source of truth.

`PLAN.md` / `AGENTS.md` / `README.md` currently mark Phases 0, 1 and 2 ✅ COMPLETE and Module 08 ✅.

## 2. Honest status against that plan

| Module | Marked | Actual |
|---|---|---|
| 00 scaffolding | ✅ | Real. Routes, components, Workers project all exist. |
| 01 DB + data layer | ✅ | Schema exists but **contradicts the queries written against it** (§4). Content is ~2–5% of spec. |
| 02 Assessment engine | ✅ | 7 hardcoded questions, no audio, non-adaptive canned result text. Question bank on disk unused. |
| 03 Learning engine | ✅ | Lesson delivery works; **grading is broken end to end** — every lesson scores 0% (§5.1). |
| 04 Memorization tracker | ✅ | **No UI to add an entry, and the insert/update/query SQL all reference columns and tables that don't exist.** Non-functional. |
| 05 Dashboard + onboarding | ✅ | **There is no `/dashboard` route and no `/onboarding` route.** Both components exist as dead code. |
| 06 Tajweed | ✅ | Mastery endpoint works. Verse rendering depends on a table that was never created. |
| 07 Grammar deep-dive | ✅ | Parser + conjugations real. Deep-dive ignores its own `category` param — nahw/sarf/balagha return identical content. |
| 08 AI tutor + advanced | ✅ | **Not AI.** A keyword `if/else` returning 5 canned strings. Audio "testing" scores any input over 5 characters as correct. |

The gap isn't laziness — the feature surface is genuinely broad and mostly written. The problem is
that **nothing was ever exercised end to end against a real database**, so layer boundaries drifted
apart while every individual file looked finished.

---

## 3. Blocker: the frontend and the backend are not connected in production

23 call sites fetch relative paths (`/api/progress/dashboard`, `/api/learning/next`, …). The
frontend deploys to Cloudflare Pages as a **static export** (`next.config.js: output: 'export'`).
Nothing maps `/api/*` on the Pages origin to the Worker: no `_worker.js`, no `_routes.json`, no
Pages Function, no rewrites (static export ignores them anyway), no Worker route on the Pages
hostname.

The only file naming the Worker is `src/app/app/api/auth/verify/route.ts`, and the static export
discards it — the build marks it `ƒ (Dynamic)` and the emitted `out/` contains **no `api`
directory at all** (verified). So every data request lands on the static host and returns
`404.html`. **[needs live confirm]**

Second half of the same problem: components read `process.env.NEXT_PUBLIC_API_TOKEN`, which
`deploy.yml` never sets and no committed `.env` defines. It compiles to a runtime `undefined` — the
shipped bundle sends `Authorization: Bearer undefined`.

**Fix:** one shared API client reading `NEXT_PUBLIC_API_URL` (set in CI), CORS on the Worker. Better
long-term: custom domain, site on the apex, Worker route on `/api/*` — same-origin, no CORS, no
token in the bundle. Note a `NEXT_PUBLIC_*` bearer token is public by construction; treat it as a
soft gate, not a secret.

---

## 4. The database layer contradicts the code written against it

These are hard 500s on first call, not edge cases. Every one is a mismatch between
`workers/src/db/schema.sql` and the SQL in the routes.

1. **`lesson_progress` has no `user_id` column** (`schema.sql:28`, PK is `lesson_id` alone), but six
   queries filter on it: `progress.ts:34,53,136,149,170`, `tutor.ts:35`. → `/api/progress/dashboard`
   (the entire Module 05 dashboard) and `/api/tutor/chat` always 500.
   As a side effect lesson progress is **global, not per-user** — incompatible with the planned
   teacher/multi-student mode. Same flaw in `vocabulary_mastery` (`word` alone is the PK, `schema.sql:70`).
2. **`memorization` has no `interval` or `ease_factor` column**, but `memorization.ts:73` inserts
   both and `:127` updates both. → `POST /api/memorization/add` and `POST /api/memorization/:id/review`
   always 500. The SM-2 implementation has nowhere to persist its state.
3. **`memorization.id` is `INTEGER PRIMARY KEY AUTOINCREMENT`** but `memorization.ts:75` inserts
   `crypto.randomUUID()`. Datatype mismatch even after fixing (2).
4. **Table `quran_verses` is never created**, but `tajweed.ts:48` and `memorization.ts:229` select
   from it — with *different column names for the same imagined table*
   (`text_uthmani/text_simple` vs `verse_text/verse_simple`). → `/api/tajweed/verses/:surahId` and
   `/api/memorization/review/today` always 500.
5. **Blob into integer PK:** `tutor.ts:83,92` and `grammar.ts:99` insert `randomblob(16)` into
   `INTEGER PRIMARY KEY AUTOINCREMENT` columns. → tutor chat and grammar exercise submission 500.
6. **No `users` row is ever created by any code path.** The seed script doesn't create one; auth
   hardcodes `test-user-1` (`index.ts:57`). Every user-scoped read 404s and every FK insert fails.
   This is the documented "`/api/auth/profile` returns 500" bug — the root cause is that the app has
   no user-provisioning step at all.
7. **`tutor.ts:31`** — `SELECT * FROM assessment_results ORDER BY completed_at DESC LIMIT 1` passes
   `[userId]` with **zero placeholders** → D1 "wrong number of parameter bindings". Also missing its
   `WHERE user_id = ?`, so it would read across users.
8. **`schema.sql` is not idempotent** despite `CREATE TABLE IF NOT EXISTS` everywhere — the
   `tajweed_rules` seed at `:137` is a bare `INSERT`, so re-running the file fails on duplicate PKs.
9. **`learning.ts:111-118`** — filtering by `level` without `module` produces
   `SELECT * FROM lessons AND level = ?`, a syntax error.
10. Minor schema hygiene: `spaced_repetition` has both `due_date` and `next_review` (both NOT NULL,
    redundant); `idx_lesson_progress_user` indexes `lesson_id`, which is already the PK (redundant,
    and misleadingly named); no index on `assessment_results(user_id)`, `quiz_attempts(user_id)`, or
    `memorization(next_review)` despite all three being hot filters; `certificate.ts:51` reads
    `user.name`, a column that doesn't exist, so certificates are always "Student".

**Nothing typechecks this.** `npx tsc --noEmit` in `workers/` reports **69 errors**; `wrangler deploy`
uses esbuild and does no typechecking, and no CI job touches the Worker at all. The frontend is
clean (0 errors).

---

## 5. Cross-layer contract breaks

These will bite the moment §3 is fixed, so fix them in the same pass.

1. **Lesson grading can never pass.** `LearningPage.tsx:110` sends
   `answers: [{index, answer}, …]` (array of objects). `learning.ts:209` evaluates
   `answers[i] === exercise.correct` — object vs scalar, always false. On top of that, seeded
   multiple-choice content stores `correct` as an **index** (`"correct":2`) while the frontend sends
   the option **text**. Every lesson scores 0%, and 0% < 70% means no lesson ever completes — which
   in turn means the streak, weekly progress, and "next lesson" logic can never advance. `match`
   exercises are hardcoded `isCorrect = true` (`learning.ts:214`).
2. **Assessment completion shows `NaN%`.** `AssessmentFlow.tsx:193` calls
   `onComplete(data.data)` — shape `{id, level, path, composite_score, …}` — into
   `app/assessment/page.tsx`, which immediately renders `<AssessmentResults result={…}>`. That
   component expects the full DB row and computes
   `literacy_score*0.20 + …` → `NaN%`, plus "Invalid Date" and a blank learning path. Currently
   masked because `res.ok` is false (§3).
3. **Path shown ≠ path assigned.** `scoring.ts:67` picks the path from weakest-area + composite and
   stores it in `users.current_path`. `AssessmentResults.tsx:40` re-derives it from `level`
   (`advanced→path3`, else `intermediate→path2`, else `path1`). The two disagree. `assessment_results`
   doesn't persist `path` at all.
4. **`/advanced` reads the wrong envelope.** `AdvancedMemorizationTools.tsx:26,57` reads
   `data.data?.due`; `memorization.ts:235` returns `{ due }`. Optional chaining swallows it, so the
   audio test always reports "No ayahs due" and can never start. `app/memorization/page.tsx:63`
   reads the same endpoint correctly — the two callers disagree with each other.
5. **`/api/assessment/start` is a stub** returning `total_questions: 60, estimated_minutes: 30`
   (`assessment.ts:19-26`, comment still says "will be populated in Module 2"). Nothing consumes it,
   and the number contradicts the 7 questions actually asked.
6. **Scores are client-computed and trusted.** `assessment.ts:33` stores whatever
   `literacy_score`… the client posts, unvalidated and unclamped.
7. **`memorization/add` has no caller.** No UI anywhere creates a memorization entry, so even after
   §4.2 is fixed the tracker has no data-entry path. `POST /:id/recall` likewise unreachable.

---

## 6. Design system: two parallel systems, and the live one is partly broken

1. **No webfonts load on the deployed site.** `globals.css:15` puts the Google Fonts `@import`
   *after* `@tailwind base/components/utilities`. In the built CSS the `@import` lands at character
   offset 26,422, after 392 style rules. Per spec, an `@import` following a style rule is invalid and
   **ignored by the browser** — so IBM Plex Sans, Scheherazade New, Amiri and IBM Plex Mono all fall
   back to generic system families. For a Quran app that means the Arabic letterforms and diacritic
   rendering are entirely at the mercy of the OS default, and `--font-arabic`, `.arabic-text`,
   `.text-arabic`, `leading-arabic` all resolve to `serif`. **[needs live confirm]** — trivially
   checked in devtools → Network → Font.
   *Fix:* move the `@import` above `@tailwind base`, or better, `next/font/google` (self-hosted,
   not render-blocking).
2. **Reem Kufi is never requested at all.** `tailwind.config.ts` maps `font-display` → Reem Kufi and
   `Nav.tsx:32` sets `fontFamily="'Reem Kufi', serif"` on the SVG wordmark, but Reem Kufi is absent
   from the `@import` list. The newest commit (`55e02c7`, the Bayan wordmark) ships in generic serif.
   Note also the mental-model slip in `ba85a9d`: `font-arabic` is Scheherazade/Amiri — **not** Reem
   Kufi — which is why `app/page.tsx:168` renders the English H2 "What's your goal?" in an
   Arabic-first serif.
3. **The Bayan logo SVG is clipped.** `viewBox="0 0 140 36"` but the bottom bowl path draws to
   `y=38` with `strokeWidth="6"` (`Nav.tsx:24`) — the bottom of the B is cut off below the viewBox.
4. **Every `<ProgressBar>` renders with no fill.** `ProgressBar.tsx:16` builds
   `` `bg-${color}-500` `` — Tailwind can't see dynamic class names, and the default `arabic-green`
   isn't in the palette anyway (it's `primary`). Confirmed: `bg-arabic-green*` appears **0 times** in
   the built CSS. Same root cause makes `Badge variant="success"` unstyled
   (`bg-arabic-green/20 text-arabic-green-400`, `Badge.tsx:12`). Ironic against the plan's
   "progress indicators use green, not generic blue" — right now they're nothing.
   In `AssessmentResults.tsx:129` two of four score bars work (`primary`, `secondary` exist) and two
   don't (`info`, `success` are flat colours, not scales); the local `colorClasses` map there is dead
   code.
5. **The CSS component layer is dead.** `globals.css` defines `.btn-primary`, `.btn-secondary`,
   `.btn-ghost`, `.card`, `.card-interactive`, `.progress-bar`, `.nav`, `.nav-item`, `.input`,
   `.badge`, `.stagger` and calls itself "source of truth for all visual tokens" — and **none of
   them is used by any reachable component** except `.card` in one place. `Button`/`Card`/
   `ProgressBar`/`Badge` re-implement the same styles in inline Tailwind. Two divergent design
   systems is the mechanical reason visual consistency keeps drifting and why DESIGN.md claims don't
   hold.
6. **Contrast:** `Button` primary is `bg-primary-500 text-white` (`Button.tsx:23`) — white on
   `#22c55e` is ≈2.3:1, below WCAG AA 4.5:1. `app/page.tsx:196` correctly uses `text-gray-950` for
   the same button style; the shared component should match.
7. **Hardcoded off-token colours** in `app/progress/page.tsx:83-104` (`bg-green-500`,
   `bg-purple-500`, `bg-blue-500`, `bg-orange-500`). RESUME.md's "zero hardcoded colours" claim is
   true only for *hex literals*.
8. `globals.css` re-declares `.text-tajweed-*` utilities that Tailwind already generates from the
   `tajweed` palette — duplicate, conflicting sources for the same class.

---

## 7. Placeholders presented as finished features

Each of these contradicts the plan's own "no fake metrics, no placeholder stats" rule.

1. **The AI tutor is a keyword matcher.** `tutor.ts:210-231` — five `msg.includes(...)` branches
   returning canned paragraphs. No Workers AI binding, no model call. `POST /api/tutor/feedback`
   (`:162`) returns a fixed string with the comment "In production, this would compare audio
   recordings".
2. **Audio testing awards points for typing.** `AdvancedMemorizationTools.tsx:47` —
   `const correct = userAnswer.trim().length > 5`. No audio is played anywhere; Module 08's
   "audio-based testing (no text visible)" is neither.
3. **Cross-references are an `alert()`.** `AdvancedMemorizationTools.tsx:69-82` builds a `refs`
   array, never uses it, and alerts a description of what the feature would do.
4. **The seed script fabricates two of its four success messages.** `scripts/seed-db.ts:40-56` reads
   the assessment and tajweed JSON, counts the items, prints
   `✅ Seeded N assessment questions` / `✅ Seeded N tajweed rules` — and **writes nothing**. It also
   can't run as documented: line 61 does `new Database((globalThis as any).DB)`, which is undefined
   under `npx tsx`.
5. **Vocabulary is seeded to the wrong user.** `seed-db.ts:13` hardcodes `user_id = 'fouad'`; auth
   always resolves `test-user-1`. Flashcards will be permanently empty even after a successful seed.
6. **The weekly calendar tracks nothing.** `app/progress/page.tsx:145` renders the current week and
   highlights today, with no activity data behind it — a progress widget that implies tracking it
   doesn't do.
7. **Dead buttons:** `AssessmentResults.tsx:117-118` "Continue to Learning" and "Retake Assessment"
   have no `onClick`. And because `app/assessment/page.tsx:35` returns results whenever they exist,
   **retaking the assessment is impossible** once one result is stored.
8. **The canned recommendation.** `AssessmentFlow.tsx:228` — "we recommend starting with foundational
   skills and progressing to advanced comprehension" — is fixed text shown regardless of scores, on
   the screen whose entire purpose is adaptivity.

---

## 8. Content: correctness and volume

The volume gap is worth naming plainly, because the roadmap treats content as done:

| Plan | On disk |
|---|---|
| 1000 most frequent Quranic words | **10** (`content/vocabulary/core-100.json` — the filename overstates its own contents 10×) |
| 30 lessons (nahw, sarf, balagha) | **5** (`content/grammar/lessons.json`) |
| ~60 assessment questions | **18** in `content/assessments/placement-test.json` — and that file **is never loaded**; the app uses 7 questions hardcoded in `AssessmentFlow.tsx:40-134` |

Three substantive Arabic errors, which matter more than the volume for a teaching app:

1. **`AssessmentFlow.tsx:72-78`** — "What does الرَّحْمَٰنِ الرَّحِيمِ mean?" is keyed to
   *"The Merciful, The Forgiving"*. الرحيم is "the Merciful"; "the Forgiving" is الغفور. The correct
   answer ("the Entirely Merciful, the Especially Merciful") is not among the options — so the app
   teaches a wrong gloss of the second-most-recited phrase in the Quran.
2. **`AssessmentFlow.tsx:110`** — the distractors label Form II as فَاعَلَ and Form III as فَعِّلَ.
   These are swapped and malformed: Form II is فَعَّلَ, Form III is فَاعَلَ. The keyed answer
   (Form I) is right, but the options teach wrong morphology. The same error is repeated in
   `tutor.ts:218`.
3. **`tutor.ts:217,243`** — matches on `'سرف'`. Sarf is **صَرْف** (ṣād, not sīn), so the branch can
   never fire on correctly spelled input. `'بلاغه'` at `:244` should be بلاغة (tā' marbūṭa).

Also `workers/src/lib/quran.ts` (67 lines, **never imported**) would not work if wired up:
`getAudioUrl` computes `` `${surah}${ayah}`.padStart(6,'0') `` — concatenating *then* padding, so
surah 1 ayah 1 becomes `000011`; the islamic.network CDN indexes by global ayah number (1–6236).
`TANZIL_BASE + /quran-${surah}.json` is not a real Tanzil endpoint. The reciter code
`ar.abdulbasitmurataq` should be `ar.abdulbasitmurattal`. The constructor accepts a KV namespace and
never uses it — and there's no KV binding in `wrangler.toml`, despite README/AGENTS.md both listing
KV in the stack.

---

## 9. Structural hygiene

1. **Dead code: 17 files, ~1,144 LOC unreachable from any route.** Verified by transitive import
   closure from all 11 route entrypoints:
   `Dashboard.tsx` (235), `Onboarding.tsx` (230), `AudioPlayer.tsx` (89), `Sidebar.tsx` (79),
   `useAudioRecorder.ts` (55), `LessonCard.tsx` (54), `MobileNav.tsx` (54), `Navbar.tsx` (53),
   `QuizQuestion.tsx` (52), `MemorizationEntry.tsx` (46), `Select.tsx` (35), `StatCard.tsx` (33),
   `Skeleton.tsx` (31), `useLocalStorage.ts` (30), `EmptyState.tsx` (24), `Input.tsx` (23),
   `AppShell.tsx` (21).
   This is the same trap AGENTS.md already documents — but the list there is 4 files; it's actually
   17. Note what's in it: the **dashboard**, the **onboarding flow**, the **audio player** and the
   **audio recorder** — i.e. three of the plan's headline capabilities exist only as orphans.
   Worker-side: `QuranService`, `calculateReviewSchedule`, and `verifyAuth` (imported at
   `index.ts:2`, never called; it also reads `process.env`, which doesn't exist in the Workers
   runtime) are all dead, plus unused imports at `assessment.ts:13`.
2. **No `/dashboard` or `/onboarding` route exists.** `/` is goal-selection (onboarding step 1 of a
   promised 4) and it **discards the selected goal** — `app/page.tsx:183` stores it in local state
   and links to `/assessment` without persisting it. `POST /api/auth/onboarding` exists on the
   Worker and has no live caller.
3. **Nav exposes 4 of 9 routes.** `/tajweed`, `/grammar`, `/tutor`, `/advanced` are unreachable by
   clicking (already logged as BUG-004). No active-link state (BUG-003).
4. **Zero tests.** No Vitest, no Playwright, no `__tests__`, despite AGENTS.md §Testing Strategy
   specifying unit, integration and E2E suites. No ESLint config either, so `npm run lint` prompts
   for setup.
5. **No `error.tsx`, `loading.tsx`, or `not-found.tsx`** anywhere in `app/`. Combined with (6) below,
   any API failure renders a blank region.
6. **Silent failure is the default.** `app/learning/page.tsx:26` only sets `user` when `res.ok`;
   with `user` null, `{view === 'lesson' && user && <LearningPage/>}` (`:77`) renders **nothing** —
   no error, no retry, no empty state. That is the documented "Learning Page Content Not Rendering"
   bug: it isn't a rendering bug, it's an unhandled fetch failure. `app/assessment/page.tsx:25` and
   `app/progress/page.tsx:37` swallow errors the same way.
7. **Cross-request state in the Worker.** `index.ts:20` keeps `currentUser` in a module-level
   variable set per request. That's isolate-wide state shared across concurrent requests — harmless
   at one user, a genuine data-leak bug the moment there are two. `c.set()`/`c.get()` on the Hono
   context is the drop-in fix.
8. **Debug endpoint and logging left in.** `/api/debug/user` (`index.ts:67`) is live in production,
   and `index.ts:58` logs the resolved user on every request.
9. **Secrets.** `workers/wrangler.toml:5` commits `API_TOKEN = "dev-token-change-in-production"` in
   `[vars]` — deployed as a plaintext var, and a var overwrites a same-named secret on deploy, so
   `wrangler secret put API_TOKEN` won't stick while that line exists. `index.ts:49` also falls back
   to that literal. Separately, **`workers/.dev.vars` is tracked in git** (`.gitignore` covers
   `.env`/`.env.*` but not `.dev.vars`) and contains `lb-2b60b71f…` — rotate it and add the ignore
   rule.
10. `scripts/seed-lessons-local.js:15` builds SQL by string interpolation, against AGENTS.md's own
    "parameterized queries, no string interpolation" standard.
11. `next.config.js` uses ESM `export default` without `"type": "module"`; Node re-parses it and
    warns on every build. One-line fix.
12. `deploy.yml:36` uses `cloudflare/pages-action@v1`, which is deprecated in favour of
    `cloudflare/wrangler-action@v3` with `pages deploy`.
13. Docs contradict the code in ways that will keep misleading future sessions: `AGENTS.md:285-305`
    lists endpoints that don't exist (`/api/tajweed/analyze`, `GET /api/tutor/chat`,
    `GET /api/memorization/review`) and omits ones that do (`/api/learning/next`,
    `/api/certificate/export`, `/api/grammar/*`); `PLAN.md:580-583` marks Phase 2 complete and then
    re-lists modules 03–05 as unchecked; `README.md` and `AGENTS.md` both claim KV and shadcn/ui,
    neither of which is present.

---

## 10. Suggested order of work

Grouped so each stage produces something verifiable, rather than more green builds over broken paths.

**Stage 1 — make one request work end to end.**
Pick `GET /api/auth/profile`. Create the `users` row (migration or a real seed step); add
`NEXT_PUBLIC_API_URL` + a single shared `apiFetch()` helper; set the token in CI; add CORS.
Success = the browser on `pages.dev` renders a profile. Everything downstream is guesswork until
this passes.

**Stage 2 — reconcile schema and queries (§4), then typecheck in CI.**
Add `user_id` to `lesson_progress` and `vocabulary_mastery` (composite PKs); add `interval` and
`ease_factor` to `memorization` and fix its `id` type; create `quran_verses` (settle on one column
naming) or delete the two routes that read it; fix the `randomblob` PK inserts; make `schema.sql`
idempotent; fix `tutor.ts:31`'s binding count and `learning.ts:111`'s SQL. Then add
`tsc --noEmit` for `workers/` to CI so the 69 errors can't come back — plus a `wrangler deploy` job,
since the Worker currently ships with no automation at all.

**Stage 3 — fix the contracts (§5) and add failure states (§9.5–9.6).**
Settle the answer format for lesson grading and hold both sides to it; give `AssessmentResults` the
full row (or a documented DTO); align the `/advanced` envelope. Add `error.tsx` and real error/empty
states so the next failure is visible instead of blank.

**Stage 4 — design system truth (§6).**
Move the font `@import`; add Reem Kufi; fix `ProgressBar`/`Badge` to use static classes; fix the
logo viewBox; fix the button contrast. Then pick one system — CSS component classes *or* Tailwind
utilities in the primitives — and delete the other.

**Stage 5 — delete or wire the dead code (§9.1), and make the docs match reality (§9.13).**
Deciding `Dashboard.tsx` and `Onboarding.tsx`'s fate — route them or delete them — is what turns
Module 05 from "✅" into either done or honestly not-started. Reset the phase checkboxes to what
§2 shows.

**Stage 6 — content (§8).**
Fix the three Arabic errors first; they're small and they're the ones that teach something wrong.
Then load `placement-test.json` instead of the hardcoded 7 questions, and decide whether audio
assessment is in or out of scope — if in, `useAudioRecorder.ts` and `AudioPlayer.tsx` are already
written and waiting.

**A process note.** The recurring pattern in this repo is that a module is marked ✅ once the code
compiles and deploys green, without a single request having been run against the real database.
AGENTS.md already learned half this lesson for UI ("a green deploy is not proof a visual fix
landed"). The same rule earns its keep on the backend: **one verified round trip per endpoint before
the checkbox** would have caught almost every §4 and §5 finding at the moment it was introduced.
