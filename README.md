# Language Builder

A web application for learning Classical Arabic with focus on Quran comprehension, grammar (nahw, sarf, balagha), and memorization (hifz). Integrates diagnostic assessment, adaptive learning paths, spaced repetition memorization, tajweed visualization, and AI tutoring.

## 🎯 Vision

**No existing platform integrates:**
1. Arabic reading assessment (Classical script literacy)
2. Classical Arabic grammar (nahw, sarf, balagha)
3. Quran memorization with comprehension tracking
4. Adaptive learning paths based on diagnostic assessment

## ✨ Features

- **Diagnostic Assessment** — 30-45 minute test across 4 domains (literacy, comprehension, grammar, memorization)
- **Adaptive Learning Paths** — Personalized curriculum based on weakest areas
- **Spaced Repetition** — Smart review scheduling for memorization
- **Tajweed Visualization** — Color-coded Quran text with functional rule colors
- **AI Tutor** — Interactive grammar explanations and practice

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS, Lucide React icons |
| Design System | DESIGN.md token spec + globals.css + verification page |
| Backend | Cloudflare Workers (Hono framework) |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 (audio, images) |
| Auth | Bearer token today; Cloudflare Access next (see plan §4) |
| Build | Wrangler 3 |
| CI/CD | GitHub Actions → Cloudflare Pages |

## 📦 Project Structure

```
languagebuilder/
├── content/           # Static content data (vocabulary, lessons, assessment, tajweed)
│   ├── vocabulary/    # Core Quranic words
│   ├── grammar/       # Grammar curriculum
│   ├── assessments/   # Diagnostic test questions
│   └── tajweed/       # Tajweed rule definitions
├── scripts/           # Dev scripts (seed-db.ts)
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
│   │   ├── lib/       # Auth, DB wrapper, scoring, Quran service
│   │   └── db/        # Database schema
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
   Note: this script currently only writes vocabulary and lessons — its
   assessment and tajweed steps print success without inserting anything, and it
   seeds vocabulary against a different user id than the API reads. See
   `docs/CODE-AUDIT-2026-07-25.md` §7.

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

The module checkboxes that used to live here marked eleven modules complete while
six endpoints returned 500 and the frontend could not reach the backend at all.
Status now lives in one place, measured rather than asserted:

- **`docs/APPLICATION-PLAN-v2.md` §1–2** — what actually works, per module
- **`docs/APPLICATION-PLAN-v2.md` §10** — the staged roadmap
- **`docs/CODE-AUDIT-2026-07-25.md`** — the audit these came from

Done so far: Stage 1 (frontend↔API wiring, fail-closed auth, CI typechecks),
Stage 2 (schema reconciled with the queries, migrations adopted), Stage 2a (one
origin), Stage 3 (grading contract, result DTO, error boundaries), Stage 4
(design system rebuilt), Stage 6 partial (the three Arabic content errors).

Next: Stage 2b (Cloudflare Access identity), Stage 5 (orphaned components),
Stage 6 remainder (load the question bank, ingest Quran text + morphology).

A note on process, because it is the reason for the rewrite above: **a green
build is not evidence a feature works.** See §11 of the plan for what "done"
requires.

## 🔧 Recent Critical Fixes

1. **Tailwind CSS Bug** — Fixed `tailwind.config.ts` content paths (`./src/app/...` → `./app/...`), restoring 40KB CSS with all utility classes
2. **globals.css Corruption** — Restored from git (had repeated `}` characters breaking CSS parser)
3. **Frontend Token Mismatch** — Updated all components to use `dev-token-change-in-production`
4. **Missing Nav Component** — Created `src/app/components/layout/Nav.tsx`
5. **Responsive Grid** — Added `md:grid-cols-2` to GoalSelection page
6. **CI/CD Pipeline** — Configured GitHub Actions for auto-deployment to Cloudflare Pages

## 📚 Documentation

- `PLAN.md` — Master plan with 12-module roadmap
- `AGENTS.md` — Project instructions, coding standards, API spec
- `RESUME.md` — Current state and recent activity
- `src/styles/DESIGN.md` — Design token specification (source of truth for all visual decisions)
- `modules/` — Detailed module specifications

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
cd src/app && NEXT_PUBLIC_API_TOKEN=<value from workers/.dev.vars> npm run build
cd ../../workers && npm run build:pages          # bundles _worker.js into out/
npx wrangler pages dev ../src/app/out \
  --d1 DB=6216c466-c244-4c16-8569-c7281585fbc6 \
  --persist-to .wrangler/state                    # shares the local D1
```

Then the whole app is on `http://localhost:8788` — no CORS, no `NEXT_PUBLIC_API_URL`.
Set `NEXT_PUBLIC_API_URL` only when pointing the frontend at a *separate*
`wrangler dev` Worker, which is the one case CORS still applies.
