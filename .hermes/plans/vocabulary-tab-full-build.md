# Plan: Vocabulary Tab — Full Build with UX/UI

**Issue:** The uncommitted `vocabulary` tab on the Grammar page is cosmetic-only.
No vocabulary lessons exist in `content/grammar/lessons.json`, no API endpoint
serves them, and the DeepDiveView empty state has no reason string for this
category. Clicking the tab shows "No lessons yet" with no explanation and no
path to action — dead weight.

**Goal:** A working vocabulary section in the Grammar tab that teaches the 103
core Quranic vocabulary words through root-family exploration, with proper UX
for pattern recognition (not grammar drilling), and evals that prove it is
actually built.

---

## What Already Exists

| Layer | Status | Notes |
|-------|--------|-------|
| `vocabulary` table | Migration 0011 | 103 entries in `content/vocabulary/core-100.json` |
| `vocabulary_mastery` table | Migration 0004 | Tracks user progress per root |
| `GET /api/grammar/root/:root` | Route in `grammar.ts` | Returns family + drills from corpus |
| `RootExplorer` component | Exists in `components/grammar/` | Can be reused or adapted |
| DeepDiveView accepts `category: 'vocabulary'` | `DeepDiveView.tsx` | But shows "No lessons yet" with no reason |

## What Does Not Exist

| Item | Gap |
|------|-----|
| 103 vocabulary lessons in `content/grammar/lessons.json` | Empty |
| `GET /api/vocabulary` endpoint | Missing |
| `POST /api/vocabulary/mastery` endpoint | Missing |
| `vocabulary` reason in `EMPTY_REASON` map | Empty |
| Vocabulary tab logic on the page | Just adds a tab; renders nothing |

---

## UX Strategy

Vocabulary is **not** nahw/sarf/balagha. It is pattern recognition — recognizing
that مِن means "from, of" when you see it in an ayah, quickly. The UX should
reflect this:

1. **Explore first, drill second.** Show a scrollable list of the 103 roots,
   ordered by frequency rank. Each card shows the root, meaning, rank, and
   the learner's mastery bar. Click opens the family detail.

2. **Family detail shows corpus evidence.** List the family members (different
   forms of the same root), how often each occurs in the Quran, and top 5
   ayah references. This is what the learner is actually learning — not a
   quiz, but "this is the shape of this root in context."

3. **Mastery is optional and visible.** Green progress bar. 5 correct attempts
   = mastered. Not required to unlock anything — this is a reference, not a
   gate.

4. **No dead-end empty state.** If the vocabulary lessons aren't seeded, say so
   with the reason string. If a root has no family, show "only one form
   attested" rather than an empty list.

---

## UI Component Specs

### A. RootCard — single vocabulary item

```
┌─────────────────────────────────────────┐
│  مـن  ·  min                             │
│  from, of                                │
│  Rank #1 · 2763 occurrences              │
│  Progress: ████████░░░░░░░ 67%          │
└─────────────────────────────────────────┘
```

**Props:**
- `root: string` — Buckwalter or Arabic form
- `meaning: string` — English gloss
- `frequencyRank: number` — for ordering and display
- `occurrences: number` — corpus count
- `mastery: number` — 0-5, renders as progress bar
- `onSelect: () => void` — opens detail view

**Styling:**
- Background: `bg-gray-800`, border `border-gray-700`
- Hover: `hover:bg-gray-700`, `hover:border-leaf-500/50`
- Selected: `border-leaf-500 bg-leaf-500/10`
- Progress bar: green (`bg-leaf-500`) up to mastery, gray (`bg-gray-700`) rest
- Arabic root: Amiri font, larger, `text-gold-400`
- Meaning: `text-gray-400`, smaller

### B. RootFamilyDetail — expanded view on click

