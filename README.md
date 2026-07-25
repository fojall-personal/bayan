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

2. **Create D1 database**
   ```bash
   wrangler d1 create languagebuilder
   wrangler d1 execute languagebuilder --local --file=workers/src/db/schema.sql
   ```

3. **Seed content**
   ```bash
   npx tsx scripts/seed-db.ts
   ```

4. **Run development servers**
   ```bash
   # Workers (backend)
   cd workers && npx wrangler dev

   # Next.js (frontend)
   cd src/app && npm run dev
   ```

5. **Set environment variables**
   - `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Pages/Workers permissions
   - `CLOUDFLARE_ACCOUNT_ID` — Your Cloudflare account ID
   - `AUTH_TOKEN` — API bearer token for authentication

## 🌐 Deployment

### Frontend (Cloudflare Pages)
The frontend automatically deploys when you push to the `main` branch:

```bash
git push origin main
```

**Production URL:** https://languagebuilder-frontend.pages.dev

### Backend (Cloudflare Workers)
Deploy the backend manually or via CI/CD:

```bash
cd workers && npx wrangler deploy
```

**Production URL:** https://languagebuilder.fojall.workers.dev

## 📊 Current Progress

### Phase 0: Design Foundation ✅
- [x] Design System (`src/app/tailwind.config.ts`, `src/app/styles/globals.css`)
- [x] Component Library (18+ components across ui/, layout/, dashboard/, learning/, memorization/, assessment/, audio/)
- [x] Project Scaffolding (Next.js app, Workers backend, D1 schema)

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
