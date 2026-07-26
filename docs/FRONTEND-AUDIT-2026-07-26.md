# Frontend Audit — 2026-07-26

**Audited:** 2026-07-26. **Resolved:** 2026-07-26, same day, in the review-and-fix
pass below.
**Scope:** All routes, navigation links, interactive features
**Method:** Code review + curl tests + browser verification

> **Status: all 12 findings closed.** This document is kept as the record of what
> was wrong and what fixing it actually turned up — three of the twelve were
> misdiagnosed, and the real defects underneath were worse than the symptoms.

---

## Executive Summary

**10 routes exist**, all rendering 200 OK. `/advanced` is now linked, so 11 nav
destinations resolve.
**3 features were significantly broken.** All three now work end to end.

The three headline items were each diagnosed from the symptom rather than the
cause, and the corrections matter more than the original findings:

| Finding as filed | What was actually wrong |
|---|---|
| #1 Flashcard meanings hardcoded | The ternary was real but **unreachable**. Nothing ever INSERTed into `vocabulary_mastery` — only an UPDATE existed — so the queue was permanently empty and the tab always showed its empty state. Fixing meanings alone would have changed nothing visible. |
| #2 Tajweed Reader is a placeholder | Wiring the viewer was not enough. `TajweedViewer` was **not usable as found**: only 2 of 18 rules resolved to a colour, and its renderer put marks on the wrong letters. |
| #5/#6 Audio is fake, viewer orphaned | Audio was **not blocked** on Quran Foundation credentials as assumed. Keyless per-ayah CDNs work. There were also **two** fake audio handlers, not one. |

---

## Routes Audit

| Route | Renders | Status |
|-------|---------|--------|
| `/` | Goal selection | Working |
| `/dashboard` | Stats, progress | Working |
| `/assessment` | Flow or results | Working |
| `/learning` | Lessons, flashcards | Working |
| `/memorization` | Surahs, due today, **add ayah** | Working |
| `/grammar` | Deep-dive | Working |
| `/tajweed` | **Colour-coded reader**, makharij, mastery | Working |
| `/tutor` | Chat interface | Working (keyword matcher) |
| `/progress` | Score history | Working |
| `/advanced` | Audio test, cert | Working, **now in the nav** |

---

## Resolved findings

### 1. Flashcard meanings — fixed, and the real cause was worse

The hardcoded ternary over ten words (printing the literal string `"Meaning"` for
anything else) is deleted. But it was never reachable: **nothing inserted into
`vocabulary_mastery`.** Three changes were needed, not one:

- Migration `0011` adds a `vocabulary` **content** table. `vocabulary_mastery` is
  per-user progress and has no meaning column, which is why meanings had nowhere
  to live.
- `content/vocabulary/core-100.json` went from **10 entries to 103** — it was
  named for 100 and held 10, and those 10 were exactly the ternary's cases.
  `scripts/gen-vocabulary.mjs` generates the seed SQL and refuses to emit on a
  missing meaning, a duplicate word, or a "word" containing no Arabic.
- `POST /api/learning/vocabulary/start` is the way in. Without it the tab stays
  empty no matter what the content table holds.

Also replaced the flashcard scheduler, which computed
`quality >= 4 ? 2^(q-1) : q >= 3 ? 2 : 1` from the **quality alone**, ignoring the
stored interval and ease factor — so `ease_factor` and `interval_days` were never
read or written, and a word answered "OK" on its fiftieth review still came back
in two days. Now uses the same tested `applySM2` as memorization. Five quality-3
reviews give 2, 3, 4, 5, 6 days instead of 2, 2, 2, 2, 2.

### 2 & 6. Tajweed reader — fixed, after fixing the component itself

`TajweedViewer` was described here as "fully functional". It was not.

- **Only 2 of 18 rules had a colour.** The annotations use 18 rule names;
  `tajweed_rules` held 6 taught categories, and only `ghunnah` and `qalqalah`
  share a name. Al-Fatiha contains *neither*, so the default view would have
  rendered entirely uncoloured. Fixed with a rule → category map
  (`workers/src/lib/tajweed-colors.ts`) and migration `0010` for the four
  categories that had no row. Coverage: **60,057 of 60,057**.
- **The renderer put marks on the wrong letters.** `highlightTajweed` read
  `substring(start, end + 1)` though `end` is exclusive, so every mark covered
  two characters instead of one; and it used `result.replace(word, …)`, which
  rewrites the *first* match anywhere in the ayah — all three `hamzat_wasl` tags
  in 1:1 landed on the first ٱ, nested three deep, leaving the real 2nd and 3rd
  unmarked. It also mutated the string it was scanning. Replaced with
  codepoint-accurate `segmentVerse()` (`src/app/lib/tajweed-render.ts`, 15 tests).
  `dangerouslySetInnerHTML` is gone from both call sites.