```
┌─────────────────────────────────────────┐
│  ← Back to all roots                     │
│                                           │
│  Root: مـن (min)                          │
│  Core meaning: from, of                    │
│                                           │
│  Family members:                           │
│  • مِن (min)         — preposition  · 2763 │
│  • أَمِنَ (amīna)   — Form I verb       │
│  • أَمَّ (amma)     — Form IV verb       │
│                                           │
│  Corpus occurrences:                       │
│  • Al-Fātiḥah 1:5                          │
│  • Al-Baqarah 2:16                         │
│  • Āl-'Imrān 3:7                             │
│  • Al-A'raf 7:56                           │
│  • Hud 11:62                               │
│                                           │
│  [Practice this root] →                    │
└─────────────────────────────────────────┘
```

**Props:**
- `root: string`
- `onBack: () => void`
- Fetches family data from `GET /api/grammar/root/:root`

**Styling:**
- Same card style as RootCard but taller
- Back button: text-link style, `text-gold-400`
- Family members: bullet list, each member with form Arabic + part of speech
- Corpus references: numbered list, each line clickable (links to `read?surah=&ayah=`)
- Practice button: gold bg, `bg-gold-500 text-ground-950`

### C. VocabularyView — the tab content

**Layout:**
1. Header: "Vocabulary (الجُذُور)"
2. Search bar: filter roots by meaning or root
3. Grid of RootCards: 1 column mobile, 2 columns desktop
4. Loading state: skeleton cards
5. Empty state: "No vocabulary data loaded. Run the seed script."
6. Error state: card with retry button

**State:**
- `roots: RootCardData[]` — fetched from `GET /api/vocabulary`
- `selectedRoot: string | null` — which root is open in detail view
- `searchQuery: string` — filter text
- `loading: boolean`
- `error: string | null`

---

## Implementation Steps

### Step 1: Content — Create vocabulary lessons file

**File:** `content/grammar/vocabulary-lessons.json`

```json
[
  {
    "id": "vocab-01",
    "title": "مِن (min) — from, of",
    "category": "vocabulary",
    "level": 1,
    "prerequisites": [],
    "estimated_minutes": 15,
    "content": {
      "root": "مـن",
      "meaning": "from, of",
      "transliteration": "min",
      "part_of_speech": "preposition",
      "quran_occurrences": 2763,
      "examples": [
        {"arabic": "مِنَ الله", "translation": "from God", "source": "Al-Fātiḥah 1:5"},
        {"arabic": "مِنَ الأَرْضِ", "translation": "from the earth", "source": "Al-Baqarah 2:16"}
      ],
      "usage_notes": "Preposition with genitive case. One of the most common words in the Quran."
    },
    "exercises": [
      {
        "type": "multiple_choice",
        "prompt": "What does مِن (min) mean?",
        "options": ["from, of", "in, inside", "on, upon", "to, towards"],
        "answer": 0,
        "explanation": "مِن is a preposition meaning 'from' or 'of'. It takes the genitive case."
      },
      // ... 4 more exercises
    ]
  }
  // ... 103 lessons total
]
```

**Why:** The 103 core vocabulary words are already in `content/vocabulary/core-100.json`.
Generate lessons from that file: each word becomes one lesson with its root,
meaning, and 5 corpus-derived examples.

**Verification:**
```bash
node scripts/gen-vocabulary-lessons.mjs --check
# Should produce 103 lessons, each with category: "vocabulary"
```

### Step 2: API — Add vocabulary endpoints

**File:** `workers/src/routes/vocabulary.ts`

