# Frontend Audit — 2026-07-26

**Date:** 2026-07-26  
**Auditor:** AI coding session  
**Scope:** All routes, navigation links, interactive features  
**Method:** Code review + curl tests + browser verification

---

## Executive Summary

**10 routes exist**, all rendering 200 OK.  
**7 of 7 nav links** point to working pages.  
**1 route (`/advanced`) is unreachable** via navigation.  
**3 features are significantly broken** (see Critical Issues below).

---

## Routes Audit

| Route | File | Renders | Data Source | Status |
|-------|------|---------|-------------|--------|
| `/` | `src/app/app/page.tsx` | ✅ Goal selection | LocalStorage | Working |
| `/dashboard` | `src/app/app/dashboard/page.tsx` | ✅ Stats, progress | `GET /api/progress/dashboard` | Working |
| `/assessment` | `src/app/app/assessment/page.tsx` | ✅ Flow or results | `GET/POST /api/assessment/*` | Working |
| `/learning` | `src/app/app/learning/page.tsx` | ✅ Lessons, flashcards | `GET /api/learning/*` | Working |
| `/memorization` | `src/app/app/memorization/page.tsx` | ✅ Surahs, due today | `GET /api/memorization/*` | Working |
| `/grammar` | `src/app/app/grammar/page.tsx` | ✅ Deep-dive | `GET /api/grammar/*` | Working |
| `/tajweed` | `src/app/app/tajweed/page.tsx` | ⚠️ Placeholder | `GET /api/tajweed/*` | Partial |
| `/tutor` | `src/app/app/tutor/page.tsx` | ✅ Chat interface | `POST /api/tutor/chat` | Working |
| `/progress` | `src/app/app/progress/page.tsx` | ✅ Score history | `GET /api/progress/scores` | Working |
| `/advanced` | `src/app/app/advanced/page.tsx` | ✅ Audio test, cert | `GET /api/memorization/*` | ⚠️ No nav link |

---

## Navigation Audit

**File:** `src/app/components/layout/Nav.tsx`

All 7 links use Next.js `<Link>` and work:

```typescript
const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/learning', label: 'Learn' },
  { href: '/memorization', label: 'Memorize' },
  { href: '/tajweed', label: 'Tajweed' },
  { href: '/grammar', label: 'Grammar' },
  { href: '/tutor', label: 'Tutor' },
  { href: '/progress', label: 'Progress' },
];
```

**Missing:** No link to `/advanced`.

---

## Critical Issues

### 1. Flashcard Meanings Hardcoded

**File:** `src/app/components/learning/Flashcards.tsx:108-118`

```typescript
{currentCard.word === 'اللَّه' ? 'God' :
 currentCard.word === 'رَّحْمَٰن' ? 'The Most Merciful' :
 ...
 'Meaning'}   // <-- any unmatched word shows "Meaning"
```

**Impact:** Only ~10 words have translations. All others show literal "Meaning" text.

**Fix:** Fetch meanings from API or vocabulary database.

---

### 2. Tajweed Reader Tab is Placeholder

**File:** `src/app/app/tajweed/page.tsx:87-115`

The Reader tab renders a static placeholder card instead of actual Quran text with tajweed coloring. The `TajweedViewer` component exists at `src/app/components/tajweed/TajweedViewer.tsx` and is fully functional, but **it is never rendered by the page**.

**Fix:** Wire up `TajweedViewer` with verse data from `GET /api/tajweed/verses/:surahId`.

---

### 3. No UI to Add Memorization Entries

**File:** `src/app/app/memorization/page.tsx`

The memorization tracker has no way to add ayahs. The endpoint (`POST /api/memorization/add`) works, the scheduler works, migration 0005 works — but **no UI calls it**.

**Impact:** The entire memorization feature is unusable.

**Fix:** Add "Add Ayah" button + form to memorization page.

---

## Medium Issues

### 4. `/advanced` Route Unreachable

**File:** `src/app/components/layout/Nav.tsx:38-46`

The `/advanced` page exists but has no link in the navigation. Users can only reach it by typing the URL.

