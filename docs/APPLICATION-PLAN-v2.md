# Language Builder / Bayan — Application Plan v2

**Date:** 2026-07-25
**Supersedes:** the roadmap and feature sections of `PLAN.md` (kept for history)
**Companion:** `docs/CODE-AUDIT-2026-07-25.md` — verified current state

v1 of the plan was written before any code existed and was never revised against
what got built. It marked eleven modules complete while six endpoints returned
500 and the frontend could not reach the backend at all. This version starts from
measured state, checks each intended feature against a real data source and a
real cost, and says plainly what is in, what is out, and why.

---

## 1. What is actually true today

Measured 2026-07-25 against a local D1 with the schema applied and the user row
seeded (Stage 1 of the audit remediation, commit `8ef0dc8`):

**Working — 11 of 19 endpoints return 200:** auth profile, assessment submit and
results, progress scores, learning lessons and flashcards, memorization surahs,
tajweed rules and mastery, grammar mastery and conjugations, certificate export,
tutor history.

**Broken — 4 root causes, confirmed by D1's own error text:**
`no such column: user_id` (`lesson_progress` never had one), `no such table:
quran_verses` (referenced twice, never created), `table memorization has no
column named interval`, `Wrong number of parameter bindings` (`tutor.ts:31`).

**Content:** 10 vocabulary words in a file called `core-100.json`, 5 lessons,
18 assessment questions that nothing loads (the app asks 7 hardcoded ones).

**Honest module status:** scaffolding, tajweed mastery tracking, grammar
conjugation tables and the scoring algorithm are real. Assessment is a stub.
Learning delivers content but grades everything 0%. Memorization has no
data-entry path. Dashboard and onboarding exist only as unrouted files. The "AI
tutor" is a five-branch keyword matcher.

**Deployment:** frontend on Cloudflare Pages via GitHub Actions; Worker deployed
by hand. Both now typecheck in CI. Total cost $0 — everything fits free tiers.

---

## 2. The competitive premise, re-tested

v1's thesis was "no existing platform integrates reading assessment + classical
grammar + hifz + adaptive paths." As an integration claim that still holds. But
each pillar in isolation is now well served, and one of them has moved out of
reach:

| Pillar | State of the art, mid-2026 | Implication |
|---|---|---|
| Recitation correctness | Tarteel ships real-time mistake detection — ~3 years of R&D on 75,000+ curated minutes, word-level tajweed flagging, premium tier | **Do not build.** Cannot be matched by a solo project. |
| Hifz scheduling | Quranly is a dedicated memorisation planner | Buildable; commodity. FSRS makes it competitive. |
| Grammar curriculum | Bayyinah TV is a full video curriculum, alphabet → advanced balagha | Don't compete on curriculum breadth. |
| Content depth | Quran.com / Quran Foundation APIs | Consume, don't rebuild. |

The 2026 review consensus is that serious learners run **two apps** — one for
recitation correction, one for hifz tracking — and get their grammar from a
separate course. Nobody links them.

**The defensible niche is the link, not the pillars.** Specifically: *memorise
with the grammar and vocabulary of the thing you are memorising, and track
comprehension separately from recall.* Tarteel has no grammar. Bayyinah has no
hifz tracking. Quranly has no comprehension model. That gap is real, and — this
is the important part — closing it is a **data and scheduling problem**, not a
machine-learning problem. It is achievable by one person on a free tier.

This reframes the product: not "an all-in-one Quran app" but **the layer that
makes hifz and comprehension reinforce each other.**

---

## 3. Pedagogical spine

Features should fall out of the dependency order of the skill, not from a
feature-parity checklist.

```
  script + vowels  ──►  high-frequency vocabulary  ──►  morphology (sarf)
   (decoding)              (~80% coverage from            (templatic patterns
        │                   the top ~500 words)            unlock words at scale)
        │                                                        │
        │                                                        ▼
        │                                                  syntax (nahw)
        │                                                   (i'rab, structure)
        ▼                                                        │
     tajweed  (production, runs parallel — not a                  ▼
               comprehension prerequisite)              rhetoric (balagha)
```

Two consequences the v1 plan missed:

1. **Tajweed is not on the comprehension path.** v1 put tajweed in the placement
   test's grammar module and in Path 1 week 13. It belongs on its own parallel
   track, because a learner can comprehend without producing and vice versa.
2. **Morphology before syntax, and both before rhetoric.** Arabic is templatic;
   pattern recognition is the highest-leverage single skill. v1's Path 3 put
   balagha in week 1.