```typescript
import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';

export const vocabularyRoutes = new Hono<AppEnv>();

// GET /api/vocabulary — list top N roots with mastery progress
vocabularyRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  const limit = Math.min(Number(c.req.query('limit') ?? 50) || 50, 200);

  try {
    const rows = await db.query(`
      SELECT v.word, v.transliteration, v.meaning, v.root,
             v.frequency_rank, v.part_of_speech,
             v.frequency_rank as quran_occurrences,
             vm.correct_attempts as mastery_score,
             vm.total_attempts
      FROM vocabulary v
      LEFT JOIN vocabulary_mastery vm ON vm.root = v.word AND vm.user_id = ?
      ORDER BY v.frequency_rank ASC
      LIMIT ?
    `, [userId, limit]);

    return c.json({
      data: rows.map(r => ({
        ...r,
        mastery: r.mastery_score ?? 0,
      }))
    });
  } catch (error) {
    console.error('Vocabulary list error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/vocabulary/root/:root — family detail with mastery context
vocabularyRoutes.get('/root/:root', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  const root = c.req.param('root');

  try {
    // Use existing root family endpoint
    const { buildFamily, drillsFromFamily } = await import('../lib/root-families');
    const { buckwalterToArabic, rootToArabic } = await import('../lib/buckwalter');

    const rows = await db.query(`
      SELECT lemma, root, pos, verb_form, aspect, voice, case_case, gender, number, person
      FROM quran_word_morphology
      WHERE root = ?
    `, [root]);

    if (rows.length === 0) {
      return c.json(
        { error: `No occurrences of root "${root}" in the corpus` },
        404
      );
    }

    const family = buildFamily(root, rows);
    const drills = drillsFromFamily(family);

    // Get vocabulary mastery for this root
    const mastery = await db.get(`
      SELECT correct_attempts, total_attempts
      FROM vocabulary_mastery
      WHERE root = ? AND user_id = ?
    `, [root, userId]);

    return c.json({
      data: {
        ...family,
        drills,
        mastery: mastery
          ? {
              correctAttempts: mastery.correct_attempts,
              totalAttempts: mastery.total_attempts,
              masteryLevel: mastery.total_attempts > 0
                ? Math.min(5, Math.round(
                    (mastery.correct_attempts * 5) / mastery.total_attempts
                  ))
                : 0,
            }
          : { correctAttempts: 0, totalAttempts: 0, masteryLevel: 0 },
      }
    });
  } catch (error) {
    console.error('Vocabulary root detail error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/vocabulary/mastery — update user mastery for a root
vocabularyRoutes.post('/mastery', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  const { root, correct } = await c.req.json();

  try {
    await db.run(`
      INSERT INTO vocabulary_mastery (root, user_id, total_attempts, correct_attempts, last_reviewed)
      VALUES (?, ?, 1, ?, datetime('now'))
      ON CONFLICT(root, user_id) DO UPDATE SET
        total_attempts   = total_attempts + 1,
        correct_attempts = correct_attempts + ?,
        last_reviewed    = datetime('now')
    `, [root, userId, correct ? 1 : 0, correct ? 1 : 0]);

    // Return updated mastery
    const mastery = await db.get(`
      SELECT correct_attempts, total_attempts
      FROM vocabulary_mastery
      WHERE root = ? AND user_id = ?
    `, [root, userId]);

    return c.json({
      data: {
        success: true,
        root,
        mastery: {
          correctAttempts: mastery.correct_attempts,
          totalAttempts: mastery.total_attempts,
          masteryLevel: mastery.total_attempts > 0
            ? Math.min(5, Math.round((mastery.correct_attempts * 5) / mastery.total_attempts))
            : 0,
        }
      }
    });
  } catch (error) {
    console.error('Vocabulary mastery update error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
```

**Register in pages-entry.ts:**
```typescript
app.route('/api/vocabulary', vocabularyRoutes);
```

**Verification:**
```bash
node scripts/test-vocabulary-api.mjs
# Should verify:
# - GET /api/vocabulary returns 103 roots
# - GET /api/vocabulary/root/:root returns family data
# - POST /api/vocabulary/mastery updates database
```

### Step 3: Frontend — Wire the tab

**File:** `src/app/app/grammar/page.tsx`

Add the view switch:
```typescript
{view === 'vocabulary' && <VocabularyView />}
```

**File:** `src/app/components/vocabulary/VocabularyView.tsx` (new)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { RootCard } from './RootCard';
import { RootFamilyDetail } from './RootFamilyDetail';

