# Plan: Fix Root Lessons Content Silo (408 unreachable lessons)

**Issue:** Root lessons (408 generated lessons from `content/grammar/root-lessons.json`) have no `category` field, but the grammar deep-dive endpoint filters by category (`nahw`, `sarf`, `balagha`). Users cannot access these vocabulary-lessons through the standard navigation flow.

**Goal:** Make all 408 root lessons reachable through the UI by adding a "vocabulary" category and surfacing it in the deep-dive navigation.

---

## Phase 1: Database & Backend

### Step 1.1: Add `category` field to root lessons
**File:** `content/grammar/root-lessons.json`

**Action:** Add `"category": "vocabulary"` to all 408 root lessons.

**Why:** The lessons already have `module: "grammar"`, so adding `category: "vocabulary"` provides the missing dimension the deep-dive endpoint filters by.

**Verification:** 
- Count lessons with `category === "vocabulary"` in the generated file
- Run `node scripts/gen-content-manifest.mjs --check` to ensure consistency

---

### Step 1.2: Update deep-dive endpoint to include vocabulary category
**File:** `workers/src/routes/grammar.ts`

**Action:** 
- Add `"vocabulary"` to the `CATEGORIES` array
- Update the mastery lookup to handle vocabulary category (create `grammar_mastery` row for it if missing)
- Update the lesson query to include uncategorized lessons OR explicitly query for `category = 'vocabulary'`

**Why:** The endpoint currently only returns nahw/sarf/balagha. Adding vocabulary makes the 408 lessons queryable.

**Code changes:**
```typescript
const CATEGORIES = ['nahw', 'sarf', 'balagha', 'vocabulary'];
```

**Verification:**
- Test `GET /api/grammar/deepdive/vocabulary` returns 408 lessons
- Verify mastery tracking works for vocabulary category

---

### Step 1.3: Update learning/next to respect vocabulary category
**File:** `workers/src/routes/learning.ts`

**Action:** 
- Check if `learning/next` currently filters by category or module
- If it filters by `module = 'grammar'`, it should already return root lessons
- If it filters by category, add `"vocabulary"` to allowed categories

**Why:** Ensure root lessons appear in the "next lesson" flow, not just the deep-dive.

**Verification:**
- Test that a new user sees root lessons in their learning path
- Verify prerequisite logic works for root lessons (if any)

---

## Phase 2: Frontend

### Step 2.1: Add Vocabulary tab to DeepDiveView
**File:** `src/app/components/grammar/DeepDiveView.tsx`

**Action:** 
- Add `vocabulary` to the `CATEGORY_INFO` record
- Update the Tabs component to include "Vocabulary (الجُذُور)" option

**Why:** Users need a way to access the vocabulary lessons through the grammar deep-dive UI.

**Code changes:**
```typescript
const CATEGORY_INFO = {
  nahw: { name: 'Syntax (النَّحْو)', icon: Layout },
  sarf: { name: 'Morphology (الصَّرْف)', icon: Beaker },
  balagha: { name: 'Rhetoric (البَلَاغَة)', icon: Feather },
  vocabulary: { name: 'Vocabulary (الجُذُور)', icon: BookOpen }, // or appropriate icon
};
```

**Verification:**
- Render the deep-dive page and verify 4 tabs appear
- Click "Vocabulary" tab and confirm 408 lessons load

---

### Step 2.2: Update lesson cards to display category
**File:** `src/app/components/grammar/RootExplorer.tsx` or `LessonCard.tsx`

**Action:** 
- Display category badge on lesson cards (nahw/sarf/balagha/vocabulary)
- Use appropriate color for vocabulary category (e.g., purple or teal, distinct from nahw/sarf/balagha colors)

**Why:** Users should visually distinguish vocabulary lessons from grammar lessons.

**Verification:**
- Check that lesson cards in the deep-dive show category badges
- Verify color coding is consistent with design system

---

### Step 2.3: Update Today page to surface vocabulary when relevant
**File:** `src/app/components/today/Today.tsx`

**Action:** 
- If user has weak areas in vocabulary or is at a level where vocabulary lessons are appropriate, show a "Study vocabulary roots" card
- Link to `/learning?category=vocabulary` or similar

**Why:** Ensure root lessons appear in the primary navigation flow, not buried in deep-dive.

**Verification:**
- Test that a new user sees vocabulary suggestions in Today
- Verify links point to the correct deep-dive URL

---

## Phase 3: Content & Pedagogical Integration

