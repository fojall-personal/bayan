# Language Builder / Bayan — Application Plan v2

**Date:** 2026-07-25
**Supersedes:** the roadmap and feature sections of `PLAN.md` (kept for history)
**Companion:** `docs/CODE-AUDIT-2026-07-25.md` — the original audit, left unedited as the record of how things stood
**Blocked work:** `docs/HANDOFF-LOCAL-SESSION.md` — steps a cloud session cannot do
**Audience:** decided 2026-07-25 — a small group of close friends, non-commercial (§4)
**Budget:** decided 2026-07-25 — $0/month, treated as a hard constraint (§5)

v1 of the plan was written before any code existed and was never revised against
what got built. It marked eleven modules complete while six endpoints returned
500 and the frontend could not reach the backend at all. This version starts from
measured state, checks each intended feature against a real data source and a
real cost, and says plainly what is in, what is out, and why.

---

## 1. What is actually true today

**Revised 2026-07-25 after Stages 1–6.** The version of this section written
before that work described a backend that could not serve a request; it is
superseded by what follows. `docs/CODE-AUDIT-2026-07-25.md` holds the original
measurements and is left unedited as the record of how things stood.

Measured against a local D1 with all nine migrations applied and content seeded,
served through the production path (`_worker.js` on a single Pages origin):

**All 36 endpoints resolve.** A sweep returns no 5xx. The six that used to fail —
`/api/progress/dashboard`, `/api/learning/next`, `/api/memorization/review/today`,
`/api/tajweed/verses/:surahId`, `POST /api/tutor/chat` and
`POST /api/memorization/add` — were failing on four schema defects, all fixed by
migrations 0002–0009. One question outstanding: `/api/auth/whoami` answers through
`wrangler dev` but 404s through `wrangler pages dev`; see the handoff §3.

**The core loop closes.** A lesson can be answered and graded (it scored 0%
unconditionally before, so nothing could ever complete), completion is sticky with
a best-score, and `/api/learning/next` advances. The 18-question placement
assessment runs end to end and assigns a path that is stored and displayed rather
than re-derived.

**Quality gates exist.** 39 unit tests, both projects typechecking, and ESLint —
all three enforced in CI ahead of deploy. None of them existed before; the Worker
alone had 69 type errors that nothing was checking.

**Content is still the thin part:** 10 vocabulary words, 5 lessons, 18 assessment
questions, and **0 Quran verses**. The ingest script is written and gated but needs
a file this environment cannot fetch (handoff §4). The morphology corpus, which
F4/F8/F9 depend on, is likewise unreachable (handoff §5).

**Honest module status:**

| Module | State |
|---|---|
| 00 scaffolding | Real. One origin, migrations, CI gates. |
| 01 data layer | Schema now matches its queries. Content volume is the gap. |
| 02 assessment | Works end to end on the real 18-question bank. No audio module, by decision (§8.4). |
| 03 learning | Grading, progression and streaks work. 5 lessons is not a curriculum. |
| 04 memorization | Scheduler and API work; **no UI adds an ayah**, so still unusable. The largest gap between "marked complete" and "usable". |
| 05 dashboard | Routed at `/dashboard` and rendering real data for the first time. |
| 06 tajweed | Mastery works. Verse rendering waits on the text ingest. |
| 07 grammar | Parser and conjugations work. Deep-dive still ignores its `category` param. |
| 08 AI tutor | Still a five-branch keyword matcher. Its redesign is blocked on the corpus, not on a model. |

**Deployment:** one Pages origin serving both the static export and the API.
**Nothing is live yet** — CI is red on a missing `API_TOKEN` secret and the remote
database has no migrations applied. Total cost remains $0.

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

## 4. Audience and identity — decided

**Decided 2026-07-25: a small group of close friends. Not a commercial product.**

This was the load-bearing open question, and answering it settles several things
that were previously hedged. "Half-building for many users" is exactly what
produced the current schema; so is building for one and bolting on the rest later.
Neither is now necessary.

### What it settles