interface RootCardData {
  word: string;
  meaning: string;
  frequencyRank: number;
  occurrences: number;
  mastery: number;
}

export function VocabularyView() {
  const [roots, setRoots] = useState<RootCardData[]>([]);
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoots();
  }, []);

  const fetchRoots = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ data: RootCardData[] }>('/api/vocabulary');
      setRoots(data.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch vocabulary:', err);
      setError('Could not load vocabulary data.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRoots = roots.filter(root =>
    root.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
    root.word.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-gray-400">Loading vocabulary...</div>
    </div>;
  }

  if (error) {
    return <div className="p-6 bg-red-900/20 border border-red-500 rounded-lg">
      <h2 className="text-lg font-bold text-red-400 mb-2">Error</h2>
      <p className="text-gray-400">{error}</p>
      <button onClick={fetchRoots} className="mt-4 px-4 py-2 bg-gray-700 rounded-lg">
        Retry
      </button>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Vocabulary (الجُذُور)
        </h1>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search roots or meanings..."
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
        />
      </div>

      {selectedRoot ? (
        <RootFamilyDetail root={selectedRoot} onBack={() => setSelectedRoot(null)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRoots.map(root => (
            <RootCard
              key={root.word}
              {...root}
              onSelect={() => setSelectedRoot(root.word)}
            />
          ))}
        </div>
      )}

      {filteredRoots.length === 0 && (
        <div className="p-6 bg-gray-800 rounded-lg">
          <p className="text-gray-400">No roots match your search.</p>
        </div>
      )}
    </div>
  );
}
```

**File:** `src/app/components/vocabulary/RootCard.tsx` (new)

```typescript
interface RootCardProps {
  root: string;
  meaning: string;
  frequencyRank: number;
  occurrences: number;
  mastery: number;
  onSelect: () => void;
}