**Fix:** Add `{ href: '/advanced', label: 'Advanced' }` to `LINKS` array.

---

### 5. Audio Playback is Fake

**File:** `src/app/components/memorization/ReviewSession.tsx:29-31`

```typescript
const handlePlayAudio = () => {
  setAudioPlaying(true);
  setTimeout(() => setAudioPlaying(false), 3000);  // Just a timer
};
```

**Fix:** Integrate Quran Foundation API for reciter audio URLs.

---

### 6. `TajweedViewer` is Orphaned

**File:** `src/app/components/tajweed/TajweedViewer.tsx`

Fully functional component that is never imported or used by any route.

**Fix:** Wire to tajweed page (see Critical #2).

---

## Low Issues (Polish)

| # | Issue | File | Lines |
|---|-------|------|-------|
| 7 | Dashboard quick actions use `<a>` instead of `<Link>` | `Dashboard.tsx` | 106-121 |
| 8 | Progress page uses `window.location.href` | `progress/page.tsx` | 73-75 |
| 9 | Progress weekly calendar is static UI | `progress/page.tsx` | 153-182 |
| 10 | ReviewSession record button uses emoji | `ReviewSession.tsx` | 88 |
| 11 | `StatCard` uses hardcoded gray colors | `StatCard.tsx` | 12-13 |
| 12 | `MakharijDiagram` accepts `selectedLetter` prop but receives none | `tajweed/page.tsx` | 117 |

---

## Recommended Fix Order

1. **Fix flashcard meanings** — High impact, blocks learning feature
2. **Wire up Tajweed Viewer** — Core feature (F1)
3. **Add memorization entry UI** — Blocks hifz tracker (F2)
4. **Add `/advanced` nav link** — Minor but easy
5. **Fix audio playback** — Blocks F10

---

## What's Working (For Reference)

- Assessment flow (18 questions, scoring, retake)
- Learning lessons (graded exercises, progression)
- Memorization due today (fetches, reviews)
- Grammar deep-dive (parser, conjugation tables)
- Tajweed mastery tab (per-rule percentages)
- AI Tutor chat (keyword matcher)
- Progress dashboard (score history)
- Onboarding flow (goal selection)

---

## Orphaned Files (Outdated — AGENTS.md list)

The AGENTS.md list of orphaned files is partially outdated:

- `components/layout/Sidebar.tsx` — **Deleted** (already removed)
- `components/layout/MobileNav.tsx` — **Deleted** (already removed)
- `components/onboarding/Onboarding.tsx` — **NOT orphaned** (imported by Dashboard)
- `components/dashboard/Dashboard.tsx` — **NOT orphaned** (imported by /dashboard)

The actual navigation is via `Nav.tsx` (replaced Sidebar + MobileNav).

---

## Infrastructure Notes

### API Layer

All API calls require `NEXT_PUBLIC_API_TOKEN` at build time. If missing, `assertConfigured()` throws `ApiConfigError` and pages show error messages.

### Routes Reachability

```
/ (home) ----[CTA]----> /assessment
/assessment ----[Continue]----> /learning
/dashboard ----[Quick Actions]----> /learning, /memorization, /assessment
/progress ----[Empty State]----> /assessment (via window.location)
Nav ----[7 links]----> /dashboard, /learning, /memorization, /tajweed, /grammar, /tutor, /progress
```

### Missing: No link from any page to `/advanced`

The `/advanced` route is completely isolated from the navigation graph.

---

## Audit Methodology

1. Read all route files in `src/app/app/`
2. Read navigation component `src/app/components/layout/Nav.tsx`
3. Curl-test all 10 routes for 200 OK
4. Review interactive components for broken handlers
5. Verify API endpoints exist and respond
6. Check for orphaned components (files not imported by any route)

---

## Conclusion

The frontend is **functional but incomplete**. All pages render, all navigation works, but three critical features block real usage:

1. Flashcards show garbage for most words
2. Tajweed Reader is a placeholder
3. No way to add memorization entries

Fixing these would make the app **genuinely usable** for its intended audience.
