# Vocabulary Plan Evals

This document describes the eval scripts created to validate the vocabulary tab implementation.

## Evals Created

### 1. `scripts/check-vocab-lessons.mjs`

Validates the structure of `content/grammar/vocabulary-lessons.json`:
- File exists and parses as valid JSON
- Exactly 103 lessons
- Each lesson has required fields: `id`, `title`, `category`, `content`, `exercises`
- `category` is `"vocabulary"`
- No duplicate `id` values
- `content.root` references a real word in `core-100.json`
- `content.examples[].arabic` contains Arabic characters
- Each exercise has a valid `answer` index within `options.length`
- Exercise `options` are unique strings
- Each exercise has an `explanation`

**Run:**
```bash
node scripts/check-vocab-lessons.mjs
```

### 2. `scripts/check-vocab-imports.mjs`

Verifies that the vocabulary components are wired into the grammar page:
- `src/app/app/grammar/page.tsx` imports and renders `VocabularyView`
- All three components exist: `VocabularyView.tsx`, `RootCard.tsx`, `RootFamilyDetail.tsx`
- `DeepDiveView.tsx` has a `vocabulary` key in its `EMPTY_REASON` map
- The grammar page renders the vocabulary view when the tab is selected

**Run:**
```bash
node scripts/check-vocab-imports.mjs
```

### 3. Route tests in `workers/test/routes.test.ts`

Tests the vocabulary API endpoints:
- `GET /api/vocabulary` returns all 103 roots sorted by frequency
- `GET /api/vocabulary?limit=N` respects the limit parameter
- `GET /api/vocabulary/root/:root` returns family data for known roots
- `GET /api/vocabulary/root/:root` returns 404 for unknown roots
- `POST /api/vocabulary/mastery` updates the database for correct answers
- `POST /api/vocabulary/mastery` handles incorrect answers

**Run:**
```bash
npx vitest run workers/test/routes.test.ts
```

## What These Evals Catch

1. **Missing implementation** — The route tests will fail if the vocabulary API endpoints are not implemented
2. **Incorrect content** — The lessons validation catches structural issues in `vocabulary-lessons.json`
3. **Dead code** — The import checker ensures components are actually wired into the UI
4. **Wrong EMPTY_REASON** — Verifies the deepdive view has the correct empty state message

## Pending Implementation

The following must be built for the evals to pass:

1. `content/grammar/vocabulary-lessons.json` — 103 vocabulary lessons
2. `workers/src/routes/vocabulary.ts` — API endpoints
3. `src/app/components/vocabulary/VocabularyView.tsx` — Main view
4. `src/app/components/vocabulary/RootCard.tsx` — Single root card
5. `src/app/components/vocabulary/RootFamilyDetail.tsx` — Root family detail
6. Update `src/app/app/grammar/page.tsx` — Wire in the vocabulary view
7. Update `src/app/components/grammar/DeepDiveView.tsx` — Add EMPTY_REASON entry
8. Register the route in `workers/src/index.ts`

## Why These Evals

The original plan proposed:
- `node scripts/gen-vocabulary-lessons.mjs --check` — **does not exist**
- `node scripts/check-content.mjs` — **exists but only validates core-100.json**
- `node scripts/test-vocabulary-api.mjs` — **does not exist**

The new evals:
- Validate the actual content file (`vocabulary-lessons.json`)
- Check component reachability (catches orphaned files)
- Test API endpoints at the route layer (catches wrong column names, malformed responses)
- Are runnable immediately (no dependency on scripts that don't exist yet)

## Running All Evals

```bash
# 1. Validate the lessons content
node scripts/check-vocab-lessons.mjs

# 2. Check component wiring
node scripts/check-vocab-imports.mjs

# 3. Run route tests
npx vitest run workers/test/routes.test.ts

# 4. Run all existing content checks (including vocabulary)
node scripts/check-content.mjs
```