| | Decision |
|---|---|
| Scale | Order of 5–50 people, known to each other and to the operator |
| Accounts | **Real per-user identity, required.** Not a shared login. |
| Data visibility | **Private by default.** Nobody sees anyone else's progress unless they opt in. |
| Commercial features | Still out — pricing, tiers, conversion funnels have no meaning here |
| Teacher/admin features | Still out — a peer group has no teacher role |
| Operational stance | Other people's data now. Loss and downtime cost trust, not just time. |

Privacy default is deliberate: memorisation progress is personal, and "close
friends" is not a reason to make it visible by default. Sharing, if it ever
happens, is opt-in (§8.3, F14).

### Identity: use Cloudflare Access

The current design — one shared bearer token, inlined into the JS bundle,
resolving every request to a hardcoded `test-user-1` — cannot support this. With
several users it is worse than imperfect: everyone shares one identity, so all
progress commingles into one row set, and the bundled token lets any user read and
write any other's data.

Writing a conventional auth system (registration, password hashing, reset emails,
verification) is a disproportionate amount of security-sensitive code for a group
of friends. **Cloudflare Access** is the right answer:

- **Free for up to 50 seats, permanently** — matches the audience exactly. Beyond
  50 it is $7/user/month for all users, which would be the signal to reconsider.
- Handles login itself (Google, GitHub, or one-time e-mail PIN — the last needs
  nothing from the user but an inbox).
- Passes identity to the origin as a signed JWT in `Cf-Access-Jwt-Assertion`,
  plus `Cf-Access-Authenticated-User-Email`.
- Verification is ~30 lines in the Worker: `jose`'s `jwtVerify` +
  `createRemoteJWKSet` against `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`,
  checking the policy audience. **Validate the JWT — do not trust the e-mail
  header alone.**
- No passwords stored, no e-mail to send, no reset flow, no PII beyond an address.
- Adding a friend is adding an e-mail to an Access policy.

**Consequence: one origin is required.** Access cookies are per-hostname, so a
site on `pages.dev` calling an API on `workers.dev` would need the browser to
carry an Access session across two origins. The free way to satisfy this is to
fold the API into the Pages project as a Pages Function — see §5, Change 1. (An
earlier draft called for a custom domain here; that is void, because it costs
money.)

**Provisioning becomes just-in-time.** On the first authenticated request, upsert a
`users` row from the JWT's e-mail. `seed-user.sql` stays for local development,
where there is no Access in front.

**Fallback if Access proves too fiddly:** issue a per-user opaque token by hand,
map token → `user_id` in D1, store it in `localStorage`. Also free. No login flow,
but tokens leak, get shared, and are revoked by hand. Acceptable for five people;
not for fifty.

---

## 5. Hard constraint: $0/month

**Stated 2026-07-25: this must be free. Not "cheap" — free.**

Treated as a design constraint with veto power, not a preference. Two things in
the previous draft failed it and have been changed.

### The ledger

Projections assume **20 users** at a genuinely active ~200 requests/day each.

| Service | Free allowance | Projected at 20 users | Headroom |
|---|---|---|---|
| Pages (static hosting) | Unlimited requests, 500 builds/mo | ~30 builds/mo | Vast |
| Pages Functions / Workers | 100,000 req/day | ~4,000/day | **25×** |
| D1 storage | 5 GB | Full Quran + morphology + tajweed ≈ 30–60 MB | **~100×** |
| D1 rows read | 5,000,000/day | ~50 rows × 4,000 req ≈ 200,000/day | **25×** |
| D1 rows written | 100,000/day | reviews + progress, low thousands | **>20×** |
| R2 | 10 GB, egress always free | D1 exports, a few hundred MB | Vast |
| KV | 100k reads/day, 1k **writes**/day | Quran content cache — read-heavy, rarely written | Fine; the write cap is the one to watch |
| Cloudflare Access | **50 seats, permanent** | 20 | 2.5× |
| Cron Triggers | Included; 3 per Worker on free | 1 (nightly export) | Fine |
| Workers AI | **10,000 neurons/day, shared across all users** | F8 only | **The one real ceiling** |
| Custom domain | — | **not required** (see below) | — |
| **Total** | | | **$0** |