### Step 3.1: Add prerequisites to root lessons
**File:** `content/grammar/root-lessons.json`

**Action:** 
- Add basic prerequisites for root lessons (e.g., root-Alh has no prereqs, root-qwl requires root-Alh if there's a pedagogical reason)
- The audit noted the linear chain was arbitrary — this should be a flat structure with no prerequisites

**Why:** The audit found that root lessons have arbitrary prerequisite chains that don't make pedagogical sense. Root lessons teach vocabulary families independently.

**Verification:**
- All root lessons should have `prerequisites: []` (unless there's a specific reason)
- Verify learning/next doesn't block on non-existent prerequisites

---

### Step 3.2: Update exercise types for root lessons
**File:** `content/grammar/root-lessons.json`

**Action:** 
- Verify root lessons have varied exercise types (not just multiple_choice and fill_blank)
- Add audio_repeat, pattern_recognition, translation exercises where appropriate

**Why:** The audit found root lessons lack exercise variety compared to authored lessons.

**Verification:**
- Count exercise types per root lesson
- Ensure no exercise has empty or missing fields

---

### Step 3.3: Generate content manifest with category breakdown
**File:** `scripts/gen-content-manifest.mjs`

**Action:** 
- Update the manifest script to track exercises by category
- Verify all 408 root lessons appear in the manifest with `category: "vocabulary"`

**Why:** The manifest is used for gate checks and metrics. It should reflect the new category structure.

**Verification:**
- Run `node scripts/gen-content-manifest.mjs --check`
- Verify vocabulary exercises are counted separately

---

## Phase 4: Testing & Validation

### Step 4.1: Manual testing
**Action:**
1. Navigate to `/grammar` and verify 4 tabs appear (nahw, sarf, balagha, vocabulary)
2. Click "Vocabulary" tab and confirm 408 lessons load
3. Open a root lesson and verify exercises render correctly
4. Test the learning path flow: complete a root lesson, verify mastery updates
5. Check the tutor's "suggested exercises" includes root lessons

**Verification:** All 408 lessons are accessible and functional.

---

### Step 4.2: Automated tests
**File:** `workers/test/routes.test.ts`

**Action:**
- Add test for `GET /api/grammar/deepdive/vocabulary`
- Verify it returns 408 lessons
- Verify lessons have correct category field

**Verification:** Tests pass.

---

### Step 4.3: Build verification
**Action:**
- Run `cd src/app && npm run build`
- Verify no TypeScript errors
- Verify static export includes all deep-dive pages

**Verification:** Build succeeds, no regressions.

---

## Evaluation Criteria

### Pass/Fail Criteria
- [ ] All 408 root lessons have `category: "vocabulary"` in `root-lessons.json`
- [ ] `GET /api/grammar/deepdive/vocabulary` returns 408 lessons
- [ ] DeepDiveView renders 4 tabs including "Vocabulary"
- [ ] Root lessons are accessible from the learning path (Today or Learning page)
- [ ] Exercise types are varied in root lessons (not just multiple_choice)
- [ ] No TypeScript errors in `npm run build`
- [ ] All existing tests pass

### Success Metrics
- 408 lessons reachable (up from 1)
- 0 inaccessible lessons
- 4 category tabs in deep-dive (up from 3)
- 100% of root lessons have at least 3 exercise types

---

## Risks & Mitigations

### Risk 1: Root lessons appear in wrong contexts
**Mitigation:** Only surface vocabulary lessons in the vocabulary tab and learning path. Don't include them in nahw/sarf/balagha deep-dive.

### Risk 2: Performance impact from 408 lessons
**Mitigation:** The deep-dive endpoint already handles all 418 lessons. Adding vocabulary category doesn't change performance characteristics.

### Risk 3: Prerequisite confusion
**Mitigation:** Set all root lesson prerequisites to `[]`. The audit confirmed there's no pedagogical reason for arbitrary chains.

---

## Timeline
- **Phase 1 (Backend):** 1-2 hours
- **Phase 2 (Frontend):** 1-2 hours
- **Phase 3 (Content):** 2-4 hours (depending on exercise variety updates)
- **Phase 4 (Testing):** 1-2 hours
- **Total:** 5-10 hours

---

## Dependencies
- None — this is self-contained and doesn't block on other work.

---

## Next Steps
1. Implement Phase 1 (backend changes)
2. Implement Phase 2 (frontend changes)
3. Update content (Phase 3)
4. Run tests and verify (Phase 4)
5. Commit and deploy
