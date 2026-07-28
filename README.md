# Language Builder

A web application for learning Classical Arabic with focus on Quran comprehension, grammar (nahw, sarf, balagha), and memorization (hifz). Integrates diagnostic assessment, adaptive learning paths, spaced repetition memorization, tajweed visualization, and AI tutoring.

## 🎯 Vision

**No existing platform integrates:**
1. Arabic reading assessment (Classical script literacy)
2. Classical Arabic grammar (nahw, sarf, balagha)
3. Quran memorization with comprehension tracking
4. Adaptive learning paths based on diagnostic assessment

## ✨ Features

What works today, honestly:

- **Placement assessment** — 18 questions across literacy, comprehension, grammar
  and memorization, about 15 minutes. Text only; there is no audio module, by
  decision.
- **Adaptive paths** — the assessment assigns one of three curricula from your
  weakest domain, and the result is stored rather than re-derived.
- **Learning** — lessons with graded exercises, sticky completion, best-of
  scoring, and a flashcard queue drawn from the ayahs you are memorising: content
  words only, commonest-in-the-Quran first, each card naming the ayah it came from.
- **Spaced repetition** — an FSRS-6 scheduler for memorization and vocabulary, with
  an add-ayah UI, a due-today queue and a 908-unit ordered curriculum. Four grades
  rather than five, because FSRS grades on four and a scale where two answers
  schedule identically is a lie to the learner.
- **Tajweed** — per-rule mastery, and colour-coded verses across all 6,236 ayahs.
  Ten rule colours, each ≥4.5:1 on the canvas, applied to the script rather than
  boxed behind it so Arabic stays joined.
- **Grammar** — three real disciplines, not three tabs over one list: nahw and sarf
  lessons, and balagha as the three devices that can actually be derived. 38,995
  exercises whose results are recorded per kind and shown on Progress, plus 418
  lessons: ten authored and 408 generated one-per-root from the corpus. The reader's
  Parse lens states what each word *does* — فاعل, مفعول به, خبر, مضاف إليه — and which
  words are implied but never written.
- **Tutor** — corpus lookups, not a model. It answers a word, a root, a location or a
  named tajweed rule, and refuses rather than inventing Arabic.
- **Coverage** — how much of the Quran you can read, computed from the roots you
  know. 400 roots make half of all 6,236 ayahs readable end to end.

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 static export, React 18, TypeScript |
| Styling | Tailwind CSS; Lucide icons; fonts self-hosted via `next/font` |
| Design tokens | `src/app/styles/globals.css` → `tailwind.config.ts` (no CSS component layer) |
| Backend | Hono, bundled as `_worker.js` inside the Pages output — one origin |
| Database | Cloudflare D1, with `wrangler d1 migrations` |
| Storage | Cloudflare R2 |
| Auth | Cloudflare Access JWT when configured; shared bearer token otherwise |
| Tests | Vitest (206 test blocks) + ESLint + `tsc`, all gated in CI |
| CI/CD | GitHub Actions → Cloudflare Pages |
| Cost | $0/month — a hard constraint, see plan §5 |

## 📦 Project Structure

