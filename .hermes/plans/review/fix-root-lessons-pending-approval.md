# Production Changes — Pending Human Approval

These changes are needed to fix root lessons being unreachable, but they write to production data and should be reviewed before applying.

## 1. `workers/src/routes/grammar.ts` — Line 35

**Current:**
```ts
const CATEGORIES = ['nahw', 'sarf', 'balagha'];
```

**Change to:**
```ts
const CATEGORIES = ['nahw', 'sarf', 'balagha', 'vocabulary'];
```

## 2. `workers/src/routes/grammar.ts` — Lines 100-150 (`POST /api/grammar/exercise`)

This endpoint determines the category from the exercise ID. Root lesson exercise IDs look like `root-XXXXX-N-YY` where the `N` (0-9) maps to one of the 10 root-lesson categories. Currently it looks up the exercise in the bank table and uses `kind` — but root lesson exercises aren't in the bank. It then falls back to `SELECT module FROM lessons WHERE id = ?` and gets `module = 'grammar'`, not `category = 'vocabulary'`.

**Change the category resolution (around line 122):**
```ts
// Current:
const category = fromBank?.kind ?? fromLesson?.module ?? null;

// Change to:
let category: string | null = fromBank?.kind ?? fromLesson?.module ?? null;
if (!category && exerciseId.startsWith('root-')) {
  // Root lesson exercises: id is "root-XXXXX-N-YY" (10 categories per root)
  // The N digit maps to categories in a fixed order
  const parts = exerciseId.split('-');
  const categoryIndex = Number(parts[parts.length - 2]) % 10;
  const ROOT_CATEGORIES = [
    'vocabulary', 'nahw', 'sarf', 'balagha', 'vocabulary',
    'nahw', 'sarf', 'balagha', 'vocabulary', 'nahw',
  ];
  category = ROOT_CATEGORIES[categoryIndex] ?? null;
}
```

This ensures mastery tracking works for root lesson exercises and they record under the correct category.

## 3. D1 Database — Schema Change

**Current schema:**
```sql
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  title TEXT,
  module TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  exercises TEXT NOT NULL,
  prerequisites TEXT NOT NULL DEFAULT '[]',
  estimated_minutes INTEGER DEFAULT 10,
  category TEXT
);
```

**Add to schema (already exists):**
```sql
category TEXT
```

The column already exists in the schema — no schema migration needed. But seed data needs to be regenerated with `category: "vocabulary"` for root lessons.

## 4. Seed Data Regeneration

After the schema supports category, run the seed with:
```bash
node scripts/seed-db.ts
```

This needs the content files to already have `category` set on root lessons.

## 5. Frontend — `src/app/components/grammar/DeepDiveView.tsx`

**Line 22-23:**
```ts
// Current:
category: 'nahw' | 'sarf' | 'balagha';
// Change to:
category: 'nahw' | 'sarf' | 'balagha' | 'vocabulary';
```

**Line 26-29 — Add vocabulary to CATEGORY_INFO:**
```ts
// Add:
vocabulary: { name: 'Vocabulary (الجُذُور)', icon: BookOpen },
```

**Import BookOpen:**
```ts
// Line 8:
import { Layout, Beaker, Feather, BookOpen } from 'lucide-react';
```

## Files to review

| File | Lines | Change |
|------|-------|--------|
| `workers/src/routes/grammar.ts` | 35 | Add `'vocabulary'` to CATEGORIES array |
| `workers/src/routes/grammar.ts` | 100-150 | Add root exercise ID → category mapping |
| `src/app/components/grammar/DeepDiveView.tsx` | 22 | Add `'vocabulary'` to type union |
| `src/app/components/grammar/DeepDiveView.tsx` | 26-29 | Add vocabulary to CATEGORY_INFO |
| `src/app/components/grammar/DeepDiveView.tsx` | 8 | Import BookOpen icon |

## Verification

After applying:
1. `node scripts/phase1-fix-root-lessons.mjs` — should report all 408 lessons with category
2. `cd src/app && npm run build` — should compile
3. `GET /api/grammar/deepdive/vocabulary` — should return 408 lessons
4. DeepDiveView should show 4 tabs including Vocabulary
