# Language Builder — AGENTS.md

## Project Overview

**Language Builder** is a web application for learning Classical Arabic with a focus on Quran comprehension, grammar (nahw, sarf, balagha), and memorization (hifz). The app integrates diagnostic assessment, adaptive learning paths, spaced repetition memorization, tajweed visualization, and AI tutoring.

**Status:** All Phase 0, 1, and 2 modules built and deployed. Now working on Phase 3 advanced features.

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
├── src/                   # Source code
│   ├── app/               # Next.js 14 app directory
│   │   ├── app/           # App Router pages
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom hooks
│   │   ├── styles/        # Global CSS, design system
│   │   ├── tailwind.config.ts
│   │   ├── next.config.js
│   │   ├── package.json
│   │   └── postcss.config.js
│   └── ...                # Additional source files
├── workers/               # Cloudflare Workers backend
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── lib/           # Auth, DB wrapper, scoring, Quran service
│   │   └── db/            # Database schema
│   └── wrangler.toml      # Workers config
├── .github/workflows/     # CI/CD pipeline
│   └── deploy.yml         # Auto-deploy to Cloudflare Pages
├── content/               # Static content data
├── scripts/               # Dev scripts
└── modules/               # Design documentation per module
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS (no component library) |
| Backend | Hono, served as _worker.js inside the Pages output (one origin) |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 (audio, images) |
| Cache | none bound yet — KV was listed but never used |
| Auth | Cloudflare Access JWT when configured; shared bearer token otherwise |
| TTS | Cloudflare Workers AI or external API |
| STT | Cloudflare Workers AI (Whisper) or Azure |
| Quran Data | Quran.com API + Tanzil.net |
| CI/CD | GitHub Actions → Cloudflare Pages |

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

#### Phase 0: Design Foundation ✅ COMPLETE
These modules are **buildable artifacts**, not documentation. They establish the visual and structural layer that every subsequent module builds on.

1. ✅ **09-design-system** — Tailwind config, CSS custom properties, color tokens, typography, spacing, shadows, radius, motion, anti-slop checklist. Applied to `tailwind.config.ts` and global CSS.
2. ✅ **11-component-library** — 18+ React components (`Card`, `Button`, `ProgressBar`, `Badge`, `Input`, `Select`, `StatCard`, `LessonCard`, `MemorizationEntry`, `EmptyState`, `AppShell`, `PageHeader`, `Tabs`, `AyahAudioButton`). Implemented in `src/app/components/`.
3. ✅ **00-project-scaffolding** — Next.js app structure, routing, auth, shared types. Built on top of the design system and components.

#### Phase 1: MVP Feature Modules ✅ COMPLETE

Each module is built on the completed design system and component library from Phase 0.

1. ✅ **01-database-schema-and-data-layer** — D1 schema, seed data, API layer
2. ✅ **02-assessment-engine** — Diagnostic test, scoring algorithm, path assignment
3. ✅ **03-learning-engine** — Lessons, exercises, flashcards, grammar drills
4. ✅ **04-memorization-tracker** — Spaced repetition, audio review, progress tracking
5. ✅ **05-progress-dashboard-and-onboarding** — Dashboard, streaks, weekly goals, onboarding

#### Phase 2: Enhancement ✅ COMPLETE

6. ✅ **06-tajweed-visualization** — Color-coded Quran, makharij diagrams, audio sync
7. ✅ **07-grammar-deep-dive** — Sentence parser, conjugation, balagha, grammar checking

#### Phase 3: Advanced Features (In Progress)

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
- RESTful endpoints under `/api/` (no `/v1/` prefix)
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

### Automated (CI/CD)
The app automatically deploys to Cloudflare Pages when you push to the `main` branch:

```bash
git push origin main
```

The GitHub Actions workflow will:
1. Install dependencies
2. Build the Next.js app
3. Deploy to Cloudflare Pages

**Production URL:** https://languagebuilder-frontend.pages.dev

### Manual Deployment
```bash
# Install dependencies
cd src/app && npm install

# Build
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy out --project-name=languagebuilder-frontend --branch=main
```

### Environment Variables
Set these secrets in your GitHub repository:
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Pages write permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

### Cloudflare Pages Configuration
1. Connect your GitHub repository to Cloudflare Pages
2. Set build command: `cd src/app && npm run build`
3. Set output directory: `src/app/out`
4. Set production branch: `main`

---

## Security

### Environment Variables
- Secrets file: `.env` (contains Cloudflare API tokens and auth tokens)
- `.env` is in `.gitignore` and must never be committed
- Cloudflare API token for Workers/D1/R2 operations
- `AUTH_TOKEN` for API bearer token authentication

### Best Practices
- Never hardcode tokens in source code
- Use environment variables for all secrets
- Rotate API tokens periodically
- Monitor API usage in Cloudflare dashboard

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

## API Endpoints (Live)

Extracted from the mounted routes, not written by hand — the previous list named
four endpoints that never existed (`/api/auth/verify`,
`GET /api/auth/onboarding`, `POST /api/memorization/record`,
`POST /api/tajweed/analyze`, `GET /api/tutor/chat`) and omitted a dozen that do.

