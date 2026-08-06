# Evaluations: Fix Root Lessons Content Silo

**Issue:** Root lessons (408 generated lessons) have no `category` field, making them inaccessible through the grammar deep-dive UI.

**Goal:** Make all 408 root lessons reachable by adding a "vocabulary" category and surfacing it in the deep-dive navigation.

---

## Evaluation 1: Database Schema & Content

### Test 1.1: Root lessons have category field
**File:** `content/grammar/root-lessons.json`

**Action:** Add `"category": "vocabulary"` to all root lessons.

**Verification:**
```bash
node -e "
const data = require('./content/grammar/root-lessons.json');
const lessons = data.lessons;
const withCategory = lessons.filter(l => l.category === 'vocabulary');
console.log('Total lessons:', lessons.length);
console.log('With category:', withCategory.length);
console.log('Missing category:', lessons.length - withCategory.length);
if (lessons.length !== withCategory.length) process.exit(1);
console.log('✓ All', lessons.length, 'root lessons have category: vocabulary');
"
```

**Expected output:**
```
Total lessons: 408
With category: 408
Missing category: 0
✓ All 408 root lessons have category: vocabulary
```

---

### Test 1.2: Root lessons have no prerequisites (pedagogical cleanup)
**File:** `content/grammar/root-lessons.json`

**Action:** Set all root lesson prerequisites to `[]`.

**Verification:**
```bash
node -e "
const data = require('./content/grammar/root-lessons.json');
const lessons = data.lessons;
const withPrereqs = lessons.filter(l => l.prerequisites && l.prerequisites.length > 0);
console.log('Lessons with prerequisites:', withPrereqs.length);
if (withPrereqs.length > 0) {
  console.log('✘ Found prerequisites:', withPrereqs.map(l => l.id));
  process.exit(1);
}
console.log('✓ All root lessons have empty prerequisites');
"
```

**Expected output:**
```
Lessons with prerequisites: 0
✓ All root lessons have empty prerequisites
```

---

### Test 1.3: Root lessons have varied exercise types
**File:** `content/grammar/root-lessons.json`

**Action:** Ensure root lessons have at least 3 exercise types (multiple_choice, fill_blank, match, audio_repeat, pattern_recognition, translation).

**Verification:**
```bash
node -e "
const data = require('./content/grammar/root-lessons.json');
const lessons = data.lessons;
const types = new Set();
lessons.forEach(l => {
  if (l.exercises) {
    l.exercises.forEach(ex => types.add(ex.type));
  }
});
console.log('Exercise types found:', [...types]);
console.log('Type count:', types.size);
if (types.size < 3) {
  console.log('✘ Root lessons need more exercise variety');
  process.exit(1);
}
console.log('✓ Root lessons have', types.size, 'exercise types');
"
```

**Expected output:**
```
Exercise types found: [ 'multiple_choice', 'fill_blank', 'match', 'audio_repeat', 'pattern_recognition' ]
Type count: 5
✓ Root lessons have 5 exercise types
```

---

## Evaluation 2: Backend API

### Test 2.1: Deep-dive endpoint accepts vocabulary category
**File:** `workers/src/routes/grammar.ts`

**Action:** Add `"vocabulary"` to CATEGORIES array in `/api/grammar/deepdive/:category` endpoint.

**Verification:**
```bash
grep -n "CATEGORIES" workers/src/routes/grammar.ts | head -5
```

**Expected output:**
```
35:  const CATEGORIES = ['nahw', 'sarf', 'balagha', 'vocabulary'];
```

---

### Test 2.2: Deep-dive endpoint returns vocabulary lessons
**File:** `workers/src/routes/grammar.ts`

**Action:** Verify the endpoint queries for `category = 'vocabulary'` and returns lessons.

**Verification:**
```bash
grep -A 10 "SELECT \* FROM lessons" workers/src/routes/grammar.ts
```

