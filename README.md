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
| Cache | Cloudflare KV (sessions, lookups) |
| Auth | Bearer token (single-user, self-hosted) |
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

2. **Create D1 database and apply the schema**
   ```bash
   cd workers
   wrangler d1 create languagebuilder
   npx wrangler d1 execute languagebuilder --local --file=src/db/schema.sql
   ```

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

The frontend is a **static export** — it has no server, so it calls the Worker
by absolute URL. Both values are inlined at build time, so they must exist in the
CI environment, not at runtime.

1. **Worker secret** (not a `[vars]` entry — a var overwrites a same-named secret
   on every deploy):
   ```bash
   cd workers && npx wrangler secret put API_TOKEN
   ```
2. **GitHub Actions secrets** — Settings → Secrets and variables → Actions:
   - `API_TOKEN` — same value as step 1. The build fails loudly without it.
   - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` — for the Pages deploy.
3. **Optional repo variable** `NEXT_PUBLIC_API_URL` if the Worker moves off
   `languagebuilder.fojall.workers.dev`.
4. **Seed the user row on the remote database**, once:
   ```bash
   cd workers && npx wrangler d1 execute languagebuilder --remote --file=src/db/seed-user.sql
   ```
5. Add any new frontend origin to `ALLOWED_ORIGINS` in `workers/wrangler.toml`.

### Frontend (Cloudflare Pages)
Deploys automatically on push to `main`. CI typechecks the Worker and the
frontend first, and refuses to build without `API_TOKEN`.

```bash
git push origin main
```

**Production URL:** https://languagebuilder-frontend.pages.dev

### Backend (Cloudflare Workers)
Still deployed by hand — CI typechecks it but does not ship it:

```bash
cd workers && npx wrangler deploy
```

**Production URL:** https://languagebuilder.fojall.workers.dev

### Verifying a deploy

A green Actions run only proves the build compiled. To prove the two halves are
connected:

```bash
curl https://languagebuilder.fojall.workers.dev/health
curl -H "Authorization: Bearer $API_TOKEN" \
  https://languagebuilder.fojall.workers.dev/api/auth/profile
```

Then load the site and confirm a data-backed page renders rather than showing an
error card.

## 📊 Current Progress

### Phase 0: Design Foundation ✅
- [x] Design System (`src/styles/DESIGN.md`, `src/app/styles/globals.css`, `src/app/tailwind.config.ts`)
- [x] Component Library (18+ components across ui/, layout/, dashboard/, learning/, memorization/, assessment/, audio/)
- [x] Project Scaffolding (Next.js app, Workers backend, D1 schema)
- [x] Visual Verification Page (`src/styles/design-system-verification.html`)

### Design System Overhaul ✅
- [x] Added `lucide-react` dependency for icon system
- [x] Replaced all emoji icons with Lucide React icons (Sidebar, MobileNav, Onboarding, Dashboard)
- [x] Fixed globals.css anti-slop guard reference (MODULE-09 → DESIGN.md)
- [x] Added `.leading-arabic` utility class
- [x] Verified no hardcoded colors remain in components
- [x] Build succeeds with all changes

### Phase 1: MVP Feature Modules ✅
- [x] 01: Database Schema & Data Layer
- [x] 02: Assessment Engine
- [x] 03: Learning Engine
- [x] 04: Memorization Tracker
- [x] 05: Progress Dashboard & Onboarding

### Phase 2: Enhancement ✅
- [x] 06: Tajweed Visualization
- [x] 07: Grammar Deep-Dive

### Phase 3: Advanced Features
- [ ] 08: AI Tutor + Advanced Features (Not started)

### UI/UX Audit
- [x] Slice 1: React Rendering Verification
- [x] Slice 2: Visual Design Compliance
- [ ] Slice 3-8: User Flow, Accessibility, Mobile, Backend Integration, Content, Documentation

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
