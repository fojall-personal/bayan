# UI/UX Audit — Bug List (Prioritized)

**Date:** July 24, 2026  
**Source:** Master Report `docs/UI-UX-AUDIT-REPORT.md`

---

## 🔴 Critical (Must Fix Before Launch)

### BUG-001: Auth Headers Broken (Template Literal Missing Backticks) ✅ FIXED
- **Severity:** Critical
- **Status:** Fixed in commit
- **Pages Affected:** All API-calling pages (assessment, progress, memorization, tajweed, tutor, advanced)
- **Symptom:** API calls return 401/403/500 — authorization header was literally `"Authorization: *** ${token}"`
- **Files:** `assessment/AssessmentFlow.tsx:181`, `assessment/page.tsx:16`, `progress/page.tsx:28`, `memorization/page.tsx:44,63`, `tajweed/page.tsx:37`, `tutor/TutorChat.tsx:42`, `AdvancedMemorizationTools.tsx:23,53,88`
- **Fix:** Added backticks to all template literals: `` Authorization: `Bearer ${token}` ``

### BUG-002: Hardcoded Dev Token Visible in Source ✅ FIXED
- **Severity:** Critical
- **Status:** Fixed in commit
- **Pages Affected:** All API-calling pages
- **Symptom:** Anyone viewing page source sees the token: `dev-token-change-in-production`
- **Files:** 12 files across the app (see terminal grep output for full list)
- **Fix:** Removed `|| 'dev-token-change-in-production'` and `|| 'dev-token'` fallbacks from all locations

---

## 🟠 High (Should Fix This Sprint)

### BUG-003: No Active Nav State
- **Severity:** High
- **Pages Affected:** All pages
- **Symptom:** User can't tell which page they're on from the nav bar
- **Files:** `components/layout/Nav.tsx`
- **Fix:** Use `usePathname()` to highlight current page link

### BUG-004: Nav Missing 4 Pages
- **Severity:** High
- **Pages Affected:** All pages
- **Symptom:** Tajweed, Grammar, Tutor, Advanced not accessible from nav
- **Files:** `components/layout/Nav.tsx`
- **Fix:** Add links to nav or create secondary nav

### BUG-005: Empty State No CTA on Progress
- **Severity:** High
- **Pages Affected:** `/progress`
- **Symptom:** User sees "No data yet" but can't easily navigate to assessment
- **Files:** `app/progress/page.tsx`
- **Fix:** Add "Take Diagnostic Assessment →" button

### BUG-006: alert() Used 3 Times in Advanced Memorization
- **Severity:** High
- **Pages Affected:** `/advanced`
- **Symptom:** Browser popup interrupts UX flow
- **Files:** `components/memorization/AdvancedMemorizationTools.tsx:29,77`
- **Fix:** Replace with toast/in-component message

---

## 🟡 Medium (Fix Before GA)

### BUG-007: Tab Switchers Not Keyboard Accessible
- **Severity:** Medium
- **Pages Affected:** `/learning`, `/memorization`, `/tajweed`
- **Files:** All tab switcher components
- **Fix:** Add `role="tablist"`, `role="tab"`, `aria-selected`, Arrow key handlers

### BUG-008: No Error Boundary
- **Severity:** Medium
- **Pages Affected:** All pages
- **Files:** `app/layout.tsx`
- **Fix:** Add Next.js `ErrorBoundary` wrapper

### BUG-009: Assessment Only 8 Questions Total
- **Severity:** Medium
- **Pages Affected:** `/assessment`
- **Files:** `components/assessment/AssessmentFlow.tsx`
- **Fix:** Expand to 10-15 questions per module, update time estimate

### BUG-010: Tutor Suggestion Buttons Don't Auto-Submit
- **Severity:** Medium
- **Pages Affected:** `/tutor`
- **Files:** `components/tutor/TutorChat.tsx`
- **Fix:** Auto-submit on suggestion click or label "Send: <text>"

### BUG-011: Non-Semantic Color Usage for Scores
- **Severity:** Medium
- **Pages Affected:** `/assessment` results, `/progress`
- **Files:** `components/assessment/AssessmentResults.tsx:69`, `app/progress/page.tsx:83`
- **Fix:** Use design system semantic colors (success/warning/info)

---

## 🟢 Low (Nice to Have)

### BUG-012: Hero Not Full Viewport
- **Files:** `app/page.tsx:17`
- **Fix:** Change `min-h-[85vh]` to `min-h-screen`

### BUG-013: Emoji Icons Missing aria-label
- **Files:** `app/page.tsx`, `components/layout/Nav.tsx`
- **Fix:** Add `aria-label` to emoji spans

### BUG-014: Mobile Menu Not Focus-Trapped
- **Files:** `components/layout/Nav.tsx`
- **Fix:** Add `role="dialog"`, `aria-modal`, focus trap when open

### BUG-015: Input Always RTL
- **Files:** `components/tutor/TutorChat.tsx:152`
- **Fix:** Toggle based on detected script direction

### BUG-016: No Viewport Meta in layout.tsx
- **Files:** `app/layout.tsx`
- **Fix:** Add `<meta name="viewport" ...>` or verify in _document

---

*Generated: July 24, 2026 at 11:50 PM*