And the central design decision:

> **Vocabulary and grammar drills are drawn from the ayahs the learner is
> currently memorising** — not from a generic frequency list. This is the
> mechanism that makes hifz and comprehension reinforce each other rather than
> compete for study time.

---

## 4. Data sources — researched, with licences

Every feature below is costed against a real source. This section is what v1
lacked: it listed "Quran.com API + Tanzil.net" and then wrote code against a
fabricated endpoint.

| Need | Source | Licence / access | Notes |
|---|---|---|---|
| Uthmani text | Tanzil.net, **pinned copy** | Tanzil terms | Must use the `quran-uthmani.txt` bundled with the tajweed repo — Tanzil's encoding changed and the annotation offsets are indexed against the April 2017 file. |
| Tajweed rules | [`cpfair/quran-tajweed`](https://github.com/cpfair/quran-tajweed) | **CC-BY-4.0** (data) | `output/tajweed.hafs.uthmani-pause-sajdah.json`. 15 rules — ghunnah, 5 idghaam variants, 2 ikhfa, iqlab, 5 madd categories, qalqalah, hamzat al-wasl, lam shamsiyyah, silent — as `{rule, start, end}` **Unicode codepoint** offsets. |
| Morphology / i'rab | [Quranic Arabic Corpus](https://corpus.quran.com/download/) v0.4 | **GNU GPL**, attribution + link to corpus.quran.com required | Root, lemma, POS, form, case for every word. ⚠️ GPL — see risk R3. |
| Word-level audio timing | Quran Foundation API `segments=true`; or [`cpfair/quran-align`](https://github.com/cpfair/quran-align) | API: OAuth2. quran-align: pre-generated releases | `[word_index, start_ms, end_ms]`. Enables word highlighting and "listen → recall". |
| Translation, tafsir, reciter audio | Quran Foundation (Quran.com) API v4 | **OAuth2 client credentials** — `x-auth-token` + `x-client-id` | Registration required. |
| Scheduling algorithm | FSRS | Open source | See §5. |
| LLM + STT | Cloudflare Workers AI | 10,000 neurons/day free, then $0.011/1k | 60+ models incl. Whisper and current LLMs (Qwen3, GLM-4.7-Flash, Llama). |

Three findings here overturn existing code:

- **The Quran API is no longer anonymous.** `workers/src/lib/quran.ts` calls
  `api.quran.com/api/v4` with no credentials; it would 401. The secret must stay
  server-side, so **the Worker must be the Quran proxy and cache** — the browser
  cannot call the content API directly. That is an architectural requirement, not
  a detail.
- **Tajweed does not need to be computed.** The current plan implies deriving
  rules; a CC-BY dataset already has all 15, verified, with exact offsets. Ship
  the data, delete the derivation.
- **Grammar does not need a hand-written parser.** `grammar-parser.ts` (270
  lines) is a hand-rolled approximation of a corpus that already exists with full
  morphological annotation for every word in the Quran.

---

## 5. Algorithm decision: FSRS over SM-2

The current `space-repetition.ts` is labelled SM-2 but is a simplified
approximation — quality 3 never decreases ease, quality 4 never changes it, and a
quality-3 review multiplies a 1-day interval by 1.2 and rounds back to 1 day, so
it can never advance.

Benchmarks against 500M+ Anki review logs show FSRS beating SM-2 on predictive
accuracy for ~99.5% of users and needing **20–30% fewer reviews for the same
retention**. Caveat worth recording: that efficiency figure comes from
simulation, not a controlled trial, and SM-2 was never designed to output
probabilities, so the comparison is partly unfair to it.

**Decision: FSRS**, for a reason specific to this app rather than the benchmark —
hifz review load is the binding constraint on a learner's day. A 20% reduction at
equal retention is 20% more time for comprehension work, which is the whole
premise of §2. Store scheduler state per item (`stability`, `difficulty`,
`reps`, `lapses`, `last_review`, `due`) so the algorithm can be re-fit later
without losing history.

Two separate schedules per ayah, deliberately: **recall** (can you reproduce it)
and **comprehension** (do you know what it means). They decay at different rates
and conflating them is what makes hifz-without-understanding the default.

---

## 6. Feature set

### 6.1 In — v1 core loop

**F1. Reader.** Word-by-word Uthmani text; tap a word for root, lemma, POS, form
and case from the corpus; tajweed colouring from the CC-BY dataset; reciter audio
with word-level highlight from the timing segments. *This is the centre of the
app — every other feature reads from or writes to it.*

**F2. Hifz tracker (FSRS).** Add a range, review, self-rate. Separate recall and
comprehension schedules. Surah-level progress. **Requires a UI to add an entry —
absent today, which is why the module has no data.**

**F3. Vocabulary SRS, scoped to the hifz plan.** Words are enrolled from the
ayahs the learner is memorising, ordered by frequency across the whole Quran, so
effort spent memorising also buys the highest-leverage vocabulary. The §3
mechanism, and the app's single most differentiating feature.

**F4. Generated comprehension checks.** Built from corpus annotation rather than
hand-authored: identify the root; pick the form; which word carries this case;
match word → meaning in this ayah. Generation from data is what makes coverage of
6,236 ayahs possible for one author — hand-writing 18 questions was the v1
approach and it does not scale.

**F5. Diagnostic placement — text-only, honest.** 15–20 minutes across decoding,
vocabulary, morphology and syntax, adaptive by difficulty. **No audio module.**
It measures what it can measure and says so; v1 claimed a 30–45 minute test with
recorded read-aloud and shipped 7 multiple-choice questions.

**F6. Tajweed track.** Rule reference, colour-coded reader mode, per-rule
practice, mastery from `tajweed_practice` (already working). Parallel to the
comprehension path, per §3.

**F7. Progress.** Dashboard on a route (not an orphaned file), streaks from real
activity, per-domain score history, weekly load forecast from FSRS due counts.
No widget that implies tracking it does not do.

### 6.2 In — v2

**F8. Grounded explanations (Workers AI).** An LLM that answers "why is this word
`majrūr`?" **with the corpus record for that word in its context**, and cites it.
Retrieval-grounded and verifiable — not the free-associating chatbot v1 called an
AI tutor. Guard rails: refuse when the corpus has no annotation for the word
rather than inventing one.

**F9. Morphology pattern drills.** Given a root, produce or recognise Forms I–X;
generated from corpus data, which has form labels for every verb.

**F10. Self-recording.** Record, play back against a reciter, self-rate. Explicit
non-goal: automatic correctness. Feeds the FSRS recall schedule via self-rating.

### 6.3 In — v3

**F11. Balagha.** Curated, hand-authored, ~30 examples. Last, per §3, and the one
place where hand-authoring is the right call because the corpus does not annotate
rhetoric.

**F12. Cross-surah thematic links.** Requires a theme dataset that does not yet
exist — scope only after F1–F10 land.

**F13. Certificate.** Already mostly works. Needs a `users.name` column, which it
reads today and which does not exist.

### 6.4 Out — and why

| Feature | Decision | Reason |
|---|---|---|
| **Recitation ASR / mistake detection** | **Out** | §2. Three years and 75k curated minutes to match. Use Tarteel. This is the single biggest scope reduction versus v1, which had it in the placement test *and* Modules 04 and 08. |
| Teacher mode, multi-student, parental controls | Out until real accounts exist | v1 promised these while auth resolved every request to one hardcoded id. Chasing them is how `lesson_progress` and `vocabulary_mastery` ended up without `user_id`. |
| Monetization tiers, institutional pricing | Out | The app is single-user and self-hosted. Pricing pages for a product with one user are fiction. |
| Community, leaderboards, forum, study groups | Out | Needs a user base; also needs moderation nobody has time for. |
| Hand-written Arabic parser | **Deleted** | Superseded by the corpus. |
| Generic 1000-word vocabulary list | Replaced by F3 | Frequency scoped to the hifz plan beats a static list. |
| Durable Objects | Out | v1 specified them for SRS scheduling. D1 plus a `due` column is sufficient; DO adds a moving part for no gain at this scale. |
| KV | Out for now | Listed in the stack, never bound. When Quran-content caching needs it (F1), add it deliberately. |

---

## 7. Data model changes

Do these **before** more data accrues — the cost of adding `user_id` rises with
every row.

1. **`lesson_progress`**: add `user_id`; PK → `(user_id, lesson_id)`. Fixes
   `/api/progress/dashboard`, `/api/learning/next`, `/api/tutor/chat`.
2. **`vocabulary_mastery`**: PK `word` → `(user_id, word)`. Two users currently
   cannot know the same word.
3. **`memorization`**: add FSRS state (`stability`, `difficulty`, `reps`,
   `lapses`, `last_review`, `due`); `id` → `TEXT` (code inserts a UUID into an
   `INTEGER PRIMARY KEY`). Add the separate comprehension schedule from §5.
4. **`quran_verses`**: create it, once, with one column naming — the two routes
   that read it currently assume different names. Loaded from the pinned Tanzil
   text + tajweed annotations + corpus morphology.
5. **`users`**: add `name` (the certificate already reads it).
6. **Blob PKs**: `tutor_conversations`, `tutor_topic_history`,
   `grammar_exercises` insert `randomblob(16)` into `INTEGER PRIMARY KEY`. Use
   `TEXT` + UUID.
7. **Drop the duplicate** `due_date`/`next_review` pair on `spaced_repetition`;
   index `memorization(user_id, due)`, `assessment_results(user_id)`,
   `quiz_attempts(user_id)`.
8. **Make the schema idempotent** — the `tajweed_rules` seed is a bare `INSERT`,
   so re-running `schema.sql` fails.

Adopt real migrations (`workers/src/db/migrations/NNN_*.sql`, applied in order,
recorded in a `schema_migrations` table). A single mutable `schema.sql` is how the
schema and the queries drifted apart unnoticed.

---

## 8. Roadmap

Each stage ends with a check that exercises the running system. Stages 1–6 are
the audit's remediation order; 7+ is new capability. **No stage is "done" on a
green build** — that rule is what produced eleven false ✅s.

| Stage | Work | Done when |
|---|---|---|
| **1 ✅** | Frontend↔Worker wiring, user row, CORS, fail-closed auth, CI typecheck | `GET /api/auth/profile` returns the user row through the deployed site. *Verified locally; awaiting secrets for remote.* |
| **2** | §7.1–7.3, 7.6, 7.8 + `tutor.ts:31` binding + `learning.ts:111` SQL | All 19 endpoints return non-5xx against a seeded DB |
| **3** | Lesson-grading contract; assessment result DTO; `error.tsx` | Submit a lesson, see a real score; kill the API, see an error not a blank |
| **4** | Font `@import` order, Reem Kufi, `ProgressBar`/`Badge` static classes, logo viewBox, button contrast; pick one design system | Fonts load in devtools; progress bars visibly fill; contrast ≥ 4.5:1 |
| **5** | Delete or route the 17 orphans — decides Module 05's real status; reset `PLAN.md` checkboxes | No unreachable component; docs match code |
| **6** | Fix the 3 Arabic content errors; load `placement-test.json`; ingest pinned Tanzil + tajweed + corpus | Reader renders an ayah with correct morphology and tajweed from the DB |
| **7** | F1 Reader, F2 hifz + FSRS, F3 scoped vocabulary | Memorise an ayah; its words appear in the vocabulary queue |
| **8** | F4 generated checks, F5 placement, F7 progress | Placement assigns a path; dashboard shows real numbers |
| **9** | F6 tajweed track, F8 grounded explanations, F9 pattern drills | Explanation cites the corpus record; refuses when unannotated |
| **10** | F10 recording, F11 balagha, F13 certificate | — |

Stages 2–6 are debt paydown on work already marked complete. That is the honest
cost of eleven premature checkboxes, and it is cheaper to pay now than after
F1–F13 are built on top of it.

---

## 9. Definition of Done

Extends the UI rule already in `AGENTS.md` — a green deploy is not proof a visual
fix landed — to the backend, where it was missing.

A feature is done when:

1. **One real request round-trips.** Not a passing build. Not a green Actions
   run. An actual request against a real database returning the expected body.
2. **The failure path renders.** Break the API and confirm the user sees a
   message, not a blank region. The "learning page not rendering" bug was an
   unhandled fetch failure that looked like a rendering bug for two days.
3. **The file is reachable.** Trace the import chain from a route. 17 files
   currently fail this.
4. **Types check.** Both projects, in CI. Non-negotiable now that it is wired.
5. **Content is verified by a competent reader.** §10 R4.
6. **The claim matches the code.** If a step is a placeholder, the docs say
   placeholder. `seed-db.ts` printing `✅ Seeded 18 assessment questions` while
   writing nothing cost more trust than the missing feature did.

---

## 10. Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Scope collapse under solo maintenance.** v1 planned 12 modules across 3 pillars for one part-time developer, and the result was breadth marked complete over a backend that could not serve a request. | **High** | The §6.4 cuts are the mitigation. Ship F1–F3 fully before F4. |
| R2 | **Quran API OAuth blocks content ingestion.** Registration may be slow or terms may not fit. | Medium | Text, tajweed and morphology all come from static licensed files. Only translation/tafsir/audio need the API — degrade to text-only rather than block. |
| R3 | **Corpus is GPL.** Morphological annotation is GNU GPL with attribution; the repo is private "all rights reserved". | Medium | Keep corpus data as a **data file**, not linked code, and attribute with a link to corpus.quran.com as required. Get advice before any distribution. Fallback: [QuranMorph](https://www.researchgate.net/publication/392941154_QuranMorph_Morphologically_Annotated_Quranic_Corpus) or Quran Foundation word-by-word. |
| R4 | **Content errors teach falsehoods.** Already shipped: الرحيم glossed "the Forgiving" (that is الغفور) with the correct answer absent from the options; Form II/III patterns swapped in two places; `سرف` for صرف. | **High** | This is a religious-education app — a wrong gloss is worse than a missing feature. No hand-authored Arabic ships without review by a competent reader. Prefer generated-from-corpus (F4) over hand-authored wherever possible. |
| R5 | **Tanzil encoding drift** silently misaligns every tajweed offset. | Medium | Pin the bundled April-2017 text; checksum it in CI; assert a known annotation lands on the expected codepoints. |
| R6 | **Workers AI free tier (10k neurons/day)** exceeded by F8. | Low | Cache explanations by `(word, ayah)` — the corpus record is deterministic, so the same question has the same answer. Cache hit rate should be high. |
| R7 | **Public bearer token.** `NEXT_PUBLIC_API_TOKEN` ships in the bundle by construction. | Medium | Accepted for single-user self-hosting; the API is read-mostly and holds no PII. Revisit before any second user. Rotate the token committed in `.dev.vars`. |
| R8 | **FSRS mis-tuned on sparse data**, giving bad intervals early. | Low | Use published default parameters until there are enough reviews to fit; store raw review logs so it can be re-fit retroactively. |

---

## 11. Open questions

Ones where the answer changes the build, rather than v1's list of things nobody
needed to decide:

1. **Is this for one user or eventually many?** Everything in §6.4 and §7 hinges
   on it. Building for one is legitimate and much cheaper — but say so, because
   half-building for many is what produced the current schema.
2. **Which mushaf and qira'ah?** The plan assumes Hafs — the tajweed dataset is
   Hafs-only. Anything else means new data.
3. **How much daily time is the app designed for?** FSRS load balancing needs a
   target. v1 said "15–30 minutes" in the UX section and set weekly targets of 5
   lessons and 10 reviews elsewhere, which are different numbers.
4. **Does recitation correctness matter enough to reverse R1?** If yes, the
   answer is still "use Tarteel alongside," not "build ASR."
5. **Is distribution ever intended?** Determines whether R3's GPL question is
   theoretical or blocking.

---

## Sources

- [Quranic Arabic Corpus — data download and licence](https://corpus.quran.com/download/)
- [Morphological Annotation of Quranic Arabic (LREC 2010)](https://aclanthology.org/L10-1190/)
- [`cpfair/quran-tajweed` — 15 rules, CC-BY-4.0](https://github.com/cpfair/quran-tajweed)
- [`cpfair/quran-align` — word-accurate timestamps](https://github.com/cpfair/quran-align)
- [Quran Foundation API — chapter reciter audio, `segments`](https://api-docs.quran.foundation/docs/content_apis_versioned/4.0.0/chapter-reciter-audio-file/)
- [Quran Foundation API — OAuth2 client credentials](https://api-docs.quran.foundation/docs/tutorials/oidc/getting-started-with-oauth2/)
- [Quran Foundation API — Uthmani tajweed script](https://api-docs.quran.foundation/docs/content_apis_versioned/quran-verses-uthmani-tajweed/)
- [FSRS vs SM-2 — comparison](https://deepwiki.com/open-spaced-repetition/fsrs-optimizer/7.3-comparison-with-sm-2)
- [FSRS benchmark discussion](https://supermemopedia.com/wiki/SuperMemo_dethroned_by_FSRS)
- [Cloudflare Workers AI — models](https://developers.cloudflare.com/workers-ai/models/)
- [Cloudflare Workers AI — pricing and free allocation](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Tarteel — mistake detection](https://tarteel.ai/blog/introducing-mistake-detection/)
- [The Tarteel Dataset](https://openreview.net/forum?id=TAdzPkgnnV8)
- [Best Quran apps 2026 — comparison](https://www.getnafs.com/blog/quran-apps-comparison-2026/)
- [Tarteel vs Quranly](https://www.quranly.app/blog/tarteel-vs-quranly-comparison)
- [Bayyinah TV — Arabic curriculum](https://explore.bayyinahtv.com/arabic/)
