# Bayan — Architecture & UX Flow Audit

You are auditing the Bayan app. This is a Next.js 14 (App Router) frontend served as static pages on Cloudflare Pages, with a Hono-based Cloudflare Workers backend that exposes REST APIs and serves as the single origin. The database is Cloudflare D1 (SQLite). Auth is a shared bearer token.

## What to check

### 1. Architecture integrity
- Trace the full request path for one representative operation (e.g., completing a lesson → progress update → dashboard refresh). Are the frontend components calling the correct API endpoints? Are error states handled on the frontend when the API is unreachable?
- Confirm every page under `src/app/app/` imports a real route-level component (not orphaned code). Identify any files that exist but are never imported by any route.
- Verify the backend routing: every Hono route mounted under `workers/src/routes/` is actually bound and dispatched through `_worker.js`. No dead routes, no orphaned handlers.
- Confirm auth is checked consistently — every `/api/*` route (except `/health`) enforces auth via the same middleware. No endpoint bypassed.

### 2. UX flow completeness
- Start from `/` (entry point). Trace every nav path from landing → onboarding → today → lesson → review → dashboard → advanced. Is every transition wired? Are there dead ends (buttons that don't go anywhere, tabs with missing panels, links pointing to deleted pages)?
- For each of these primary flows, confirm the user always knows their next action:
  - New user (never onboarded)
  - Returning user who hasn't done a lesson today
  - Returning user with a review session ready
  - Returning user mid-lesson
- Check that the "next" button on a lesson/flashcard actually advances correctly and that the backend state is updated before showing the next step.

### 3. Data flow correctness
- Onboarding: does the assessment submit → score → path assignment actually update the user's profile in D1? Is the frontend reflecting the correct level/categories after submission?
- Memorization: when a user reviews a card, does the FSRS scheduler actually schedule the next review? Is the "today" feed populated from that schedule?
- Grammar exercises: do correct/incorrect answers update the mastery metric on the backend and persist? Is the dashboard reading from the same data the exercise submits to?
- Tajweed: does selecting a verse actually load word-level data from the API? Are the gloss/parse layers displayed correctly for each word?

### 4. Component integrity
- Every component in `src/app/components/` should be importable without breaking. Identify any that have import errors, missing dependencies, or reference props they don't declare.
- Check that all API calls have loading and error states. No spinner-less async, no blank screen on 500.
- Verify the design system tokens used in `tailwind.config.ts` and `globals.css` are consistent. No hardcoded colors or font families not defined in the system.

### 5. Mobile responsiveness
- The app is mobile-first. Check that the primary navigation, lesson cards, flashcard views, and grammar exercise components render correctly at 375px and 430px widths. Identify any layout breakage at narrow widths.

### 6. Content-data consistency
- Run `node scripts/gen-content-manifest.mjs --check` and report any mismatches.
- Run `node scripts/check-content.mjs` and report any orphaned or misreferenced content.
- Confirm lesson counts match the module docs (10 authored + generated per root, 418 total lessons).

### 7. Build health
- Run `cd src/app && npm run build` and report any warnings or errors.
- Check that the static export produces valid HTML for every route.

## Output format

Structure your report as:
1. **Summary** — 3-5 sentences on overall health
2. **Critical issues** (blocks, broken flows)
3. **High-priority issues** (broken UI, missing states)
4. **Medium-priority** (dead code, minor inconsistencies)
5. **Suggestions** (improvements, not currently broken)

For every issue: cite the file, line, and describe what should happen vs what actually happens.
