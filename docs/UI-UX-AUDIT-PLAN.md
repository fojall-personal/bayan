# Language Builder — Full UI/UX Audit Plan

**Objective:** Systematic evaluation of all user-facing screens to identify design inconsistencies, accessibility issues, functional problems, and opportunities for improvement before scaling the codebase.

---

## Phase 1: Visual Design Audit (Design System Compliance)

### 1.1 React Rendering Verification
- [ ] Verify all pages render without JavaScript errors (check console)
- [ ] Confirm React hydration works (server-rendered HTML matches client)
- [ ] Check component mounting sequence (no flash of unstyled content)
- [ ] Verify state updates propagate correctly (button clicks, form inputs)
- [ ] Test client-side routing (Next.js App Router navigation)
- [ ] Confirm dynamic imports work (code splitting loads correctly)
- [ ] Verify error boundaries catch and display errors properly
- [ ] Check React DevTools would show correct component tree

### 1.2 Color & Typography Compliance
- [ ] Verify all screens use design tokens from `globals.css` (no hardcoded colors)
- [ ] Check Arabic text uses `line-height: 2.0` (`--leading-arabic`)
- [ ] Verify all Arabic containers have `dir="rtl"` and `lang="ar"`
- [ ] Confirm primary green (#22c55e) is used for progress/CTA elements
- [ ] Check gold (#f59e0b) is used only for highlights, not primary actions
- [ ] Verify no cold blue tones in neutrals (warm grays only)
- [ ] Confirm tajweed colors are functional (not decorative) with legends

### 1.3 Layout & Spacing
- [ ] Check all screens use consistent padding (card: 1.5rem, section: 2rem)
- [ ] Verify responsive breakpoints work at 640px, 768px, 1024px, 1280px
- [ ] Check mobile navigation (hamburger menu) functions correctly
- [ ] Verify touch targets are ≥44px for mobile interactions
- [ ] Confirm no horizontal scroll on mobile (max-width constraints)
- [ ] Check alignment consistency across all page types

### 1.4 Component Consistency
- [ ] Audit all 18+ components used across the app
- [ ] Verify loading states exist for all async operations
- [ ] Check error states are handled gracefully (no raw JSON exposure)
- [ ] Confirm empty states have actionable suggestions (not "No data")
- [ ] Verify button states (default, hover, active, disabled) work properly
- [ ] Check input fields have proper focus states and labels
- [ ] Confirm badge/sticker system is used consistently for status

---

## Phase 2: User Flow & Navigation

### 2.1 React Component Testing
- [ ] Verify all pages use `'use client'` directive where needed
- [ ] Check hooks work correctly (useState, useEffect, useContext)
- [ ] Test component lifecycle (mount, update, unmount)
- [ ] Verify props flow correctly through component tree
- [ ] Check context providers work (auth, theme, language)
- [ ] Test error boundaries catch component errors
- [ ] Verify React.memo/useMemo prevent unnecessary re-renders

### 2.2 Onboarding Flow
- [ ] Test complete onboarding: Goal Selection → Assessment Prompt → Assessment
- [ ] Verify goal selection persists across sessions
- [ ] Check assessment redirect logic (if not completed, prompt user)
- [ ] Confirm learning path assignment works based on self-assessment
- [ ] Test error recovery if user backs out mid-flow

### 2.2 Core Navigation
- [ ] Verify nav links work: Dashboard, Assessment, Learning, Memorization, Progress
- [ ] Check active state highlighting for current page
- [ ] Test navigation from every page to every other page
- [ ] Confirm mobile nav collapses/expands properly
- [ ] Check URL structure matches user expectations

### 2.3 Assessment Flow
- [ ] Test 4-module diagnostic: Literacy → Comprehension → Grammar → Memorization
- [ ] Verify question navigation (next/previous) works
- [ ] Check score calculation in real-time
- [ ] Confirm results page shows composite score + per-module breakdown
- [ ] Test learning path recommendation logic
- [ ] Verify "Take Again" functionality

### 2.4 Learning Flow
- [ ] Test lesson progression (lesson → exercise → submit → next lesson)
- [ ] Verify prerequisite checking works (can't skip to advanced)
- [ ] Check flashcard spaced repetition (SM-2 algorithm)
- [ ] Test quality rating (Again/Hard/Good/Easy) affects next review
- [ ] Verify learning path updates after lesson completion

### 2.5 Memorization Flow
- [ ] Test surah selection and ayah tracking
- [ ] Verify review session flow: Listen → Recite → Rate
- [ ] Check SM-2 intervals (review timing calculations)
- [ ] Test audio playback integration
- [ ] Confirm progress tracking across sessions

### 2.6 Progress & Dashboard
- [ ] Test dashboard data loading (user, assessment, lessons, memorization)
- [ ] Verify streak counter updates correctly
- [ ] Check weekly progress visualization
- [ ] Confirm score history shows previous assessment results
- [ ] Test goal progress tracking

---

## Phase 3: Accessibility & Usability

### 3.1 Browser Console Verification
- [ ] Check browser console for JavaScript errors on each page
- [ ] Verify no warnings about deprecated APIs
- [ ] Check for unhandled promise rejections
- [ ] Verify network requests complete successfully (no 4xx/5xx errors)
- [ ] Check for console.log statements left in production code

### 3.2 Accessibility (WCAG 2.1 AA)
- [ ] Check color contrast ratios (text vs background ≥ 4.5:1)
- [ ] Verify all interactive elements are keyboard navigable
- [ ] Test screen reader compatibility (aria labels, landmarks)
- [ ] Confirm focus indicators are visible (no removed outlines)
- [ ] Check alt text on all images/icons
- [ ] Verify form inputs have associated labels

### 3.3 Usability Heuristics
- [ ] System status visibility (loading spinners, success messages)
- [ ] Match between system and real world (no developer jargon)
- [ ] User control and freedom (back button, undo, cancel)
- [ ] Consistency (same patterns for similar actions)
- [ ] Error prevention (confirmations for destructive actions)
- [ ] Recognition rather than recall (show context, not just labels)

### 3.4 Performance
- [ ] Check page load times (< 3 seconds target)
- [ ] Verify lazy loading for images/media
- [ ] Test API response times (< 500ms target)
- [ ] Confirm no unnecessary re-renders
- [ ] Check bundle size and code splitting

---

## Phase 4: Content & Copy

### 4.1 Language & Tone
- [ ] Verify consistent tone (encouraging, expert, clear)
- [ ] Check for jargon (explain Arabic terms in English)
- [ ] Confirm CTAs are action-oriented ("Start Learning" not "Submit")
- [ ] Verify success/error messages are helpful, not technical
- [ ] Check placeholder text in forms is descriptive

### 4.2 Data Accuracy
- [ ] Verify Quran verse references are correct (surah:ayah format)
- [ ] Check tajweed rule descriptions match standard definitions
- [ ] Confirm vocabulary definitions are accurate
- [ ] Verify grammar examples are grammatically correct
- [ ] Test assessment questions against answer key

### 4.3 Empty States & Edge Cases
- [ ] Check "No lessons yet" state shows onboarding prompt
- [ ] Verify "No memorization progress" suggests first surah
- [ ] Confirm "Assessment not started" shows clear CTA
- [ ] Test offline behavior (if applicable)
- [ ] Check loading states during API calls

---

## Phase 5: Mobile & Responsive

### 5.1 Mobile-First Verification
- [ ] Test on iPhone SE (375px width)
- [ ] Test on iPhone 14 Pro (393px width)
- [ ] Test on iPad (768px width)
- [ ] Test on desktop (1440px width)
- [ ] Verify PWA install functionality
- [ ] Check standalone mode (no browser chrome)

### 5.2 Touch Interactions
- [ ] Test tap targets are large enough (≥44px)
- [ ] Verify swipe gestures work (if implemented)
- [ ] Check pinch-to-zoom behavior
- [ ] Test long-press actions (if any)
- [ ] Verify keyboard doesn't obscure inputs

### 5.3 Performance on Mobile
- [ ] Test 3G network conditions (throttled)
- [ ] Check image loading and optimization
- [ ] Verify audio streaming works on mobile
- [ ] Test battery usage (if app is long-running)
- [ ] Check memory usage

---

## Phase 6: Backend Integration

### 6.1 API Error Handling
- [ ] Test all endpoints with invalid input
- [ ] Verify 401/403 responses for auth issues
- [ ] Check 500 errors show user-friendly messages
- [ ] Test rate limiting (100 req/min)
- [ ] Verify CORS configuration

### 6.2 Data Integrity
- [ ] Check database migrations run successfully
- [ ] Verify seed data is correct (10 vocabulary, 5 lessons, etc.)
- [ ] Test user data persistence across sessions
- [ ] Confirm assessment scores are saved correctly
- [ ] Verify spaced repetition calculations

### 6.3 Security
- [ ] Check bearer token validation
- [ ] Verify no SQL injection vulnerabilities
- [ ] Test file uploads (audio) with invalid types
- [ ] Check rate limiting effectiveness
- [ ] Verify no sensitive data in client-side code

---

## Phase 7: Analytics & Tracking

### 7.1 User Metrics
- [ ] Verify session duration tracking
- [ ] Check lessons per week calculation
- [ ] Confirm weekly return rate tracking
- [ ] Test assessment improvement measurement
- [ ] Verify vocabulary retention calculation

### 7.2 Error Tracking
- [ ] Check error logging (console, server)
- [ ] Verify user feedback mechanisms
- [ ] Test crash reporting (if implemented)
- [ ] Check performance monitoring

---

## Phase 8: Documentation & Handoff

### 8.1 Developer Documentation
- [ ] Verify component documentation exists
- [ ] Check API documentation
- [ ] Confirm environment variable documentation
- [ ] Test deployment instructions

### 8.2 User Documentation
- [ ] Check help/tooltips for complex features
- [ ] Verify onboarding guidance is clear
- [ ] Test FAQ/Help section (if exists)
- [ ] Confirm keyboard shortcuts documented (if any)

---

## Testing Methodology

### Browser-Based Verification
All UI/UX checks use the browser tool to verify actual rendering:

1. **Navigate to each page** using `browser_navigate`
2. **Take screenshots** with `browser_vision` to capture visual state
3. **Check console errors** with `browser_console` to identify JS issues
4. **Test interactions** by clicking buttons/inputs and verifying state changes
5. **Verify responsive design** by testing at different viewport widths
6. **Document findings** with annotated screenshots showing issues

### Automated Checks
- Run Lighthouse for accessibility and performance metrics
- Check React DevTools via browser extension
- Verify hydration with `document.querySelectorAll('[data-react-helmet]')`
- Test API connectivity by checking network tab

### Session Survival Strategy
The audit is broken into small slices that can be paused and resumed:

**Slice 1:** React Rendering Verification (Phase 1.1)
**Slice 2:** Visual Design Compliance (Phase 1.2-1.4)
**Slice 3:** User Flow Testing (Phase 2.1-2.6)
**Slice 4:** Accessibility Audit (Phase 3.1-3.4)
**Slice 5:** Mobile & Responsive (Phase 5.1-5.3)
**Slice 6:** Backend Integration (Phase 6.1-6.3)
**Slice 7:** Content & Copy (Phase 4)
**Slice 8:** Documentation (Phase 8)

Each slice updates the audit plan document and creates a findings report.

---

## Deliverables

### Per-Slice Outputs
For each audit slice, create:
1. **Findings Report** — `docs/audit-slice-XX-findings.md` with:
   - Pages tested
   - Issues found (with severity: Critical/High/Medium/Low)
   - Screenshots of problems
   - Recommended fixes
2. **Updated Audit Plan** — Mark completed items with [x]

### Final Outputs
1. **Master Audit Report** — `docs/UI-UX-AUDIT-REPORT.md` with all findings
2. **Bug List** — Prioritized issues in `docs/audit-bug-list.md`
3. **Design Debt** — Items violating design system in `docs/audit-design-debt.md`
4. **UX Improvements** — Suggestions in `docs/audit-ux-improvements.md`
5. **Accessibility Report** — WCAG violations in `docs/audit-accessibility.md`
6. **Performance Report** — Metrics and bottlenecks in `docs/audit-performance.md`
7. **Action Plan** — Phased remediation in `docs/audit-action-plan.md`

---

## Tools Required

- Browser DevTools (Chrome/Firefox)
- Lighthouse (accessibility, performance, SEO)
- Contrast checker (WebAIM)
- Mobile devices or emulators
- Network throttling (DevTools)
- Screen reader (VoiceOver/NVDA)
- API testing (curl/Postman)

---

## Time Estimate

| Phase | Description | Time |
|-------|-------------|------|
| 1 | Visual Design Audit | 4 hours |
| 2 | User Flow & Navigation | 6 hours |
| 3 | Accessibility & Usability | 4 hours |
| 4 | Content & Copy | 2 hours |
| 5 | Mobile & Responsive | 4 hours |
| 6 | Backend Integration | 3 hours |
| 7 | Analytics & Tracking | 2 hours |
| 8 | Documentation & Handoff | 3 hours |
| **Total** | | **28 hours** |

---

## Next Steps

1. Review this plan with stakeholder
2. Prioritize phases based on impact/risk
3. Execute audit in sprint cycles
4. Document findings in real-time
5. Create remediation backlog
6. Schedule follow-up audits after fixes

---

*Last updated: July 24, 2026*
*Author: Hermes Agent*