Everything except Workers AI has at least an order of magnitude of headroom. The
plan is not close to any cliff, and the binding limits would be reached by user
count long before any single user's activity.

### Change 1: no custom domain — fold the API into the Pages project

The previous draft made a custom domain a *requirement*, because Access cookies
are per-hostname and the site and API sat on different origins. A domain costs
money, so that requirement is void.

**Cloudflare Access can protect `*.pages.dev` directly.** In Zero Trust →
Access controls → Applications, create a self-hosted app, delete the wildcard from
the Subdomain field, save, then re-enable the access policy in the Pages project.
Keeping the `*` protects only preview deployments — protect **both**, or the
preview URLs stay open.

Protecting the Worker's `workers.dev` hostname is, by contrast, not
dependably supported. So rather than pay for a domain to unify two origins,
**collapse to one origin: deploy the Hono app as a Pages Function in the same
project.**

```
  languagebuilder-frontend.pages.dev/*        →  static export
  languagebuilder-frontend.pages.dev/api/*    →  functions/api/[[route]].ts  (Hono)
  one Access application over the whole hostname
```

Hono supports this natively — `handle` from `hono/cloudflare-pages`, exported as
`onRequest`. **The nine route files do not change at all**; only the entry point
does. D1 and R2 bind via Pages → Settings → Bindings and arrive as `c.env.DB`
exactly as now.

This is better than the paid option on four counts beyond price:

- Same origin — no CORS, and no bearer token in the bundle.
- One deploy instead of two, which retires "the Worker is deployed by hand and CI
  doesn't ship it."
- Access covers pages and API in one session.
- No DNS to own or renew.

Honest trade-offs: Access on `pages.dev` is fiddly to configure and easy to get
half-right (the preview-URL gap above). Cloudflare is also steering new projects
toward Workers Static Assets rather than Pages, so expect a migration eventually —
same runtime, so it is a packaging change, not a rewrite. **Keep one small
standalone Worker** for the nightly D1 export, since Pages Functions are
request-triggered only and cannot hold a cron.

### Change 2: AI must be optional, never load-bearing

10,000 neurons/day is shared across *all* users, so F8's budget shrinks as the
group grows — the one limit in the ledger that gets worse with success.

The fix is architectural rather than a quota alarm: **the corpus record is the
answer; the model only narrates it.** F8 renders root, lemma, form and case
straight from the morphology data — no inference, no cost, always available — and
*optionally* adds a prose explanation on top. If the daily budget is gone, the
facts still render and the prose is absent. The feature degrades to plain instead
of breaking.

Caching compounds this the right way: explanations key on `(word, ayah)`, which is
deterministic, and the cache is shared across users. One person's lookup warms it
for everyone, so **cost per user falls as the group grows**.

### What would break $0

Worth naming so it is a deliberate decision if it ever happens: exceeding 50
Access seats ($7/user/month for *all* users, not just the excess); wanting a
custom domain; sustained Workers AI use beyond the free neurons; or D1 growth past
5 GB, which at these data volumes would take a deliberate mistake.

---

## 6. Data sources — researched, with licences

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
| Scheduling algorithm | FSRS | Open source | See §7. |
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

## 7. Algorithm decision: FSRS over SM-2

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

## 8. Feature set

### 8.1 In — v1 core loop

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

### 8.2 In — v2

**F8. Grounded explanations — facts first, narration optional.** Answers "why is
this word `majrūr`?" by rendering the corpus record for that word in that context:
root, lemma, form, case. That part is a database read — free, instant, always
available, and verifiable. A Workers AI model *optionally* narrates it in prose on
top. Retrieval-grounded, not the free-associating chatbot v1 called an AI tutor.
Two guard rails: refuse when the corpus has no annotation rather than inventing
one, and never let the prose layer be load-bearing — if the neuron budget is spent,
the facts still render (§5, Change 2).