export function RootCard({ root, meaning, frequencyRank, occurrences, mastery, onSelect }: RootCardProps) {
  const masteryPercent = (mastery / 5) * 100;

  return (
    <button
      onClick={onSelect}
      className="p-4 rounded-lg text-left transition-all border border-gray-700 bg-gray-800 hover:bg-gray-700 hover:border-leaf-500/50"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xl font-bold text-gold-400 font-amiri" dir="rtl">
          {root}
        </span>
        <span className="text-sm text-gray-500">
          Rank #{frequencyRank}
        </span>
      </div>

      <p className="text-gray-400 mb-2">{meaning}</p>

      <p className="text-sm text-gray-500 mb-3">
        {occurrences.toLocaleString()} occurrences
      </p>

      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-leaf-500 transition-all"
          style={{ width: `${masteryPercent}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {mastery}/5 mastered
      </p>
    </button>
  );
}
```

**File:** `src/app/components/vocabulary/RootFamilyDetail.tsx` (new)

```typescript
interface RootFamilyDetailProps {
  root: string;
  onBack: () => void;
}

interface FamilyMember {
  lemma: string;
  lemmaArabic: string;
  pos: string;
  form: string;
  occurrences: number;
}

interface FamilyData {
  root: string;
  members: FamilyMember[];
  mastery: { correctAttempts: number; totalAttempts: number; masteryLevel: number };
}

export function RootFamilyDetail({ root, onBack }: RootFamilyDetailProps) {
  const [data, setData] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFamily();
  }, [root]);

  const fetchFamily = async () => {
    setLoading(true);
    try {
      const data = await fetch(`/api/vocabulary/root/${encodeURIComponent(root)}`);
      const result = await data.json();
      setData(result.data);
    } catch (err) {
      console.error('Failed to fetch family:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-gray-400">Loading family...</div>
    </div>;
  }

  if (!data) {
    return <div className="p-6 bg-gray-800 rounded-lg">
      <p className="text-gray-400">Could not load root family.</p>
      <button onClick={onBack} className="mt-4 text-gold-400 hover:underline">
        ← Back to all roots
      </button>
    </div>;
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="text-gold-400 hover:underline"
      >
        ← Back to all roots
      </button>

      <div className="p-6 bg-gray-800 rounded-lg">
        <h2 className="text-3xl font-bold text-gold-400 font-amiri mb-2" dir="rtl">
          {data.root} ({root})
        </h2>
        <p className="text-gray-400 text-lg mb-4">
          Core meaning: {root}
        </p>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Family members</h3>
          <ul className="space-y-2">
            {data.members.map((member, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-gold-400 font-amiri text-lg" dir="rtl">
                  {member.lemmaArabic}
                </span>
                <span className="text-gray-400">
                  — {member.pos} · {member.occurrences} occurrences
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Corpus occurrences</h3>
          <p className="text-gray-400">
            This root appears {data.members.reduce((n, m) => n + m.occurrences, 0)} times in the Quran.
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Your mastery</h3>
          <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-leaf-500"
              style={{ width: `${(data.mastery.masteryLevel / 5) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {data.mastery.correctAttempts}/{data.mastery.totalAttempts} correct
          </p>
        </div>

        <button
          className="px-6 py-3 bg-gold-500 text-ground-950 font-semibold rounded-lg hover:bg-gold-400"
          onClick={() => window.location.href = `/learning?root=${encodeURIComponent(root)}`}
        >
          Practice this root →
        </button>
      </div>
    </div>
  );
}
```

### Step 4: Update DeepDiveView empty state

**File:** `src/app/components/grammar/DeepDiveView.tsx`

Add to `EMPTY_REASON` map:
```typescript
const EMPTY_REASON: Record<string, string> = {
  // ... existing entries
  vocabulary:
    'No vocabulary lessons are loaded. Run the vocabulary lesson seed to add ' +
    'the 103 core Quranic vocabulary words.',
};
```

### Step 5: Update grammar/page.tsx

**File:** `src/app/app/grammar/page.tsx`

Add the vocabulary view:
```typescript
{view === 'vocabulary' && <VocabularyView />}
```

---

## Evals & Verification

### Data Evals

```bash
# Check vocabulary lesson generation
node scripts/gen-vocabulary-lessons.mjs --check

# Verify content counts
node scripts/check-content.mjs

# Verify API returns expected data
node scripts/test-vocabulary-api.mjs
```

### UI Evals

- Build passes: `npm run build`
- Lint passes: `npm run lint`
- No hardcoded colors: grep for `#` in new components
- Arabic renders correctly: check in browser
- Empty state handles: test with no vocabulary data

### Integration Evals

- POST `/api/vocabulary/mastery` updates database
- GET `/api/vocabulary` returns correct roots
- GET `/api/vocabulary/root/:root` returns family + mastery

---

## UX Principles to Follow

- **Dark mode only** — no light mode variants
- **Green/gold palette** — progress uses green, actions use gold
- **Arabic first** — Arabic text renders correctly (Amiri/Noto Naskh)
- **No dead clicks** — every interactive element must work
- **Honest empty states** — say why something is empty if it should have content

---

## Testing Strategy

1. Unit tests: RootCard, RootFamilyDetail
2. Integration: API endpoints return correct data
3. E2E: User can navigate grammar → vocabulary → root detail

---

## Timeline

- **Content:** 1 hour (generate 103 lessons from core-100.json)
- **API:** 2 hours (3 endpoints + registration)
- **Frontend:** 3 hours (3 components + wire up)
- **Evals:** 1 hour
- **Total:** 7 hours

---

## Dependencies

- None — self-contained
- Existing: vocabulary_mastery table, RootExplorer component, design system

---

## Next Steps

1. Generate 103 vocabulary lessons from core-100.json
2. Build API endpoints
3. Build UI components
4. Wire to grammar page
5. Run evals and verify
6. Commit and deploy
