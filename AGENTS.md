# Language Builder — AGENTS.md

## Project Overview

**Language Builder** is a web application for learning Classical Arabic with a focus on Quran comprehension, grammar (nahw, sarf, balagha), and memorization (hifz). The app integrates diagnostic assessment, adaptive learning paths, spaced repetition memorization, tajweed visualization, and AI tutoring.

**Status:** MVP design complete (Phase 1 modules documented). Development phase.

---

## Workspace Structure

```
languagebuilder/
├── PLAN.md                 # Master project plan with 12-module roadmap
├── AGENTS.md              # This file — agent instructions
├── modules/               # Design documentation for each module
│   ├── 00-project-scaffolding.md
│   ├── 01-database-schema-and-data-layer.md
│   ├── 02-assessment-engine.md
│   ├── 03-learning-engine.md
│   ├── 04-memorization-tracker.md
│   ├── 05-progress-dashboard-and-onboarding.md
│   ├── 06-tajweed-visualization.md
│   ├── 07-grammar-deep-dive.md
│   ├── 08-ai-tutor-and-advanced-features.md
│   ├── 09-design-system.md
│   ├── 10-ux-design-specification.md
│   ├── 11-component-library.md
│   └── 12-page-ui-specifications.md
├── src/                   # (Future) Source code
│   ├── app/               # Next.js 14 app directory
│   ├── components/        # React components
│   ├── lib/               # Utilities, API clients, database
│   └── types/             # TypeScript type definitions
└── public/                # Static assets
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Backend | Cloudflare Workers (Hono framework) |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 (audio, images) |
| Cache | Cloudflare KV (sessions, quick lookups) |
| Auth | Bearer token (single-user, self-hosted) |
| TTS | Cloudflare Workers AI or external API |
| STT | Cloudflare Workers AI (Whisper) or Azure |
| Quran Data | Quran.com API + Tanzil.net |

---

## Design System

See `modules/09-design-system.md` and `modules/10-ux-design-specification.md`.

**Key design principles:**
- Dark mode default (gray-950 background)
- Arabic green primary (#22c55e)
- Gold secondary (#f59e0b)
- Arabic text requires generous line-height (2.0)
- Functional tajweed colors (not decorative)
- No fake metrics, no placeholder stats
- Every screen has a clear next action

---

### Build Phases

Modules are grouped into phases. Each phase must be completed before the next begins.

#### Phase 0: Design Foundation (1 week)

These modules are **buildable artifacts**, not documentation. They establish the visual and structural layer that every subsequent module builds on.

1. **09-design-system** — Tailwind config, CSS custom properties, color tokens, typography, spacing, shadows, radius, motion, anti-slop checklist. Applied to `tailwind.config.ts` and global CSS.
2. **11-component-library** — 15+ React components (`Card`, `Button`, `ProgressBar`, `Badge`, `Input`, `Select`, `StatCard`, `LessonCard`, `MemorizationEntry`, `QuizQuestion`, `AudioPlayer`, `EmptyState`, `AppShell`, `Sidebar`, `MobileNav`, `PageHeader`). Implemented in `src/components/`.
3. **00-project-scaffolding** — Next.js app structure, routing, auth, shared types. Built on top of the design system and components.

#### Phase 1: MVP Feature Modules (8 weeks)

Each module is built on the completed design system and component library from Phase 0.

1. **01-database-schema-and-data-layer** — D1 schema, seed data, API layer
2. **02-assessment-engine** — Diagnostic test, scoring algorithm, path assignment
3. **03-learning-engine** — Lessons, exercises, flashcards, grammar drills
4. **04-memorization-tracker** — Spaced repetition, audio review, progress tracking
5. **05-progress-dashboard-and-onboarding** — Dashboard, streaks, weekly goals, onboarding

#### Phase 2: Enhancement (8 weeks)

6. **06-tajweed-visualization** — Color-coded Quran, makharij diagrams, audio sync
7. **07-grammar-deep-dive** — Sentence parser, conjugation, balagha, grammar checking

#### Phase 3: Advanced Features (6 weeks)

8. **08-ai-tutor-and-advanced-features** — Chat interface, adaptive questions, certificate export

**Note:** Module 10 (UX Design Specification) defines the behavioral user flows and page wireframes. Module 12 (Page UI Specifications) defines the visual layout of every route. Both inform page implementation in Phase 0 and Phase 1 — they are implementation guides, not reference documents.

---

## Coding Standards

### TypeScript
- Strict mode enabled
- No `any` types — use proper interfaces
- Prefer functional components with hooks
- Use React Server Components where possible (Next.js 14 App Router)

### API Design (Cloudflare Workers)
- RESTful endpoints under `/api/v1/`
- Bearer token auth (single token, hardcoded for self-hosted)
- JSON responses with consistent error format: `{ error: string }`
- Rate limiting: 100 req/min per IP

### Database (D1)
- Use parameterized queries (no string interpolation)
- Index foreign keys and frequently filtered columns
- Migrations go in `src/lib/db/migrations/`
- Seed data in `src/lib/db/seed.ts`

### Components
- Keep components <150 lines (extract sub-components)
- Use TypeScript interfaces for props
- Implement loading and error states for every async component
- Arabic text containers use `dir="rtl"` and `lang="ar"`

---

## Testing Strategy

### Unit Tests (Vitest)
- API route handlers
- Database query functions
- Assessment scoring algorithm
- Spaced repetition scheduler

### Integration Tests
- Full user flow (onboarding → assessment → lesson → review)
- Audio recording/upload pipeline
- Tajweed color-coding logic

### E2E Tests (Playwright)
- Landing page → onboarding → dashboard
- Memorization review session
- AI tutor chat interaction

---

## Content Data

### Quran Data
- **Script:** Uthmani (Tanzil.net)
- **Translation:** Dr. Mustafa Khattab (The Clear Quran)
- **Audio:** Quran.com API (Alafasy, Abdul Basit, Minshawi)
- **Structure:** 114 surahs, 6236 ayahs, 30 juz

### Vocabulary
- 1000 most frequent Quranic words
- Categorized by surah, theme, part of speech
- Arabic-English translation pairs

### Grammar Curriculum
- 30 lessons covering nahw, sarf, balagha
- Interactive sentence parsing
- Conjugation tables (all verb forms)

---

## Authentication

Single-user bearer token authentication:
- Token stored in environment variable (`AUTH_TOKEN`)
- No registration or login flow (self-hosted)
- Token checked on every API request
- No JWT, no sessions — simple header validation

---

## Deployment

### Cloudflare
```bash
wrangler deploy
wrangler d1 execute languagebuilder-db --command="PRAGMA foreign_keys = ON"
```

### Prerequisites
1. Cloudflare account with Workers + D1 + R2
2. Domain configured (e.g., `learn.arabicbuilder.app`)
3. `AUTH_TOKEN` set in environment

### CI/CD
- GitHub Actions push to main → deploy to Cloudflare
- Preview deployments on PRs via Vercel or Cloudflare Preview

---

## Security

- No user passwords — bearer token only
- No PII collected beyond name/email
- Audio recordings stored in R2 with time-limited signed URLs
- D1 database queries parameterized (no SQL injection)
- Rate limiting on API endpoints

---

## Performance

- Static assets served via Cloudflare CDN
- Database queries indexed (target: <10ms query time)
- Audio streaming from R2 with range requests
- Images optimized (WebP, lazy loading)
- Next.js incremental static regeneration where applicable

---

## Internationalization (i18n)

Current state: English only  
Future: Arabic and Urdu support

Translation keys stored in `src/lib/i18n/`.  
Arabic UI strings use `dir="rtl"` on the root container.

---

## API Endpoints (Planned)

```
GET  /api/v1/user/profile
GET  /api/v1/assessment/start
POST /api/v1/assessment/submit
GET  /api/v1/assessment/results
GET  /api/v1/learning/lessons
GET  /api/v1/learning/lessons/:id
POST /api/v1/learning/lessons/:id/submit
GET  /api/v1/learning/flashcards
POST /api/v1/learning/flashcards/review
GET  /api/v1/memorization/surahs
POST /api/v1/memorization/record
GET  /api/v1/memorization/review
POST /api/v1/tajweed/analyze
GET  /api/v1/tutor/chat
POST /api/v1/tutor/chat
```

---

## Agent Workflow

**Work one slice at a time, not the whole roadmap in one session.** A real
session (2026-07-23) ran ~400 messages / an hour straight through repeated
"proceed with the next slice" nudges, hit the tool-call iteration cap once
already, and eventually got stuck in an unproductive loop re-checking API
responses without resolving the underlying issue (see the D1/auth-token row
above) - the long, un-delegated session made it hard to tell "still making
progress" from "stuck," and burned a lot of context doing it.

**For anything that's a full slice of work** (a whole module, a multi-file
feature, a backend+frontend integration pass): use `delegate_task` to run it
in a subagent with its own fresh turn budget, and only bring the summary
back into the main session. Don't chain slice after slice in one linear
conversation.

**If a fix attempt fails twice in a row, stop and report the exact error**
instead of retrying a third time or drifting into unrelated exploration
(e.g. don't go looking at alternate AI providers or unrelated tooling
mid-task - stay scoped to the actual problem in front of you).

---

## Common Tasks

### Running the Development Server
```bash
cd src
npm run dev
# http://localhost:3000
```

### Running Database Migrations
```bash
npx wrangler d1 execute languagebuilder-db --file=src/lib/db/migrations/001_initial.sql
```

### Adding a New Module
1. Create module doc in `modules/` following the template
2. Create database tables in migration file
3. Implement API endpoints in `src/lib/api/`
4. Build components in `src/components/`
5. Add tests in `src/__tests__/`
6. Update `PLAN.md` progress tracking

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| D1 connection timeout | Check Wrangler config, ensure D1 binding is set |
| Audio upload fails | Verify R2 bucket exists and CORS is configured |
| Arabic text rendering broken | Check `lang="ar"`, `dir="rtl"`, font loaded |
| Speech recognition inaccurate | Fallback to manual review, log errors |
| Build fails on next export | Ensure all pages use static data or ISR |
| `GET /api/auth/profile` returns 500 | No users exist yet in D1 (real, hit 2026-07-23) - seed a real user, don't just retry. Frontend was also found using the hardcoded token `dev-token-change-in-production` instead of a real env-var token - fix both together, not just the symptom. |

---

## Success Metrics (From PLAN.md)

| Metric | Target |
|--------|--------|
| Session duration | 20+ minutes |
| Lessons per week | 5+ |
| Weekly return rate | 70%+ |
| Assessment improvement | +20% in 3 months |
| Vocabulary retention | 80%+ after 30 days |

---

## References

- **PLAN.md** — Full project roadmap
- **modules/** — Detailed design documentation per module
- **Quran.com API** — https://api.quran.com/
- **Tanzil.net** — https://tanzil.net/
- **Next.js 14 Docs** — https://nextjs.org/docs
- **Cloudflare Workers Docs** — https://developers.cloudflare.com/workers/

---

*Last updated: July 24, 2026*