**F9. Morphology pattern drills.** Given a root, produce or recognise Forms I–X;
generated from corpus data, which has form labels for every verb.

**F10. Self-recording.** Record, play back against a reciter, self-rate. Explicit
non-goal: automatic correctness. Feeds the FSRS recall schedule via self-rating.

### 8.3 In — v3

**F11. Balagha.** Curated, hand-authored, ~30 examples. Last, per §3, and the one
place where hand-authoring is the right call because the corpus does not annotate
rhetoric.

**F12. Cross-surah thematic links.** Requires a theme dataset that does not yet
exist — scope only after F1–F10 land.

**F13. Certificate.** Already mostly works. Needs a `users.name` column, which it
reads today and which does not exist.

**F14. Opt-in progress sharing.** Now plausible in a way it was not for a single
user or a public product: a known peer group is the one setting where gentle
accountability works ("3 of your group reviewed today"). Strictly opt-in per user,
strictly aggregate — no browsing another person's mistakes. Deliberately last, so
it cannot become a reason to weaken the privacy default in §4.

### 8.4 Out — and why

| Feature | Decision | Reason |
|---|---|---|
| **Recitation ASR / mistake detection** | **Out** | §2. Three years and 75k curated minutes to match. Use Tarteel. This is the single biggest scope reduction versus v1, which had it in the placement test *and* Modules 04 and 08. |
| Multi-user accounts | **Now IN** — see §4 | Reversed by the audience decision. Cloudflare Access + `user_id` on every table. This is the one v1 ambition that turned out to be required rather than premature. |
| Teacher mode, parental controls, curriculum assignment | Out | A peer group of friends has no teacher role. Revisit only if someone actually wants to teach a class with it. |
| Monetization tiers, institutional pricing | Out | Explicitly not a commercial product. |
| Leaderboards, forum, study groups | Out | Ranking friends against each other is the wrong incentive for hifz, and a forum needs moderation nobody has time for. F14 covers the useful 5% of this. |
| Hand-written Arabic parser | **Deleted** | Superseded by the corpus. |
| Generic 1000-word vocabulary list | Replaced by F3 | Frequency scoped to the hifz plan beats a static list. |
| Durable Objects | Out | v1 specified them for SRS scheduling. D1 plus a `due` column is sufficient; DO adds a moving part for no gain at this scale. |
| KV | Out for now | Listed in the stack, never bound. When Quran-content caching needs it (F1), add it deliberately. |

---

## 9. Data model changes

Do these **before** more data accrues — the cost of adding `user_id` rises with
every row, and §4 makes it mandatory rather than speculative.

1. **`lesson_progress`**: add `user_id`; PK → `(user_id, lesson_id)`. Fixes
   `/api/progress/dashboard`, `/api/learning/next`, `/api/tutor/chat`.
2. **`vocabulary_mastery`**: PK `word` → `(user_id, word)`. Two users currently
   cannot know the same word.
3. **`memorization`**: add FSRS state (`stability`, `difficulty`, `reps`,
   `lapses`, `last_review`, `due`); `id` → `TEXT` (code inserts a UUID into an
   `INTEGER PRIMARY KEY`). Add the separate comprehension schedule from §7.
4. **`quran_verses`**: create it, once, with one column naming — the two routes
   that read it currently assume different names. Loaded from the pinned Tanzil
   text + tajweed annotations + corpus morphology.
5. **`users`**: add `email` (unique — the identity from the Access JWT) and
   `name` (the certificate already reads it). Provisioned just-in-time on first
   authenticated request; `id` stays an opaque internal key so a changed address
   does not orphan progress.
6. **Blob PKs**: `tutor_conversations`, `tutor_topic_history`,
   `grammar_exercises` insert `randomblob(16)` into `INTEGER PRIMARY KEY`. Use
   `TEXT` + UUID.
7. **Drop the duplicate** `due_date`/`next_review` pair on `spaced_repetition`;
   index `memorization(user_id, due)`, `assessment_results(user_id)`,
   `quiz_attempts(user_id)`.