**Expected output:**
```typescript
const lessons = await db.query<LessonsRow>(
  `SELECT * FROM lessons WHERE category = ? AND level >= ? ORDER BY level ASC`,
  [category, (mastery?.mastery_level as number) || 1]
);
```

**Test execution:**
```bash
# Start workers dev server
cd workers && npm run dev &
sleep 5

# Test vocabulary endpoint
curl -s -H "Authorization: Bearer test-token" http://localhost:8787/api/grammar/deepdive/vocabulary | \
  node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const lessons = data.data.lessons;
console.log('Lessons returned:', lessons.length);
const hasCategory = lessons.every(l => l.category === 'vocabulary');
console.log('All have category:', hasCategory);
if (!hasCategory || lessons.length < 400) {
  console.log('✘ Endpoint not working correctly');
  process.exit(1);
}
console.log('✓ Vocabulary endpoint returns', lessons.length, 'lessons');
"
```

**Expected output:**
```
Lessons returned: 408
All have category: true
✓ Vocabulary endpoint returns 408 lessons
```

---

### Test 2.3: Learning/next endpoint includes vocabulary lessons
**File:** `workers/src/routes/learning.ts`

**Action:** Verify learning/next doesn't filter out vocabulary category.

**Verification:**
```bash
grep -n "category\|module" workers/src/routes/learning.ts | grep -i "filter\|where" | head -10
```

**Expected output:** Should not filter by category OR include vocabulary in allowed categories.

---

## Evaluation 3: Frontend

### Test 3.1: DeepDiveView renders 4 tabs
**File:** `src/app/components/grammar/DeepDiveView.tsx`

**Action:** Add vocabulary to CATEGORY_INFO and Tabs component.

**Verification:**
```bash
grep -n "CATEGORY_INFO" src/app/components/grammar/DeepDiveView.tsx
```

**Expected output:**
```typescript
const CATEGORY_INFO: Record<string, { name: string; icon: React.ElementType }> = {
  nahw: { name: 'Syntax (النَّحْو)', icon: Layout },
  sarf: { name: 'Morphology (الصَّرْف)', icon: Beaker },
  balagha: { name: 'Rhetoric (البَلَاغَة)', icon: Feather },
  vocabulary: { name: 'Vocabulary (الجُذُور)', icon: BookOpen },
};
```

---

### Test 3.2: Lesson cards display category
**File:** `src/app/components/grammar/LessonCard.tsx` (or similar)

**Action:** Add category badge to lesson cards.

**Verification:**
```bash
grep -n "category" src/app/components/grammar/LessonCard.tsx | head -5
```

**Expected output:** Should display category badge with appropriate color.

---

## Evaluation 4: Integration

### Test 4.1: End-to-end flow
**Action:** Complete a full user journey.

**Steps:**
1. Open `/grammar` page
2. Verify 4 tabs appear (nahw, sarf, balagha, vocabulary)
3. Click "Vocabulary" tab
4. Verify 408 lessons load
5. Click a root lesson
6. Verify exercises render and are functional
7. Complete a lesson
8. Verify mastery updates

**Verification:** All steps complete without errors.

---

### Test 4.2: Learning path integration
**Action:** Verify root lessons appear in learning path.

**Steps:**
1. Open `/today` page
2. Check if vocabulary suggestions appear
3. Click suggestion
4. Verify it links to `/grammar/vocabulary` or similar

**Verification:** Root lessons are discoverable from primary navigation.

---

## Evaluation 5: Build & Tests

### Test 5.1: TypeScript compilation
**Action:** Run TypeScript compiler.

```bash
cd src/app && npm run build
```

**Expected output:** No TypeScript errors.

---

### Test 5.2: Vitest tests
**Action:** Run existing tests.

```bash
cd workers && npm test
```

**Expected output:** All existing tests pass.

---

### Test 5.3: Content manifest
**Action:** Run content gate.

```bash
node scripts/gen-content-manifest.mjs --check
```

**Expected output:**
```
✓ derived-content counts agree across 6 files (38,995 exercises)
```