All `/api/*` routes require auth: a verified Cloudflare Access JWT when
`ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are set, otherwise the shared bearer
token. `/health` is public.

```
GET  /api/assessment/results
GET  /api/assessment/start
POST /api/assessment/submit
POST /api/auth/onboarding
GET  /api/auth/profile
GET  /api/auth/whoami
GET  /api/certificate/export
GET  /api/grammar/conjugations
GET  /api/grammar/deepdive/:category
GET  /api/grammar/root/:root              (corpus-derived root family, Arabic script)
GET  /api/grammar/word/:surah/:ayah/:word (grounded i'rab, one entry per segment)
GET  /api/grammar/drills/forms            (pattern drills; distractors are attested)
GET  /api/grammar/exercises               (754-item graded bank; ?level=1-5 &kind=)
GET  /api/grammar/exercises/summary       (counts by kind and level)
POST /api/grammar/exercise
GET  /api/grammar/mastery
POST /api/grammar/parse
GET  /api/learning/flashcards       (LEFT JOINs vocabulary for meaning/transliteration/root)
POST /api/learning/vocabulary/start (adds next unlearned words to the review queue)
POST /api/learning/flashcards/review
GET  /api/learning/lessons
GET  /api/learning/lessons/:id
POST /api/learning/lessons/:id/submit
GET  /api/learning/next
POST /api/memorization/:id/recall
POST /api/memorization/:id/review
POST /api/memorization/add          (validated: surah 1-114, ayah bounds from quran_verses)
GET  /api/memorization/curriculum   (908 ordered units; ?level=1-6 &limit &offset)
GET  /api/memorization/all
GET  /api/memorization/review/today
GET  /api/memorization/surah/:surahId
GET  /api/memorization/surahs
GET  /api/progress/dashboard
GET  /api/progress/scores
GET  /api/tajweed/mastery
POST /api/tajweed/practice/:ruleId/submit
GET  /api/tajweed/rules
GET  /api/tajweed/verses/:surahId
POST /api/tutor/chat
POST /api/tutor/feedback
GET  /api/tutor/history
GET  /api/tutor/suggested-exercises
GET  /health
```

Two of these return empty until the Quran text is ingested, which is blocked —
see `docs/HANDOFF-LOCAL-SESSION.md`:
`GET /api/tajweed/verses/:surahId` and the joined text in
`GET /api/memorization/review/today`.

`POST /api/tutor/*` is answered by a keyword matcher, not a model. `POST
/api/tutor/feedback` returns a fixed string.

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

## Definition of Done for UI/visual fixes

A successful build and a green deploy are **not proof a visual fix landed** —
they only prove the code compiles. A real session (2026-07-24/25,
"Modern Design System for Quran App") ran an 8-commit design-system overhaul
replacing emoji icons with Lucide across four components, all checks green,
deploy succeeded — but the live homepage was unchanged, because 3 of the 4
"fixed" files (`Onboarding.tsx`, `Dashboard.tsx`, `Sidebar.tsx`,
`MobileNav.tsx` minus `DeepDiveView.tsx`, which was a real fix) are dead
code, not imported by any route. Passing every code-level check (build
succeeds, no hardcoded colors, brace matching) said nothing about whether
the edited file is actually reachable from a URL.

Before calling any UI/visual fix complete:

1. **Confirm the file is reachable.** Find the actual route entry
   (`app/<route>/page.tsx`, or `app/page.tsx` for `/`, or `app/layout.tsx`
   for nav/shell chrome) and trace the import chain from there to the file
   you edited. If nothing under `app/` imports it, you edited dead code —
   go find the file the route actually renders instead.
2. **Re-fetch the live URL after deploy**, not just check that `git push`
   succeeded or `gh run list` shows green. Grep the actual served
   HTML/DOM for the specific thing you changed (e.g. absence of the emoji
   characters, presence of an `<svg>`). A green Actions run only proves the
   build compiled — it does not prove the visual defect is gone.

**Known orphaned files in this repo** (not imported by any route as of
2026-07-25 — confirm before "fixing," and consider deleting them or wiring
them up instead of patching in place):
`components/onboarding/Onboarding.tsx`, `components/dashboard/Dashboard.tsx`,
`components/layout/Sidebar.tsx`, `components/layout/MobileNav.tsx`.

---

## Common Tasks

### Running the Development Server
```bash
cd src/app
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
3. Implement API endpoints in `workers/src/routes/`
4. Build components in `src/app/components/`
5. Add tests in `src/app/__tests__/`
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
| Tailwind CSS not generating utility classes | Check `tailwind.config.ts` content paths match actual directory structure (use `./app/` not `./src/app/`) |
| `globals.css` corrupted | Restore from git — repeated `}` characters break CSS parser |
| Frontend showing raw JS instead of UI | Check CSS is loading (27KB+), verify Tailwind compiled correctly |
| `GET /api/auth/profile` returns 500 | No users exist yet in D1 - seed a real user, don't just retry. Frontend was also found using the hardcoded token `dev-token-change-in-production` instead of a real env-var token - fix both together, not just the symptom. |
| A "fixed" component doesn't show up live | You likely edited an orphaned file — see "Definition of Done for UI/visual fixes" above. Trace the route's import chain before editing. |

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

*Last updated: July 25, 2026*