8. **Make the schema idempotent** — the `tajweed_rules` seed is a bare `INSERT`,
   so re-running `schema.sql` fails.
9. **Audit every query for tenancy.** With more than one real user, a missing
   `WHERE user_id = ?` stops being a latent bug and becomes one friend reading
   another's data. `tutor.ts:31` already selects an assessment with no user
   filter. Every user-scoped table needs the predicate, checked once, deliberately.

Adopt real migrations (`workers/src/db/migrations/NNN_*.sql`, applied in order,
recorded in a `schema_migrations` table). A single mutable `schema.sql` is how the
schema and the queries drifted apart unnoticed.

---

## 10. Roadmap

Each stage ends with a check that exercises the running system. Stages 1–6 are
the audit's remediation order; 7+ is new capability. **No stage is "done" on a
green build** — that rule is what produced eleven false ✅s.

| Stage | Work | Done when |
|---|---|---|
| **1 ✅** | Frontend↔Worker wiring, user row, CORS, fail-closed auth, CI typecheck | `GET /api/auth/profile` returns the user row through the deployed site. *Verified locally; awaiting secrets for remote.* |
| **2 ✅** | §9.1–9.4, 8.6–8.9 + `tutor.ts:31` binding + `learning.ts:111` SQL. Migrations table. | All 19 endpoints return non-5xx against a seeded DB; every user-scoped query filters by `user_id` |
| **2a ✅** | **One origin (§5):** move the Hono app to `functions/api/[[route]].ts` via `hono/cloudflare-pages`; bind D1/R2 in Pages; retire the standalone Worker deploy (keep a small cron Worker for exports). Route files unchanged. | `/api/auth/profile` answers on the Pages hostname; CORS code deleted |
| **2b ✅** | **Identity (§4):** Access application over the Pages hostname *and* its preview subdomain, JWT verification via `jose`, just-in-time user provisioning from the JWT e-mail. Retire `NEXT_PUBLIC_API_TOKEN`. | Two different people log in and see two different, private profiles; an un-invited address is refused; preview URLs are not open |
| **3 ✅** | Lesson-grading contract; assessment result DTO; `error.tsx` | Submit a lesson, see a real score; kill the API, see an error not a blank |
| **4 ✅** | Font `@import` order, Reem Kufi, `ProgressBar`/`Badge` static classes, logo viewBox, button contrast; pick one design system | Fonts load in devtools; progress bars visibly fill; contrast ≥ 4.5:1 |
| **5 ✅** | Delete or route the 17 orphans — decides Module 05's real status; reset `PLAN.md` checkboxes | No unreachable component; docs match code |
| **6 partial** | Fix the 3 Arabic content errors; load `placement-test.json`; ingest pinned Tanzil + tajweed + corpus | Reader renders an ayah with correct morphology and tajweed from the DB |
| **7** | F1 Reader, F2 hifz + FSRS, F3 scoped vocabulary | Memorise an ayah; its words appear in the vocabulary queue |
| **8** | F4 generated checks, F5 placement, F7 progress | Placement assigns a path; dashboard shows real numbers |
| **9** | F6 tajweed track, F8 grounded explanations, F9 pattern drills | Explanation cites the corpus record; refuses when unannotated |
| **10** | F10 recording, F11 balagha, F13 certificate | — |

**Status as of 2026-07-25: Stages 1 through 6 are done**, except the parts that
need a file this environment cannot fetch — the Quran text and morphology ingest
in Stage 6, tracked in `docs/HANDOFF-LOCAL-SESSION.md`. Stage 2b's code is
written and unit-tested but the real Access handshake is unverified, because
creating the Zero Trust application needs Cloudflare dashboard access.

Two things Stage 6 turned up that were not in the original plan, both now fixed:
`/tajweed` showed "Loading…" permanently because `loading` was initialised true
while its fetch only ran for one tab, and `/progress` overflowed a 375px
viewport. Neither was visible by reading the code — both were found by driving
the built app in a browser, which is the argument for §11's first rule.