Added a surah picker backed by `src/app/lib/surahs.ts`, whose ayah counts are
counted from the pinned text rather than typed by hand.

### 3. Memorization add-UI — fixed

`AddAyahForm` calls the endpoint that already worked. The endpoint had **no
validation** and would accept surah 999, ayah 0, `ayahFrom > ayahTo`, floats and
numeric strings; it now validates server-side too, because the bearer token ships
in the JS bundle so anything that can load the form can post around it. The upper
ayah bound is read from `quran_verses` rather than a second copy of 114 numbers.

### 4. `/advanced` unreachable — fixed

Added to `LINKS` in `Nav.tsx`.

### 5. Audio was fake — fixed, and it was never blocked

Both fakes are gone: `ReviewSession`'s 3-second `setTimeout` and
`TajweedViewer`'s 5-second one (only the first was filed). One real
`AyahAudioButton` backed by `everyayah.com`, which needs no credentials.
Verified playing: 6.03s of audio with `currentTime` advancing.

### 7–12. Polish — all closed

| # | Issue | Resolution |
|---|-------|-----------|
| 7 | Dashboard quick actions use `<a>` | `next/link` |
| 8 | Progress uses `window.location.href` | `router.push` — and the same defect in `Onboarding` and `AssessmentResults`, which were not filed |
| 9 | Weekly calendar is static UI | Still static — it renders real dates but no activity data. **Deliberately left**; see below |
| 10 | ReviewSession record button uses emoji | Removed. It said "🎤 Record Recitation" but only advanced the step; relabelled to match what it does |
| 11 | `StatCard` hardcoded gray colours | Still present — cosmetic, see below |
| 12 | `MakharijDiagram` prop never passed | Letters are buttons now, so the highlight state is reachable |

---

## Found later, after this audit

Two more issues surfaced when the assessment was actually used, both of a class
this audit did not test for:

- **Text direction.** `AssessmentFlow.tsx:149` and `TutorChat.tsx:109` forced
  `direction: rtl` whenever a string contained any Arabic, so mixed
  English/Arabic sentences were reordered and their trailing `?` moved to the
  left. Fixed with `dir="auto"`. See docs/CONTENT-AND-CORPUS-2026-07-26.md §3.
- **Arabic legibility.** Amiri sits small on the em, which reads as cramped in
  running UI text. Noto Naskh Arabic now carries instructional Arabic; Amiri
  stays for ayat.

And the content itself had factual errors the audit did not check — five in the
first grammar lesson alone. `scripts/check-content.mjs` now gates them in CI.

## Deliberately not done

- **#9 weekly calendar** and **#11 StatCard colours** are cosmetic and need design
  decisions rather than fixes.
- **Self-recording.** `useAudioRecorder.ts` was deleted rather than wired. It was
  broken: `stopRecording()` built its Blob synchronously right after calling
  `MediaRecorder.stop()`, but the final `ondataavailable` fires afterwards and —
  with no timeslice — is the only one, so it always returned an **empty Blob**.
  Microphone capture cannot be verified in a headless environment, so removing it
  beat shipping an unverifiable rewrite. Whoever builds this should not repeat the
  synchronous-stop mistake.
- **wrangler 3 → 4.** A major bump on the deploy path, deferred rather than
  landed without room to validate a rollback.
- **The tutor is still a keyword matcher.** Its redesign depends on the
  morphology corpus (now loaded, 77,429 rows) and is a feature, not a fix.

## Still open elsewhere

**Cloudflare Access is not enabled.** `GET /api/auth/whoami` reports
`mode: "shared-token"`, and the token is inlined into the JS bundle — so anyone
with the URL can read it from page source and call the API. This is the largest
remaining risk and it is not a frontend issue; it needs an Access-scoped
Cloudflare token and an email allowlist.

---

## Orphaned components

Down to **zero**. `QuizQuestion.tsx` (duplicated markup now inline in
`LearningPage`), `AudioPlayer.tsx` (superseded by `AyahAudioButton`) and
`useAudioRecorder.ts` were deleted — 196 lines. `TajweedViewer` and `Select` are
now used.

ESLint reports **zero findings**; the two long-standing `exhaustive-deps` warnings
were resolved with `useCallback` rather than silenced.
