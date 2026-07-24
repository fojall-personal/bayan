# Language Builder — Resume

## Project Overview
Web app for learning Classical Arabic with focus on Quran comprehension, grammar (nahw, sarf, balagha), and memorization (hifz). Next.js 14 frontend + Cloudflare Workers backend (Hono), D1 database, R2 for audio. Single-user bearer token auth.

## Current State: Phase 0 Complete (Design System + Component Library)

### Phase 0 — Buildable Artifacts
1. ✅ **Design System** (`modules/09`) — `src/app/tailwind.config.ts`, `src/app/styles/globals.css`, verification HTML. Dark mode default, Arabic green (#22c55e) primary, gold secondary, functional tajweed colors, Arabic line-height 2.0.
2. ✅ **Component Library** (`modules/11`) — 18 components + 2 hooks. `src/app/components/` with ui/, layout/, dashboard/, learning/, memorization/, assessment/, audio/ directories. Hooks: useLocalStorage, useAudioRecorder.
3. ✅ **Project Scaffolding** (`modules/00`) — Next.js app (layout, page, API route), Workers backend (Hono, D1 wrapper, auth, 5 route files), D1 schema (8 tables + indexes), shared types.

### Phase 1 — MVP Feature Modules
1. ✅ **01: Database Schema & Data Layer** — Content seed files (vocabulary, grammar, assessment, tajweed), seed script, Quran API service. Content: 10 core words, 5 grammar lessons, 18 assessment questions, 6 tajweed rules.
2. ✅ **02: Assessment Engine** — Scoring algorithm (weighted composite: 20% literacy, 30% comprehension, 25% grammar, 25% memorization), adaptive path assignment (Path 1/2/3 based on weakest area), frontend assessment flow (4-module diagnostic UI), results dashboard with visual breakdown.
3. ✅ **03: Learning Engine** — Lesson delivery with prerequisite checking and path-based ordering, exercise rendering (multiple choice, fill-blank, match), vocabulary flashcards with spaced repetition quality rating (Again/Hard/Good/Easy), learning page with Lessons/Flashcards tab switcher.
- 02: Assessment engine (diagnostic test, scoring)
- 03: Learning engine (lessons, exercises, flashcards)
- 04: Memorization tracker (spaced repetition)
- 05: Progress dashboard + onboarding

### Phase 2 — Enhancement (Not Started)
- 06: Tajweed visualization
- 07: Grammar deep-dive

### Phase 3 — Advanced (Not Started)
- 08: AI tutor + advanced features

## Key Files
- `PLAN.md` — Master plan with 12-module roadmap
- `AGENTS.md` — Project instructions, coding standards, API spec
- `modules/00-project-scaffolding.md` — Full spec for next slice (architecture, file structure, types)
- `modules/09-design-system.md` — Design tokens reference
- `modules/11-component-library.md` — Component specs reference
- `src/app/tailwind.config.ts` — Tailwind theme (compiled from design system)
- `src/app/styles/globals.css` — CSS custom properties + base components
- `src/app/components/` — All React components

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, App Router |
| Styling | Tailwind CSS + shadcn/ui (planned) |
| Backend | Cloudflare Workers (Hono framework) |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 (audio, images) |
| Cache | Cloudflare KV (sessions, lookups) |
| Auth | Bearer token (single-user, self-hosted) |
| Build | Wrangler 3 |

## Decisions & Constraints
- Dark mode is **always-on** (no light mode toggle)
- Arabic text uses `line-height: 2.0` via CSS variable
- No fake metrics, no placeholder stats, no generic SaaS patterns
- Tajweed colors are functional, not decorative
- Progress indicators use green, not generic blue
- Single-user app — bearer token only, no registration/login flow

## Next Slice: Phase 1 — Module 04 (Memorization Tracker)
Build spaced repetition for hifz: memorization entries (surah/ayah tracking), review scheduling, audio playback integration, and progress visualization.

## GitHub
- Remote: `https://github.com/fojall-personal/languagebuilder.git`
- Branch: `main`
- Latest commit: `a887ff3` — Project Scaffolding (Workers backend + Next.js frontend)