**Next, in order:** the three deploy steps in the handoff §1 (nothing is live
until those are done), then **Stage 7's memorization entry UI** — the API,
scheduler and migration all work and no UI calls `POST /api/memorization/add`,
which needs no Quran text and is the shortest path to something genuinely usable.

Stage 2b is deliberately early. Identity is the one thing that gets more
expensive the longer it waits — every row written under the shared
`test-user-1` identity before Access lands is a row that has to be attributed to
a real person afterwards, or thrown away. Do it before Stage 7 writes anything a
user would miss.

Stages 2–6 are debt paydown on work already marked complete. That is the honest
cost of eleven premature checkboxes, and it is cheaper to pay now than after
F1–F14 are built on top of it.

---

## 11. Definition of Done

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
5. **Content is verified by a competent reader.** §12 R4.
6. **The claim matches the code.** If a step is a placeholder, the docs say
   placeholder. `seed-db.ts` printing `✅ Seeded 18 assessment questions` while
   writing nothing cost more trust than the missing feature did.

---

## 12. Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Scope collapse under solo maintenance.** v1 planned 12 modules across 3 pillars for one part-time developer, and the result was breadth marked complete over a backend that could not serve a request. | **High** | The §8.4 cuts are the mitigation. Ship F1–F3 fully before F4. |
| R2 | **Quran API OAuth blocks content ingestion.** Registration may be slow or terms may not fit. | Medium | Text, tajweed and morphology all come from static licensed files. Only translation/tafsir/audio need the API — degrade to text-only rather than block. |
| R3 | **Corpus is GPL.** Morphological annotation is GNU GPL with attribution. | **Low** (was Medium) | Downgraded by §4: hosting one instance for friends is network use, and GPL's trigger is *distribution* of the work — not serving data from it. Attribution with a link to corpus.quran.com is required regardless and costs nothing. The risk only returns if someone self-hosts their own copy. Fallback: [QuranMorph](https://www.researchgate.net/publication/392941154_QuranMorph_Morphologically_Annotated_Quranic_Corpus) or Quran Foundation word-by-word. |
| R4 | **Content errors teach falsehoods.** Already shipped: الرحيم glossed "the Forgiving" (that is الغفور) with the correct answer absent from the options; Form II/III patterns swapped in two places; `سرف` for صرف. | **Highest** (raised by §4) | Now the top risk in the plan. Teaching a wrong gloss of الرحمن الرحيم to friends who trust the app is a different order of problem from one developer's own test data — and they have no reason to doubt it. Pull the three known fixes forward out of Stage 6. No hand-authored Arabic reaches a user without review by a competent reader; prefer generated-from-corpus (F4) wherever possible. |
| R5 | **Tanzil encoding drift** silently misaligns every tajweed offset. | Medium | Pin the bundled April-2017 text; checksum it in CI; assert a known annotation lands on the expected codepoints. |
| R6 | **Workers AI free tier (10k neurons/day) is shared across all users**, so F8's budget shrinks as the group grows — the only limit that gets worse with success. | Medium (was Low) | Structural, not a quota alarm: the corpus record renders without inference, and the model only narrates (§5, Change 2). Cache on `(word, ayah)`, shared across users, so cost per user *falls* as the group grows. Worst case the prose disappears and the facts remain. |
| R7 | **Public bearer token.** `NEXT_PUBLIC_API_TOKEN` ships in the bundle by construction, and resolves every caller to one identity. | **Blocking** (was Medium, accepted) | No longer tolerable: with several users a bundled token means any of them can read and write any other's data. Resolved — not mitigated — by Stage 2b: Access supplies identity and the token is deleted. Until then, treat all data as shared. Rotate the token committed in `.dev.vars` regardless. |
| R8 | **FSRS mis-tuned on sparse data**, giving bad intervals early. | Low | Use published default parameters until there are enough reviews to fit; store raw review logs so it can be re-fit retroactively. |
| R9 | **Data loss now costs someone else's months of work.** A friend's hifz history is not reproducible. | **High** | D1 Time Travel gives point-in-time restore over 30 days automatically, at no cost and with nothing to build — that alone covers most of this. Add a nightly `d1 export` to R2 from a small cron Worker for anything older (cron is free; 3 triggers per Worker). Test a restore *before* inviting anyone — an untested backup is not a backup. |
| R10 | **Operating a service for people you care about.** Silent breakage is now discovered by a friend, not a log. | Medium | Uptime check on `/health`; surface real errors in the UI (Stage 3) rather than blank regions; keep the group small enough to tell them directly when something breaks. |
| R11 | **Free-tier terms change.** The $0 constraint depends on limits Cloudflare sets and can revise. | Low | Nothing here is exotic — static hosting, SQLite, a request handler. The lock-in that matters is D1, and `wrangler d1 export` produces portable SQL, so the exit is a normal SQLite file. Keep the nightly export (R9) partly for this reason. |

