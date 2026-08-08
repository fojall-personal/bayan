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

**Single source of truth: `src/app/styles/globals.css`.** `tailwind.config.ts`
mirrors it and `node scripts/gen-design-system.mjs --check` fails the build if the
two disagree. The published reference lives in the "Bayan — Design System" project
on claude.ai/design and is generated from globals.css, never hand-written.

`modules/09-design-system.md` and `modules/10-ux-design-specification.md` are the
ORIGINAL specs and describe a palette the app no longer uses. Do not take colours
from them.

**Key design principles:**
- Always dark. No light mode, no `dark:` variants.
- Deep green ground (`ground-950` #071411 canvas), gold accent (`gold-500`
  #c9a227), living green for progress (`leaf-500` #3e9b72)
- Never pure white text — cream ink (`ground-50` #f2ead7) at 15.7:1
- Gold means "act here". Progress and success use leaf, so the accent keeps its
  meaning
- Arabic needs room: `leading-arabic` is 2.1
- Two Arabic faces, one job each: Amiri for ayat, Noto Naskh for teaching text.
  Never set `direction` on mixed text — use `.text-naskh` with `dir="auto"`
- Functional tajweed colors (not decorative) — do not borrow them for decoration
- Write full class names. `bg-${x}-500` generates nothing, and neither does a
  token the palette never defined
- No fake metrics, no placeholder stats
- Every screen has a clear next action

---

### Build Phases

Modules are grouped into phases. Each phase must be completed before the next begins.

#### Phase 0: Design Foundation ✅ COMPLETE
These modules are **buildable artifacts**, not documentation. They establish the visual and structural layer that every subsequent module builds on.

1. ✅ **09-design-system** — Tailwind config, CSS custom properties, color tokens, typography, spacing, shadows, radius, motion, anti-slop checklist. Applied to `tailwind.config.ts` and global CSS.
2. ✅ **11-component-library** — 18+ React components (`Card`, `Button`, `ProgressBar`, `Badge`, `Input`, `Select`, `LessonCard`, `MemorizationEntry`, `EmptyState`, `AppShell`, `PageHeader`, `Tabs`, `AyahAudioButton`). `StatCard` was removed with `/dashboard`. Implemented in `src/app/components/`.
3. ✅ **00-project-scaffolding** — Next.js app structure, routing, auth, shared types. Built on top of the design system and components.

#### Phase 1: MVP Feature Modules ✅ COMPLETE

Each module is built on the completed design system and component library from Phase 0.

1. ✅ **01-database-schema-and-data-layer** — D1 schema, seed data, API layer
2. ✅ **02-assessment-engine** — Diagnostic test, scoring algorithm, path assignment
3. ✅ **03-learning-engine** — Lessons, exercises, flashcards, grammar drills
4. ✅ **04-memorization-tracker** — FSRS-6 spaced repetition, progress tracking. No audio
   review: recording was never built.
5. ✅ **05-progress-dashboard-and-onboarding** — onboarding, coverage, and a weekly
   activity calendar. `/dashboard` was deleted and Today is the entry point; there is no
   streak counter.

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
- Rate limiting: not implemented — no per-IP or per-token request limiting exists anywhere in workers/src/

### Database (D1)
- Use parameterized queries (no string interpolation)
- Index foreign keys and frequently filtered columns
- Migrations go in `workers/src/db/migrations/`, numbered and applied in order
- Seed data in `workers/src/db/seed-user.sql` and `scripts/seed-lessons.sql` (generated)

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

None exist. The equivalent coverage lives in `workers/test/routes.test.ts`, which
dispatches every endpoint through the real Hono app against a real SQLite database built
from the migrations — see "Route-layer tests" below. Listed here as intent, not as fact:
- Landing page → onboarding → Today
- Memorization review session
- AI tutor chat interaction

---

## Content Data

This section described a plan, not the build, and three of its claims were wrong: the
translation is Saheeh International rather than Khattab, the grammar curriculum is 418
lessons rather than 30, and the vocabulary file holds 103 words rather than 1,000. Corrected
against the files, and every number below is either checked by a gate or cheap to re-derive.

### Sources, and what each licence requires

Every one is pinned by SHA-256 in the script that ingests it. **The first four require
attribution wherever the data is DISPLAYED**, not merely in a doc — the reader, the exercise
runner and the tutor each carry a source line, and removing one is a licence breach rather
than a tidiness question.

| Source | Gives | Licence |
|---|---|---|
| Quranic Arabic Corpus v0.4 (Kais Dukes) | 128,219 morphology segments — what a word IS | GNU GPL |
| Extended Quranic Treebank (Nashir et al., *Data in Brief* 62:111940, 2025, doi:10.1016/j.dib.2025.111940) | 117,947 syntax rows — what a word DOES, plus 11,157 elided tokens | CC BY 4.0 |
| Arabic Rhetorical Device Taxonomy v0.1.1 | 95 device names. No Quranic annotation, no exercises | CC BY 4.0 |
| quran-align | 154,799 word timings, two reciters | CC BY |
| Tanzil | Uthmani text and the Saheeh International translation | CC BY |

**The treebank is the one source that is not hand-verified** — 95.7% LAS on a 350-sentence
sample, no corpus-wide IAA. Never derive an exercise from it alone: `gen-syntax-exercises.mjs`
emits only where its relation and the morphology's case concur, and `ingest-treebank.mjs`
refuses a release whose agreement has fallen. If you add a syntax-derived kind, keep that
rule or say in the code why it does not apply.

### Quran data
- **Script:** Uthmani, Tanzil, SHA-pinned. 114 surahs, 6,236 ayahs
- **Translation:** Saheeh International via Tanzil, SHA-pinned
- **Audio:** everyayah.com — Alafasy, Al-Husary, Al-Minshawi (`src/app/lib/ayah-audio.ts`).
  Word-level timings exist for Alafasy only; Husary is offered but quran-align covers a
  different encode of it, so highlighting is off rather than approximate
- **Glosses:** 77,429 word-by-word, 96.2% agreement with five independent translators

### Vocabulary
- `content/vocabulary/core-100.json` — 132 authored entries
- The live flashcard queue is not that file: it is drawn from the ayahs the learner is
  memorising, content words first, commonest-in-the-Quran first, each card citing its source

### Grammar curriculum
- 418 lessons: 10 authored, 408 generated one-per-root from the corpus
- Authored lessons carry `category` — `nahw` or `sarf`. Generated ones carry none, because
  they teach vocabulary in a root family and are not one of the three disciplines
- Balagha has no lessons. It has three derived exercise kinds — fronting, jinās, tashbīh —
  and the Rhetoric tab says so. Metaphor and metonymy are not derivable and no available
  source annotates them
- 38,995 exercises across 25 kinds; `gen-content-manifest.mjs --check` holds every count
  quoted in prose to what is actually in the database

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
- No rate limiting on API endpoints (not yet implemented)

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

## Gates (run these before assuming anything)

Nine generated-and-gated checks, each proven to fail on a seeded defect. Anything a doc
or a comment asserts about counts, endpoints, tokens or content is checked by one of
them — so if a number here disagrees with the code, run the gate rather than trusting the
prose.

```bash
node scripts/check-content.mjs              # lesson claims vs the corpus
node scripts/check-pedagogy.mjs             # reachability, gradability, explanations
node scripts/gen-lessons-sql.mjs --check    # content edited but not reseeded
node scripts/gen-root-lessons.mjs --check   # generated lessons vs corpus; answer-position bias
node scripts/gen-design-system.mjs --check  # token drift, Arabic shaping, lang="ar"
node scripts/gen-api-docs.mjs --check       # this file's endpoint/page lists, envelopes, orphans
node scripts/gen-db-types.mjs --check       # row types vs migrations
node scripts/gen-content-manifest.mjs --check   # content counts quoted in prose
node scripts/ingest-ardt.mjs --check        # rhetorical-device names resolve to the taxonomy
node scripts/sync-pages-config.mjs --check  # Pages bindings (needs Cloudflare creds)
```

Three read `data/` or `.wrangler/`, both gitignored, so neither exists on a CI runner:
`check-content`, the corpus half of `gen-root-lessons`, and the re-parse half of
`ingest-ardt`. The last two degrade to structural checks and SAY the comparison was
skipped rather than passing silently — the shape to copy if you add another.

Not a gate, and must not become one: `node scripts/ingest-treebank.mjs --verify-only`.
It validates the treebank against the morphology and asserts the relation/case agreement
that every syntax-derived exercise depends on, but there is nothing to check without the
57 MB source, so it belongs on a machine that has it. Run it after changing anything about
how that layer is trusted.

## Route-layer tests

`workers/test/helpers/harness.ts` runs the real app through Hono's `app.request()`
against node:sqlite, with the schema applied from the REAL migration files. Content
tables are left empty on purpose: SQLite raises on an unknown column even with no rows,
which catches the largest bug class this repo has had — a wrong column name.

## Lesson content

Lives in `content/grammar/` (ten authored lessons plus sixty generated per-root) and is
deployed by CI, which applies `scripts/seed-lessons.sql` through D1's query API before the
Pages deploy. Regenerate the seed after any content edit; `gen-lessons-sql.mjs --check`
fails the build otherwise. `wrangler d1 execute --file` will NOT work for this — it uses
the import API, which the token is not permitted for; the query API is.

## API Endpoints (Live)

Extracted from the mounted routes, not written by hand — the previous list named
four endpoints that never existed (`/api/auth/verify`,
`GET /api/auth/onboarding`, `POST /api/memorization/record`,
`POST /api/tajweed/analyze`, `GET /api/tutor/chat`) and omitted a dozen that do.

All `/api/*` routes require auth: a verified Cloudflare Access JWT when
`ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are set, otherwise the shared bearer
token. `/health` is public.

```
GET    /api/assessment/results
POST   /api/assessment/submit
POST   /api/auth/onboarding
GET    /api/auth/profile
GET    /api/auth/whoami
GET    /api/certificate/export
GET    /api/grammar/deepdive/:category
POST   /api/grammar/exercise
GET    /api/grammar/exercises         (38,995-item graded bank; ?level=1-5 &kind=)
GET    /api/grammar/mastery
POST   /api/grammar/parse
GET    /api/grammar/root/:root        (corpus-derived root family, Arabic script)
GET    /api/learning/flashcards
POST   /api/learning/flashcards/review
GET    /api/learning/lessons/:id
POST   /api/learning/lessons/:id/submit
GET    /api/learning/next
POST   /api/learning/vocabulary/start
POST   /api/memorization/:id/recall
POST   /api/memorization/:id/review
POST   /api/memorization/add
GET    /api/memorization/curriculum   (908 ordered units; ?level=1-6 &limit &offset)
GET    /api/memorization/review/today
GET    /api/memorization/surah/:surahId
GET    /api/memorization/surahs
GET    /api/progress/calibration      (GET twelve sampled roots, POST records answers + opt-in band)
POST   /api/progress/calibration      (GET twelve sampled roots, POST records answers + opt-in band)
GET    /api/progress/coverage         (ayahs readable from known roots; 400 roots is half the Quran)
GET    /api/progress/reading-queue
DELETE /api/progress/roots/:root/known(POST records, DELETE undoes; POST returns the delta)
POST   /api/progress/roots/:root/known(POST records, DELETE undoes; POST returns the delta)
GET    /api/progress/scores
GET    /api/quran/ayah/:surah/:ayah   (one ayah: text, words + gloss + parse + known flag, tajweed)
GET    /api/tajweed/mastery
GET    /api/tajweed/verses/:surahId
POST   /api/tutor/chat
GET    /api/tutor/history             (last 50 turns; the chat restores the most recent three)
GET    /api/tutor/suggested-exercises (weak lessons by accuracy over answered questions)
GET    /api/vocabulary
GET    /api/vocabulary/root/:root
GET    /api/vocabulary/word/:word
GET    /health
```

## Pages (Live)

Generated by `scripts/gen-api-docs.mjs`. An orphan is reachable only by typing
the URL, which is how `/dashboard` went unnoticed after the nav shrank.

```
/              (entry — routes by profile)
/advanced
/assessment
/calibrate
/grammar
/learning
/memorization
/progress
/read
/root
/tajweed
/today
/tutor
```

The text ingest has run, so nothing here returns empty for want of data:
`quran_verses` holds all 6,236 verses with tajweed tags and a Saheeh International
translation, `quran_word_gloss` 77,429 word glosses, and `quran_word_morphology`
128,219 segments.

`POST /api/tutor/chat` is corpus lookups, not a model — it answers a word, a root, a
location or a named tajweed rule, and says the corpus is silent rather than guessing.
`POST /api/tutor/feedback` still returns a fixed string.

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
`components/onboarding/Onboarding.tsx`,
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
cd workers && npx wrangler d1 migrations apply languagebuilder --local
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
