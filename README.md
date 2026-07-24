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
| Styling | Tailwind CSS + shadcn/ui |
| Backend | Cloudflare Workers (Hono framework) |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 (audio, images) |
| Cache | Cloudflare KV (sessions, lookups) |
| Auth | Bearer token (single-user, self-hosted) |
| Build | Wrangler 3 |

## 📦 Project Structure

```
languagebuilder/
├── content/           # Static content data (vocabulary, lessons, assessment, tajweed)
│   ├── vocabulary/    # Core Quranic words
│   ├── grammar/       # Grammar curriculum
│   ├── assessments/   # Diagnostic test questions
│   └── tajweed/       # Tajweed rule definitions
├── scripts/           # Dev scripts (seed-db.ts)
├── src/app/           # Next.js app
│   ├── app/           # App Router pages
│   ├── components/    # React components (ui, layout, dashboard, learning, etc.)
│   ├── hooks/         # Custom hooks
│   └── styles/        # Global CSS, design system
├── workers/           # Cloudflare Workers backend
│   ├── src/
│   │   ├── routes/    # API route handlers
│   │   ├── lib/       # Auth, DB wrapper, scoring, Quran service
│   │   └── db/        # Database schema
│   └── wrangler.toml  # Workers config
└── modules/           # Design documentation per module
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account (free tier is sufficient)

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
   - `NEXT_PUBLIC_API_TOKEN` — Match your Workers API_TOKEN
   - `API_TOKEN` — Set in Cloudflare dashboard or wrangler.toml

## 📊 Current Progress

### Phase 0: Design Foundation ✅
- [x] Design System (tailwind.config.ts, globals.css, verification page)
- [x] Component Library (18 components + 2 hooks)
- [x] Project Scaffolding (Next.js app, Workers backend, D1 schema)

### Phase 1: MVP Feature Modules
- [x] Module 01: Database Schema & Data Layer (10 core words, 5 grammar lessons, 18 assessment questions, 6 tajweed rules)
- [x] Module 02: Assessment Engine (scoring algorithm, adaptive path assignment, frontend flow)
- [x] Module 03: Learning Engine (lesson delivery, exercise rendering, flashcards, spaced repetition)
- [x] Module 04: Memorization Tracker (SM-2 spaced repetition, review sessions, surah progress)
- [x] Module 05: Progress Dashboard & Onboarding (dashboard, streak, onboarding flow, score history)

### Phase 2: Enhancement
- [x] Module 06: Tajweed Visualization (color-coded text, makharij, mastery tracking)



### Phase 3: Advanced Features
- [ ] Module 08: AI Tutor & Advanced Features

## 🔑 Key Decisions

- **Dark mode default** — No light mode toggle
- **Arabic line-height 2.0** — Generous spacing for Quranic text
- **Functional tajweed colors** — Not decorative, used for rule identification
- **Single-user auth** — Bearer token only, no registration flow
- **Cloudflare free tier** — $0/month hosting

## 📄 License

Private project. All rights reserved.

## 🙏 Acknowledgments

- Quran.com API for verse data
- Tanzil.net for Uthmani script
- Cloudflare for serverless infrastructure