---

## 13. Open questions

Ones where the answer changes the build, rather than v1's list of things nobody
needed to decide:

1. ~~**Is this for one user or eventually many?**~~ **Answered 2026-07-25: a small
   group of close friends, non-commercial.** See §4. This drove multi-user accounts
   back in scope, Cloudflare Access as the identity layer, R7 to blocking and R4 to
   highest.
1b. ~~**Does it need to be free?**~~ **Answered 2026-07-25: yes — $0, as a hard
   constraint.** See §5. This voided the custom domain (Access works on
   `*.pages.dev`), collapsed the API into a Pages Function for one free origin, and
   made Workers AI narration optional rather than load-bearing.
2. **Which mushaf and qira'ah?** The plan assumes Hafs — the tajweed dataset is
   Hafs-only. Anything else means new data.
3. **How much daily time is the app designed for?** FSRS load balancing needs a
   target. v1 said "15–30 minutes" in the UX section and set weekly targets of 5
   lessons and 10 reviews elsewhere, which are different numbers.
4. **Does recitation correctness matter enough to reverse R1?** If yes, the
   answer is still "use Tarteel alongside," not "build ASR."
5. **Is distribution ever intended?** Now mostly settled — hosting one instance
   is not distribution (R3). Still open if a friend ever wants their own copy.
6. **How many friends, and do you want them to know who else is on it?** Changes
   nothing structural — Access covers 50 either way — but it decides whether F14
   is worth building and whether the group is visible to itself at all. It is also
   the only number that can breach $0: seat 51 costs $7/month × *everyone*.
7. **Whose e-mail addresses go in the Access policy, and who adds them?** The
   entire access-control model is that list. Worth being deliberate about who can
   edit it.

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
- [Cloudflare Zero Trust — free plan limits (50 seats)](https://costbench.com/software/business-vpn/cloudflare-zero-trust/free-plan/)
- [Cloudflare Pages — known issues, incl. protecting `*.pages.dev` with Access](https://developers.cloudflare.com/pages/platform/known-issues/)
- [Hono on Cloudflare Pages — `hono/cloudflare-pages`](https://hono.dev/docs/getting-started/cloudflare-pages)
- [Pages Functions — bindings (D1, R2)](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare Workers — limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cron Triggers — available on the Workers free plan](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/)
- [Cloudflare free tier 2026 — D1 limits](https://agentdeals.dev/vendor/cloudflare)
- [Cloudflare Access — seat management](https://github.com/cloudflare/cloudflare-docs/blob/production/content/cloudflare-one/identity/users/seat-management.md)
- [Cloudflare Access — validating the JWT at the origin](https://blog.cloudflare.com/protecting-apis-with-jwt-validation/)
- [Cloudflare Access — application token / `Cf-Access-Jwt-Assertion`](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/)
- [Best Quran apps 2026 — comparison](https://www.getnafs.com/blog/quran-apps-comparison-2026/)
- [Tarteel vs Quranly](https://www.quranly.app/blog/tarteel-vs-quranly-comparison)
- [Bayyinah TV — Arabic curriculum](https://explore.bayyinahtv.com/arabic/)