```
languagebuilder/
├── content/           # Static content data (vocabulary, lessons, assessment, tajweed)
│   ├── vocabulary/    # Core Quranic words
│   ├── grammar/       # Grammar curriculum
│   ├── assessments/   # Diagnostic test questions
│   └── tajweed/       # Tajweed rule definitions
├── scripts/           # 25 scripts: ingest-* pull pinned sources, gen-* derive content
│                     # and docs, check-* are the CI gates. Most take --check.
├── src/
│   ├── app/           # Next.js app
│   │   ├── app/       # App Router pages
│   │   ├── components/# React components (ui, layout, dashboard, learning, etc.)
│   │   ├── hooks/     # Custom hooks
│   │   └── tailwind.config.ts
│   └── styles/        # DESIGN.md + globals.css — the token source of truth
├── workers/           # Cloudflare Workers backend
│   ├── src/
│   │   ├── routes/    # API route handlers
│   │   ├── lib/       # identity (Access JWT), DB wrapper, scoring, FSRS
│   │   ├── db/        # migrations/ (applied in order) + seed-user.sql
│   │   └── pages-entry.ts  # bundled to _worker.js — routes /api/* into Hono
│   └── test/          # vitest
│   └── wrangler.toml  # Workers config
├── .github/workflows/ # CI/CD pipeline
│   └── deploy.yml     # Auto-deploy to Cloudflare Pages on push to main
├── docs/              # lesson-review.html (generated), plus a dated corpus record
└── modules/           # Pre-implementation design specs. Each carries a banner
                       # naming what it describes that did not ship.
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account (free tier is sufficient)
- GitHub account (for CI/CD)

### Setup

1. **Install dependencies**
   ```bash
   cd workers && npm install
   cd ../src/app && npm install
   ```

2. **Create the D1 database and apply migrations**
   ```bash
   cd workers
   wrangler d1 create languagebuilder
   npx wrangler d1 migrations apply languagebuilder --local
   ```
   Migrations live in `src/db/migrations/` and are applied in order. `0001` is an
   idempotent baseline, so this is safe against an existing database.

3. **Provision the single user** — required. Nothing else creates this row, and
   without it `/api/auth/profile` returns 404 and every insert that references
   `users(id)` fails its foreign key.
   ```bash
   npx wrangler d1 execute languagebuilder --local --file=src/db/seed-user.sql
   ```

4. **Set the local API token**

   `workers/.dev.vars` supplies `API_TOKEN` for `wrangler dev`. The auth
   middleware fails closed (500) if it is missing — there is no default.
   ```
   API_TOKEN=<any value you like for local dev>
   ```

5. **Run development servers**
   ```bash
   # Workers (backend) — http://localhost:8787
   cd workers && npx wrangler dev

   # Next.js (frontend) — http://localhost:3000
   cd src/app && \
     NEXT_PUBLIC_API_URL=http://localhost:8787 \
     NEXT_PUBLIC_API_TOKEN=<same value as .dev.vars> \
     npm run dev
   ```

   Verify the two halves are talking:
   ```bash
   curl -H "Authorization: Bearer $API_TOKEN" http://localhost:8787/api/auth/profile
   ```

6. **Seed content (optional)**
   ```bash
   npx tsx scripts/seed-db.ts
   ```
   This emits SQL on stdout for wrangler to apply, and reports on stderr which
   steps it does *not* cover (the assessment bank has no table yet; tajweed rules
   come from migration 0001):
   ```bash
   npx tsx scripts/seed-db.ts > /tmp/seed.sql
   cd workers && npx wrangler d1 execute languagebuilder --local --file=/tmp/seed.sql
   ```

## Changing lesson content

Lesson content lives in the repo and **is deployed by CI**. After editing
`content/grammar/lessons.json` or regenerating the root lessons, regenerate the seed —
`gen-lessons-sql.mjs --check` fails the build if you forget:

```bash
node scripts/gen-lessons-sql.mjs
```

The deploy job applies it through D1's query API, before the Pages deploy, so content is
in place when the code that reads it goes live. To apply it by hand:

```bash
CLOUDFLARE_API_TOKEN=... D1_DATABASE_ID=6216c466-c244-4c16-8569-c7281585fbc6 \
  node scripts/seed-remote-d1.mjs scripts/seed-lessons.sql
```

The token needs **D1:Edit** — Cloudflare requires it explicitly for HTTP API writes, and
without it every D1 route returns code 7403 whatever endpoint you use. Every statement is
`INSERT OR REPLACE` keyed on the lesson id, so re-running is always safe, and the script
refuses to apply a partial seed.

CI is the source of truth for lesson content. Verified by deleting a lesson row directly
from production and pushing an unrelated commit: the deploy restored it without anyone
touching D1. So a divergence between the repo and production self-corrects on the next
push, rather than persisting until someone notices.

This cost one silent failure before it was automated: an explanation added to
`grammar-02` passed every gate and never reached production, because only the local
database was reseeded.

## ✅ Checks

Enforced in CI ahead of the deploy job. None of this existed before 2026-07-25 — the
Worker alone had 69 type errors that nothing was checking.

Nine gates run alongside the tests, and every one has been proven to fail on a seeded
defect:

| Gate | Refuses |
|---|---|
| `check-content.mjs` | a lesson claim the corpus contradicts — sun/moon membership, unattested Arabic, a root that does not exist |
| `check-pedagogy.mjs` | an unreachable lesson, a level hole, fewer than two gradable exercises, an exercise with no answer input or no explanation |
| `gen-lessons-sql.mjs --check` | a content edit that was not reseeded |
| `gen-root-lessons.mjs --check` | generated lessons out of step with the corpus, or answers clustered at one option position |
| `gen-design-system.mjs --check` | token drift, a tajweed span that breaks Arabic shaping, a root joined with spaces, Arabic without `lang="ar"` |
| `gen-api-docs.mjs --check` | an undocumented endpoint, an orphaned page, an endpoint with no caller, a success response not using `{data}` |
| `gen-db-types.mjs --check` | row types out of step with the migrations |
| `gen-content-manifest.mjs --check` | a content count in prose that disagrees with what shipped |
| `sync-pages-config.mjs --check` | a missing Pages binding — the state that once made every data route 500 |

```bash
cd workers   && npx tsc --noEmit && npm test    # 206 vitest test blocks
cd src/app   && npx tsc --noEmit && npm run lint
```

The tests cover grading, Arabic normalisation, assessment scoring, path
assignment, the FSRS scheduler and the Quran ingest alignment gate. Every case
corresponds to a bug that shipped or a behaviour that had only been checked by
hand once.

Reproducing production locally — one origin, no CORS:

```bash
cd src/app && npm run build   # no token: Access authenticates at the edge
cd ../../workers && npm run build:pages
npx wrangler pages dev ../src/app/out \
  --d1 DB=6216c466-c244-4c16-8569-c7281585fbc6 --persist-to .wrangler/state