---

## Pass/Fail Criteria

### Must Pass (Blocking)
- [ ] All 408 root lessons have `category: "vocabulary"`
- [ ] Deep-dive endpoint returns 408 lessons for vocabulary category
- [ ] DeepDiveView renders 4 tabs including vocabulary
- [ ] No TypeScript errors in build
- [ ] All existing tests pass

### Should Pass (Quality)
- [ ] Root lessons have at least 3 exercise types
- [ ] Root lessons have no prerequisites
- [ ] Root lessons discoverable from Today page
- [ ] Category badges display correctly on lesson cards

---

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Accessible root lessons | 0 | 408 | 408 |
| Deep-dive tabs | 3 | 4 | 4 |
| Root lesson exercise types | 2 | ≥3 | 5+ |
| Root lesson prerequisites | Arbitrary | None | 0 |

---

## Automation

Save as `scripts/verify-root-lessons.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Verify root lessons are properly categorized and accessible.
 *
 * Usage: node scripts/verify-root-lessons.mjs
 * Exit code 0 on success, 1 on failure.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const root = dirname(fileURLToPath(import.meta.url));
const OUT = join(root, '..', 'content/grammar/root-lessons.json');

const data = JSON.parse(readFileSync(OUT, 'utf-8'));
const lessons = data.lessons;

console.log('=== Root Lessons Verification ===\n');

// Test 1: All lessons have category
console.log('1. Category field:');
const withCategory = lessons.filter(l => l.category === 'vocabulary');
console.log(`   Total: ${lessons.length}`);
console.log(`   With category: ${withCategory.length}`);
if (lessons.length !== withCategory.length) {
  console.log('   ✘ FAIL: Missing category field');
  process.exit(1);
}
console.log('   ✓ PASS\n');

// Test 2: No prerequisites
console.log('2. Prerequisites:');
const withPrereqs = lessons.filter(l => l.prerequisites && l.prerequisites.length > 0);
console.log(`   With prerequisites: ${withPrereqs.length}`);
if (withPrereqs.length > 0) {
  console.log('   ✘ FAIL: Found arbitrary prerequisites');
  process.exit(1);
}
console.log('   ✓ PASS\n');

// Test 3: Exercise variety
console.log('3. Exercise types:');
const types = new Set();
lessons.forEach(l => {
  if (l.exercises) {
    l.exercises.forEach(ex => types.add(ex.type));
  }
});
console.log(`   Types found: ${[...types].join(', ')}`);
console.log(`   Count: ${types.size}`);
if (types.size < 3) {
  console.log('   ✘ FAIL: Need more exercise variety');
  process.exit(1);
}
console.log('   ✓ PASS\n');

// Test 4: Content structure
console.log('4. Content structure:');
const missingExplanation = lessons.filter(l => !l.content || !l.content.explanation);
console.log(`   Missing explanation: ${missingExplanation.length}`);
if (missingExplanation.length > 0) {
  console.log('   ✘ FAIL: Missing content');
  process.exit(1);
}
console.log('   ✓ PASS\n');

console.log('=== All checks passed ===');
```

Run with:
```bash
node scripts/verify-root-lessons.mjs
```

---

## Manual Testing Checklist

- [ ] Navigate to `/grammar` and verify 4 tabs
- [ ] Click "Vocabulary" tab and confirm 408 lessons load
- [ ] Open a root lesson and verify exercises render
- [ ] Complete a root lesson and verify mastery updates
- [ ] Check Today page for vocabulary suggestions
- [ ] Verify lesson cards show category badges
- [ ] Test on mobile (375px, 430px)
- [ ] Verify dark mode rendering

---

## Rollback Plan

If tests fail after changes:
1. Revert `content/grammar/root-lessons.json` changes
2. Revert `workers/src/routes/grammar.ts` changes
3. Revert `src/app/components/grammar/DeepDiveView.tsx` changes
4. Run existing tests to confirm baseline
