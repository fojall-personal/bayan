# Language Builder

A web application for learning Classical Arabic with focus on Quran comprehension, grammar (nahw, sarf, balagha), and memorization (hifz). Integrates diagnostic assessment, adaptive learning paths, spaced repetition memorization, tajweed visualization, and AI tutoring.

## 🎯 Vision

**No existing platform integrates:**
1. Arabic reading assessment (Classical script literacy)
2. Classical Arabic grammar (nahw, sarf, balagha)
3. Quran memorization with comprehension tracking
4. Adaptive learning paths based on diagnostic assessment

## ✨ Features

What works today, honestly — see `docs/APPLICATION-PLAN-v2.md` §1 for the
per-module detail:

- **Placement assessment** — 18 questions across literacy, comprehension, grammar
  and memorization, about 15 minutes. Text only; there is no audio module, by
  decision.
- **Adaptive paths** — the assessment assigns one of three curricula from your
  weakest domain, and the result is stored rather than re-derived.
- **Learning** — lessons with graded exercises, sticky completion, best-of
  scoring, and a flashcard queue.
- **Spaced repetition** — an SM-2 scheduler for memorization. Working API; **no UI
  adds an ayah yet**, which is the next thing to build.
- **Tajweed** — per-rule mastery tracking works. Colour-coded verse rendering
  waits on the text ingest (`docs/HANDOFF-LOCAL-SESSION.md` §4).
- **Grammar** — sentence parsing and conjugation tables.
- **Tutor** — currently a keyword matcher, not a model. Its redesign is blocked on
  the morphology corpus, not on an AI provider.

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
| Tests | Vitest (39 cases) + ESLint + `tsc`, all gated in CI |
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
├── scripts/           # seed-db, gen-assessment, ingest-quran, verify-access-jwt
├── src/
│   ├── app/           # Next.js app
│   │   ├── app/       # App Router pages
│   │   ├── components/# React components (ui, layout, dashboard, learning, etc.)
│   │   ├── hooks/     # Custom hooks
│   │   └── tailwind.config.ts
│   └── styles/        # Design system (DESIGN.md, globals.css, verification page)
├── workers/           # Cloudflare Workers backend
│   ├── src/
│   │   ├── routes/    # API route handlers
│   │   ├── lib/       # identity (Access JWT), DB wrapper, scoring, SM-2
│   │   ├── db/        # migrations/ (applied in order) + seed-user.sql
│   │   └── pages-entry.ts  # bundled to _worker.js — routes /api/* into Hono
│   └── test/          # vitest
│   └── wrangler.toml  # Workers config
├── .github/workflows/ # CI/CD pipeline
│   └── deploy.yml     # Auto-deploy to Cloudflare Pages on push to main
└── modules/           # Design documentation per module
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

## ✅ Checks

All three are enforced in CI ahead of the deploy job, and none of them existed
before 2026-07-25 — the Worker alone had 69 type errors that nothing was checking.

```bash
cd workers   && npx tsc --noEmit && npm test    # 39 vitest cases
cd src/app   && npx tsc --noEmit && npm run lint
```

The tests cover grading, Arabic normalisation, assessment scoring, path
assignment, the SM-2 scheduler and the Quran ingest alignment gate. Every case
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

**Everything is deployed and working.** All 36 API endpoints resolve, all 10
pages render, the database has 6,236 Quran verses and 77K morphology rows.

| Component | Status |
|-----------|--------|
| Frontend (10 routes) | ✅ All rendering 200 OK |
| Navigation (7 links) | ✅ All wired up |
| API (36 endpoints) | ✅ All resolving |
| Database (D1) | ✅ 9 migrations applied, seeded |
| Quran text | ✅ 6,236 verses with tajweed tags |
| Morphology corpus | ✅ 128,219 segments, 49,968 roots, 8,977 verb forms |
| Cloudflare Access | ✅ Enforcing — every path 302s to the login |
| Grammar (corpus-derived) | ✅ 4,950 graded exercises, all 25 (kind, level) buckets full, 114/114 surahs |
| Memorization curriculum | ✅ 908 ordered units across all 114 surahs |
| Content correctness | ✅ Gated in CI; 14 seeded defects all caught |
| Design system | ✅ Generated from globals.css, published to claude.ai/design, drift gated |
| Tajweed reader | ✅ Coloured Amiri script, joins intact, 10 rules all ≥4.5:1 |
| Word glosses | ✅ 77,429 words; 96.2% agreement with 5 independent translators |
| Tutor | ✅ Grounded in the corpus; cites sources, refuses when unannotated |
| Grammar lessons | ✅ 10, all reachable; claims checked against outside references |
| Auth | ✅ Per-user identity via Access JWT; shared token retired |

### Known issues (from frontend audit 2026-07-26)

**All 12 findings are closed** — see the audit for what each turned out to be.
Three were misdiagnosed and the real causes were worse: the flashcard ternary was
unreachable because nothing ever inserted into `vocabulary_mastery`; the tajweed
component resolved only 2 of 18 rules to a colour and placed marks on the wrong
letters; and audio was never blocked on Quran Foundation credentials.

Deliberately left, with reasons in the audit: the static weekly calendar and
`StatCard` colours (cosmetic), self-recording (the hook was broken and cannot be
verified headlessly), and the wrangler 3 → 4 bump (major version on the deploy
path).

See `docs/FRONTEND-AUDIT-2026-07-26.md` for full details.

### Next priorities (F1–F7 from plan)

1. **F1. Reader** — Wire up `TajweedViewer` with verse data
2. **F2. Hifz tracker** — Add UI to add ayahs (currently no UI)
3. **F3. Vocabulary SRS** — Words scoped to hifz plan
4. **F4. Comprehension checks** — Generated from corpus data
5. **F5. Diagnostic placement** — Text-only assessment (existing)
6. **F6. Tajweed track** — Rule reference + practice (working)
7. **F7. Progress** — Dashboard with streaks + FSRS forecasting

### What's working today

- **Placement assessment** — 18 questions, 15 minutes, text only
- **Adaptive paths** — Assigns curriculum from weakest domain
- **Learning** — Lessons with graded exercises, flashcard queue
- **Spaced repetition** — SM-2 scheduler API works (no UI yet)
- **Tajweed** — Per-rule mastery tracking works
- **Grammar** — Sentence parsing and conjugation tables
- **Tutor** — Keyword matcher (F8 redesign blocked on corpus)

A note on process: **a green build is not evidence a feature works.** See
`docs/APPLICATION-PLAN-v2.md` §11 for what "done" requires.

## 📚 Documentation

Three current documents, in reading order:

- **`docs/APPLICATION-PLAN-v2.md`** — the plan in force. §1 is measured current
  state, §10 the staged roadmap, §11 what "done" requires.
- **`docs/HANDOFF-LOCAL-SESSION.md`** — what is blocked and on whom. Start at §1
  if you are picking this up on a local machine.
- **`docs/CODE-AUDIT-2026-07-25.md`** — historical. The audit those two came from;
  most findings are resolved, and its header says which.

Also:

- `AGENTS.md` — coding standards, the real endpoint list, agent workflow notes
- `src/styles/DESIGN.md` — design token specification
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

## 📝 License

Private repository — all rights reserved.

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