```

---

## 🌐 Deployment

### One-time setup

The site and the API share **one origin**: CI bundles `_worker.js` into the Pages
output, which routes `/api/*` into Hono and everything else to static assets. So
there is no CORS and no absolute API URL to configure.

1. **Worker secret** (not a `[vars]` entry — a var overwrites a same-named secret
   on every deploy):
   ```bash
   cd workers && npx wrangler secret put API_TOKEN
   ```
2. **GitHub Actions secrets** — Settings → Secrets and variables → Actions:
   - `API_TOKEN` — same value as step 1. The build fails loudly without it.
   - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` — for the Pages deploy.
3. **Apply migrations and seed the user row on the remote database**, once:
   ```bash
   cd workers
   npx wrangler d1 migrations apply languagebuilder --remote
   npx wrangler d1 execute languagebuilder --remote --file=src/db/seed-user.sql
   ```
   Leave `NEXT_PUBLIC_API_URL` unset — same origin. `ALLOWED_ORIGINS` in
   `workers/wrangler.toml` only matters for the standalone Worker.

### Frontend (Cloudflare Pages)
Deploys automatically on push to `main`. CI typechecks the Worker and the
frontend first, and refuses to build without `API_TOKEN`.

```bash
git push origin main
```

**Production URL:** https://languagebuilder-frontend.pages.dev

### Backend
Deployed *with* the frontend as `_worker.js` inside the Pages output — no
separate deploy step. The standalone Worker in `workers/` is still useful for
local development (`npx wrangler dev`) and can be deployed independently, but
production does not use it.

### Verifying a deploy

A green Actions run only proves the build compiled. To prove the two halves are
connected:

```bash
curl https://languagebuilder-frontend.pages.dev/health
curl -H "Authorization: Bearer $API_TOKEN" \
  https://languagebuilder-frontend.pages.dev/api/auth/profile
```

Then load the site and confirm a data-backed page renders rather than showing an
error card.

### Per-user identity (Cloudflare Access)

The shared bearer token resolves every request to one user and ships in the JS
bundle, so with more than one real person it lets any of them read any other's
data. Cloudflare Access replaces it — free to 50 seats, no passwords, no sign-up
flow. The Access policy *is* the invite list.

One-time setup:

1. Zero Trust dashboard → **Access → Applications → Add → Self-hosted**.
2. Public hostname: `languagebuilder-frontend.pages.dev`. **Delete the `*` from
   the Subdomain field** — leaving it protects only preview URLs. Add a second
   application for `*.languagebuilder-frontend.pages.dev` so previews are covered
   too, or they stay open.
3. Policy: Action *Allow*, rule *Emails* → the addresses of your group. Pick an
   identity provider; **One-time PIN** needs nothing from anyone but an inbox.
4. Copy the application's **Audience (AUD)** tag.
5. Pages project → Settings → Environment variables:
   - `ACCESS_TEAM_DOMAIN` = `<your-team>.cloudflareaccess.com`
   - `ACCESS_AUD` = the AUD tag from step 4
6. Pages project → Settings → General → re-enable the access policy.

**Access does enforce on `.pages.dev`.** This README previously recorded it as a
"Pages.dev limitation" after the site kept returning 200. That diagnosis was
wrong. The application had a **bypass** policy with `include: everyone` attached
at precedence 1, and policies apply to the whole application — so everybody
bypassed Access for the entire site while the dashboard looked configured. The
paired allow policy also matched nobody: it was an `email_domain` rule for
`fojallgmail.com`, a domain with no dot in it. Had it read `gmail.com` it would
have admitted every Gmail account on the internet.

If the site answers 200 without a redirect, check the attached policies before
concluding the platform cannot do it.

Setting both variables switches the API to Access mode; the shared token stops
working, which is the intended outcome. Confirm with:

```bash
curl -s https://languagebuilder-frontend.pages.dev/api/auth/whoami   # 401 outside a browser
```

then load the site in a browser, log in, and visit `/api/auth/whoami` — it should
report `"mode":"access"` and your e-mail. Users are provisioned on first request,
so nobody needs to be added to the database by hand.

The AUD tag is not optional: without it a valid token for *any* Access
application, in any Cloudflare account, would be accepted.

## 📊 Current status

**Last updated: 2026-07-26**

**Everything is deployed and working.** All 39 API endpoints resolve, all 13
pages render, the database has 6,236 Quran verses and 77K morphology rows.

| Component | Status |
|-----------|--------|
| Frontend (13 routes) | ✅ All rendering 200 OK |
| Navigation (6 links) | ✅ All wired up |
| API (39 endpoints) | ✅ All resolving |
| Database (D1) | ✅ 21 migrations applied, seeded |
| Quran text | ✅ 6,236 verses with tajweed tags |
| Morphology corpus | ✅ 128,219 segments, 49,968 roots, 8,977 verb forms |
| Syntax layer | ✅ 117,947 rows from the Extended Quranic Treebank — roles, constituents, 11,157 elided tokens; shown in the Parse lens |
| Rhetorical devices | ✅ 95-device taxonomy pinned and gated; three devices derivable (taqdīm, jinās, tashbīh), metaphor is not |
| Cloudflare Access | ✅ Enforcing — every path 302s to the login |
| Grammar (corpus-derived) | ✅ 38,995 graded exercises, 122 (kind, level) buckets, 114/114 surahs; results recorded per exercise kind |
| Memorization curriculum | ✅ 908 ordered units across all 114 surahs |
| Content correctness | ✅ Gated in CI; 14 seeded defects all caught |
| Design system | ✅ Generated from globals.css, published to claude.ai/design, drift gated |
| Tajweed reader | ✅ Coloured Amiri script, joins intact, 10 rules all ≥4.5:1 |
| Word glosses | ✅ 77,429 words; 96.2% agreement with 5 independent translators |
| Tutor | ✅ Grounded in the corpus; cites sources, refuses when unannotated |
| Home | ✅ Today — one action chosen from what is actually due |
| Reader | ✅ One ayah, five lenses (recite, meaning, parse, memorize, ask) |
| Translation | ✅ 6,236 verses, Saheeh International via Tanzil, SHA-pinned |
| Coverage | ✅ Ayahs readable from known roots — 400 roots is half the Quran |
| Arabic shaping | ✅ Measured intact across every screen; gated in CI |
| Grammar lessons | ✅ 10, all reachable; claims checked against outside references |
| Auth | ✅ Per-user identity via Access JWT; shared token retired |

### Known issues (from frontend audit 2026-07-26)

**All 12 findings are closed** — see the audit for what each turned out to be.
Three were misdiagnosed and the real causes were worse: the flashcard ternary was
unreachable because nothing ever inserted into `vocabulary_mastery`; the tajweed
component resolved only 2 of 18 rules to a colour and placed marks on the wrong
letters; and audio was never blocked on Quran Foundation credentials.

Of the four deferred at the time, three were later done: the weekly calendar now
marks real activity, `StatCard`'s positive trend had been using a token the palette
never defined — that component has since been removed with `/dashboard` — and
wrangler is on 4. Self-recording is still out —
microphone capture cannot be verified headlessly.

### Plan items F1–F9

| | | |
|---|---|---|
| F1 | Reader | ✅ `/read` — one ayah, five lenses, plus the whole-surah tajweed reader |
| F2 | Hifz tracker | ✅ add-ayah UI, 908-unit curriculum, FSRS-6 review on four grades |
| F3 | Vocabulary SRS | ✅ scoped to the hifz plan — content words from your own ayahs, each card citing its source |
| F4 | Comprehension checks | ✅ 3,536 items from 77,429 word glosses |
| F5 | Diagnostic placement | ✅ and no longer a gate — skippable, with root calibration instead |
| F6 | Tajweed track | ✅ rule reference, per-rule mastery, ten colours all ≥4.5:1 |
| F7 | Progress | ✅ weekly activity calendar and coverage — ayahs readable from known roots. No daily streak counter: the helper that computed one had no caller and was removed |
| F8 | Tutor | ✅ rewritten as corpus lookups; it refuses rather than inventing Arabic |
| F9 | Root families | ✅ 38,995 derived exercises across twenty-five kinds, and answers recorded — mastery per kind shows on /progress. Seven kinds shipped first. Ten more came from annotation the ingest had captured and the generator never read (definiteness, negation, mood, voice, subject agreement, word role, relative pronoun, demonstrative, conditional, sentence type). Six came from the treebank's syntax layer, each cross-checked against the hand-verified case (mubtada/khabar, fa'il, maf'ul bihi, idafa, derived nouns, fronting). Two are rhetorical devices derivable from what the corpus already records: jinās and tashbīh |

### Research plan P1–P5

Derived from a survey of the field (FSRS benchmarks, Tarteel, Kalaam, Al Quran by
Greentech, and the lexical-coverage literature) rather than from the original plan.

| | | |
|---|---|---|
| P1 | FSRS-6 replaces SM-2 | ✅ both schedulers, four grades, migration 0019 seeds stability from the old interval |
| P2 | Word-synchronised recitation | ✅ 154,799 CC-BY timings for two reciters; the word being recited is highlighted |
| P3 | The 95% reading edge | ✅ `/api/progress/reading-queue` — ayahs one root short, best-covered first, on Today |
| P4 | Recitation checking | ❌ dropped — no microphone capture exists, and base Whisper is ~85% accurate on Quranic recitation while the good models are fine-tunes Cloudflare does not host |
| P5 | Whole-Quran word frequency | ✅ shown beside each root in the Parse lens |

Built after the plan, in response to use: a lesson result screen that says what you got
wrong and why, lesson-to-drill mappings, 408 generated root lessons, the review document,
and content deploying itself.

Then a second corpus, which was not in any plan because I had assumed it did not exist. The
Extended Quranic Treebank supplies the SYNTAX the morphology lacks, and three things
followed from it. The `/grammar` deep-dive stopped being three tabs showing one thing —
the endpoint took a category, used it for the mastery lookup and then queried
`module = 'grammar'`, so Syntax, Morphology and Rhetoric returned byte-identical lists of
all 418 lessons at 823 KB each. The Parse lens now states what each word DOES, not only
what it is. And grammar-03 drills مبتدأ and خبر, which I had recorded here as permanently
impossible — true of the corpus this project started from, false of the field.

Balagha went from nothing to three devices, all derived: fronting from the treebank's
dependency direction, paronomasia from shared roots, and simile from the comparison kāf.
Metaphor and metonymy have none and will not until a source annotates them; no available
source does — the published Quranic rhetoric corpus covers two verses.

**Next:** have a human read the lessons — 418 of them now, 1,245 exercises. That is the
only remaining risk no gate can cover: every mechanical claim is checked (sun/moon
membership, roots against the corpus, every Arabic example attested in the Quran, every
exercise answerable and explained, no option position favoured), but whether they *teach
well* is not a property a script can decide. `node scripts/gen-lesson-review.mjs`
renders all of them with the checked claims tagged so they can be skipped.

Endpoint triage is finished: every endpoint the app serves now has a caller, and
`gen-api-docs.mjs --check` fails if that stops being true.

### What's working today

- **Placement assessment** — 18 questions, about 15 minutes, text only, optional
- **Adaptive paths** — Assigns curriculum from weakest domain
- **Learning** — Lessons with graded exercises, flashcard queue
- **Spaced repetition** — FSRS-6 scheduler with review UI and a due-today queue
- **Tajweed** — Per-rule mastery, and coloured script that keeps Arabic joined
- **Grammar** — Sentence parsing, conjugation tables, root families
- **Tutor** — Corpus lookups over word, root, location and tajweed rule. No model
  call, and it says so when the corpus is silent rather than guessing
- **Coverage** — How much of the Quran you can read, from the roots you know

A note on process: **a green build is not evidence a feature works.** See
the F1–F9 table above for what remains.

## 📚 Documentation

Two live documents. Both are partly generated, so they cannot drift from the code:

- **`AGENTS.md`** — coding standards, the design-system rules, and generated lists of
  every live endpoint and page (`scripts/gen-api-docs.mjs --check` gates them).
- **`docs/CONTENT-AND-CORPUS-2026-07-26.md`** — how the content was built and
  verified: the corpus recovery, the correctness gates, the UI audit, and the
  coverage model.

The visual reference is the **"Bayan — Design System"** project on claude.ai/design,
generated from `src/app/styles/globals.css` by `scripts/gen-design-system.mjs`.

Removed as spent: `APPLICATION-PLAN-v2.md`, `CODE-AUDIT-2026-07-25.md`,
`FRONTEND-AUDIT-2026-07-26.md` and `HANDOFF-LOCAL-SESSION.md`. Every finding in them
is closed or recorded above, and a handoff describing a finished session reads as
current instructions to whoever opens it next.

Also:

- `PLAN.md` — superseded; kept for its research summary and content sources
- `modules/` — per-module design documentation from the original planning

**One convention worth knowing**, because it is why the docs above exist: *a green
build is not evidence a feature works.* This repo previously marked eleven modules
complete while six endpoints returned 500 and the frontend could not reach the
backend at all. Plan §11 sets out what to check instead — a real request, a visible
failure path, a reachable file, passing types and tests.

## 🔐 Security

- `.env` file is gitignored and contains all secrets
- Never commit credentials or API tokens
- Use environment variables for all sensitive data

## 📚 Data sources and attribution

Every fact this app teaches comes from one of these. Each is pinned by SHA-256 in the
script that ingests it, so a swapped file fails loudly instead of quietly teaching
something else. **The first four licences require attribution wherever the data is
displayed** — not merely here — which is why the reader, the exercise runner and the tutor
each carry a source line.

| Source | What it gives | Licence |
|---|---|---|
| [Quranic Arabic Corpus v0.4](https://corpus.quran.com) (Kais Dukes) | 128,219 morphology segments — what each word IS: root, lemma, part of speech, case, verb form | GNU GPL |
| [Extended Quranic Treebank](https://doi.org/10.1016/j.dib.2025.111940) (Nashir, Mohsen, Al-Shargabi, Nour & Al-onazi, *Data in Brief* 62:111940, 2025) | 117,947 syntax rows — what each word DOES: فاعل, مفعول به, خبر, مضاف إليه, plus 11,157 reconstructed elided tokens | CC BY 4.0 |
| [Arabic Rhetorical Device Taxonomy v0.1.1](https://github.com/Al-Balagha/Arabic-Rhetoric) (Encyclopedia of Arabic Rhetoric) | 95 rhetorical devices — the vocabulary this app names devices by. No Quranic annotation; it produces no exercises | CC BY 4.0 |
| [quran-align](https://github.com/cpfair/quran-align) | 154,799 word-level recitation timings for two reciters | CC BY |
| [Tanzil](https://tanzil.net) | The Uthmani text (6,236 verses) and the Saheeh International translation | CC BY |

The treebank's syntax layer is the one source here that is **not** hand-verified: its
authors report 95.7% LAS on a 350-sentence sample, with no corpus-wide inter-annotator
agreement. Nothing derived from it reaches a learner on its own — an exercise is emitted
only where the treebank's relation and the hand-verified morphological case concur, and
`scripts/ingest-treebank.mjs` refuses to load a release whose agreement has dropped below
the measured floors. The Parse lens, which cannot filter that way without blanking every
pronoun, names both sources and states the accuracy instead.

## 📝 License

Private repository — all rights reserved. The ingested data keeps its own licences, listed
above.

### Local development against one origin

Production serves the site and the API from a single Pages origin (see
`workers/src/pages-entry.ts`). To reproduce that locally:

```bash
cd src/app && npm run build   # no token: Access authenticates at the edge
cd ../../workers && npm run build:pages          # bundles _worker.js into out/
npx wrangler pages dev ../src/app/out \
  --d1 DB=6216c466-c244-4c16-8569-c7281585fbc6 \
  --persist-to .wrangler/state                    # shares the local D1
```

Then the whole app is on `http://localhost:8788` — no CORS, no `NEXT_PUBLIC_API_URL`.
Set `NEXT_PUBLIC_API_URL` only when pointing the frontend at a *separate*
`wrangler dev` Worker, which is the one case CORS still applies.
