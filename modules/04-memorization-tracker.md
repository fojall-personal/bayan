# Module 4 — Memorization Tracker

## Overview
Tracks Quran memorization progress with spaced repetition scheduling, audio recording for self-review, and next-ayah recall exercises. The hifz (memorization) component of the app.

## Dependencies
- **Module 0**: D1 database, worker routes, auth working
- **Module 1**: Quran verse data available, memorization table schema exists
- **Module 2**: Assessment baseline completed (knows how many surahs user has memorized)

## What This Module Delivers
- Surah progress tracking (which ayahs memorized, in progress, or new)
- Audio recording + playback for self-review (Web Audio API)
- Spaced repetition scheduling using SM-2 algorithm
- Next-ayah recall exercises (type or select the following ayah)
- Memorization quality self-rating (1-5)
- Revision counter and streak tracking
- Memorization maintenance schedules

## Architecture

### Memorization Workflow

```
User selects surah
        ↓
  View progress: which ayahs are mastered / learning / new
        ↓
┌─────────────────────────────────────────────────┐
│  New/Review Ayah                                │
│  - Play recitation audio (Alafasy/AbdulBasit)   │
│  - User listens + reads along                   │
│  - Record user's recitation                     │
│  - Self-rate quality (1-5)                      │
│  - Update spaced repetition schedule            │
└─────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────┐
│  Recall Exercise                                │
│  - Hide text, play audio only                   │
│  - User types/reads the next ayah               │
│  - Compare with correct answer                  │
│  - Update mastery status                        │
└─────────────────────────────────────────────────┘
        ↓
  Progress saved, next review scheduled
```

### Spaced Repetition Algorithm (SM-2)

```
SM-2 Algorithm:
1. If user rates recall as 0-2 (poor):
   - Reset interval to 1 day
   - Decrease ease factor by 0.2
   
2. If user rates recall as 3 (ok):
   - Interval = previous interval × 1.2
   - Ease factor stays the same
   
3. If user rates recall as 4 (good):
   - Interval = previous interval × 2
   - Ease factor stays the same
   
4. If user rates recall as 5 (perfect):
   - Interval = previous interval × 2.5
   - Ease factor increases by 0.15

5. After 6 consecutive perfect recalls:
   - Interval = previous interval × 3
   - Mark as "mastered"
```

## File Specifications

### `workers/src/routes/memorization.ts` — API Routes

```typescript
import { Hono } from 'hono';
import { Database } from '../lib/db';

const memorization = new Hono();

// Get surah progress
memorization.get('/surah/:surahId', async (c) => {
  const { surahId } = c.req.param();
  const userId = c.get('userId');
  const db = new Database(c.env.DB);

  const entries = await db.query(
    `SELECT * FROM memorization WHERE user_id = ? AND surah_id = ? ORDER BY ayah_from ASC`,
    [userId, surahId]
  );

  return c.json({ surahId, entries });
});

// Get all memorization entries for user
memorization.get('/all', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);

  const all = await db.query(
    `SELECT surah_id, status, COUNT(*) as ayah_count FROM memorization
     WHERE user_id = ? GROUP BY surah_id, status`,
    [userId]
  );

  return c.json({ entries: all });
});

// Add a new memorization entry
memorization.post('/add', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);
  const body = await c.req.json();

  const { surahId, ayahFrom, ayahTo } = body;

  // Check if entry already exists
  const existing = await db.get(
    `SELECT * FROM memorization WHERE user_id = ? AND surah_id = ? AND ayah_from = ? AND ayah_to = ?`,
    [userId, surahId, ayahFrom, ayahTo]
  );

  if (existing) {
    return c.json({ error: 'Entry already exists' }, 409);
  }

  await db.run(
    `INSERT INTO memorization (user_id, surah_id, ayah_from, ayah_to, status, next_review)
     VALUES (?, ?, ?, ?, 'learning', datetime('now', '+1 day'))`,
    [userId, surahId, ayahFrom, ayahTo]
  );

  return c.json({ success: true, entry: { surahId, ayahFrom, ayahTo, status: 'learning' } });
});

// Review a memorization entry (spaced repetition)
memorization.post('/:id/review', async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId');
  const db = new Database(c.env.DB);
  const body = await c.req.json();

  const { quality, audioRecording } = body; // quality: 1-5

  const entry = await db.get(
    `SELECT * FROM memorization WHERE id = ? AND user_id = ?`,
    [id, userId]
  );

  if (!entry) return c.json({ error: 'Entry not found' }, 404);

  // Apply SM-2 algorithm
  const { nextReview, interval, easeFactor, status } = applySM2(entry, quality);

  // Update entry
  await db.run(
    `UPDATE memorization SET
     quality = ?,
     last_reviewed = datetime('now'),
     next_review = ?,
     revision_count = revision_count + 1,
     status = ?,
     ease_factor = ?
     WHERE id = ? AND user_id = ?`,
    [quality, nextReview, status, easeFactor, id, userId]
  );

  // Store audio recording if provided
  if (audioRecording) {
    // Upload to R2 bucket
    const audioKey = await uploadAudioRecording(audioRecording, id);
    await db.run(
      `UPDATE memorization SET audio_url = ? WHERE id = ?`,
      [audioKey, id]
    );
  }

  return c.json({ success: true, nextReview, status, interval });
});

// Next-ayah recall exercise
memorization.post('/:id/recall', async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId');
  const db = new Database(c.env.DB);
  const body = await c.req.json();

  const { recalledAyah } = body; // What the user says comes next

  const entry = await db.get(
    `SELECT * FROM memorization WHERE id = ? AND user_id = ?`,
    [id, userId]
  );

  if (!entry) return c.json({ error: 'Entry not found' }, 404);

  // Get the next ayah in the surah
  const nextAyah = entry.ayah_to + 1; // Next ayah number

  // Check if user's recall matches
  const isCorrect = recalledAyah === nextAyah;

  // Update review based on recall
  const newQuality = isCorrect ? 5 : Math.max(1, entry.quality - 2);
  const { nextReview, status } = applySM2(entry, newQuality);

  await db.run(
    `UPDATE memorization SET
     next_review = ?,
     quality = ?,
     last_reviewed = datetime('now'),
     revision_count = revision_count + 1,
     status = ?
     WHERE id = ? AND user_id = ?`,
    [nextReview, newQuality, status, id, userId]
  );

  return c.json({ success: true, correct: isCorrect, nextAyah });
});

// Get today's review targets
memorization.get('/review/today', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);

  const due = await db.query(
    `SELECT m.*, q.text_simple as verse_text
     FROM memorization m
     LEFT JOIN quran_verses q ON m.surah_id = q.surah AND m.ayah_to = q.ayah
     WHERE m.user_id = ? AND m.next_review <= datetime('now')
     ORDER BY m.next_review ASC`,
    [userId]
  );

  return c.json({ due: due });
});

// Get all surahs with their memorization status
memorization.get('/surahs', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);

  const surahs = await db.query(
    `SELECT surah_id,
            SUM(CASE WHEN status = 'mastered' THEN 1 ELSE 0 END) as mastered,
            SUM(CASE WHEN status = 'learning' THEN 1 ELSE 0 END) as learning,
            SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) as reviewing,
            SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_ayahs
     FROM memorization
     WHERE user_id = ?
     GROUP BY surah_id
     ORDER BY surah_id ASC`,
    [userId]
  );

  return c.json({ surahs });
});
```

### `workers/src/lib/space-repetition.ts` — SM-2 Algorithm

```typescript
interface MemorizationEntry {
  id: string;
  quality: number;
  interval: number;
  ease_factor: number;
  reviews_count: number;
  status: string;
}

export interface SM2Result {
  nextReview: string;
  interval: number;
  easeFactor: number;
  status: string;
}

// SM-2 spaced repetition algorithm
export function applySM2(entry: MemorizationEntry, quality: number): SM2Result {
  let { interval, ease_factor } = entry;

  // Default initial values
  if (interval === 0) interval = 1;

  if (quality <= 2) {
    // Poor recall — reset to 1 day
    interval = 1;
    ease_factor = Math.max(1.3, ease_factor - 0.2);
  } else if (quality === 3) {
    // OK recall — small interval increase
    interval = Math.round(interval * 1.2);
  } else if (quality === 4) {
    // Good recall — double interval
    interval = Math.round(interval * 2);
  } else {
    // Perfect recall — 2.5x interval
    interval = Math.round(interval * 2.5);
    ease_factor = Math.min(3.0, ease_factor + 0.15);
  }

  // After 6 consecutive perfect recalls, increase interval multiplier
  if (quality === 5 && entry.reviews_count > 6) {
    interval = Math.round(interval * 1.5);
  }

  // Determine status based on interval
  let status = entry.status;
  if (interval >= 30 && quality >= 4) {
    status = 'mastered';
  } else if (interval >= 7) {
    status = 'reviewing';
  } else {
    status = 'learning';
  }

  // Calculate next review date
  const nextReview = new Date(Date.now() + interval * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  return {
    nextReview,
    interval,
    easeFactor: ease_factor,
    status,
  };
}

// Calculate review schedule for a surah
export function calculateReviewSchedule(surahId: number, entryCount: number): ReviewDay[] {
  const schedule: ReviewDay[] = [];
  const days = [1, 2, 4, 7, 14, 30, 60, 90, 180, 365];

  for (let i = 0; i < days.length; i++) {
    schedule.push({
      day: days[i],
      label: getReviewLabel(days[i]),
      description: getReviewDescription(days[i]),
    });
  }

  return schedule;
}

interface ReviewDay {
  day: number;
  label: string;
  description: string;
}

function getReviewLabel(days: number): string {
  if (days === 1) return 'Today';
  if (days === 2) return 'Tomorrow';
  if (days === 7) return '1 week';
  if (days === 30) return '1 month';
  if (days === 365) return '1 year';
  return `${days} days`;
}

function getReviewDescription(days: number): string {
  if (days <= 1) return 'Review today to reinforce memory';
  if (days <= 7) return 'Regular review to maintain recall';
  if (days <= 30) return 'Monthly maintenance review';
  return 'Annual maintenance — quick scan through memorization';
}
```

### Frontend Components

#### `app/components/memorization/SurahProgress.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';

interface SurahProgressProps {
  surahId: number;
  surahName: string;
  totalAyahs: number;
}

export function SurahProgress({ surahId, surahName, totalAyahs }: SurahProgressProps) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/memorization/surah/${surahId}`, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
    })
    .then(res => res.json())
    .then(data => {
      setEntries(data.entries);
      setLoading(false);
    })
    .catch(() => setLoading(false));
  }, [surahId]);

  if (loading) return <div>Loading surah progress...</div>;

  const masteredCount = entries.filter(e => e.status === 'mastered').length;
  const learningCount = entries.filter(e => e.status === 'learning').length;
  const reviewingCount = entries.filter(e => e.status === 'reviewing').length;
  const percentage = (masteredCount / totalAyahs) * 100;

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">{surahName} ({surahId})</h2>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>{masteredCount} / {totalAyahs} ayahs memorized</span>
          <span>{Math.round(percentage)}%</span>
        </div>
        <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-arabic-green transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-arabic-green/10 rounded-lg">
          <div className="text-2xl font-bold text-arabic-green">{masteredCount}</div>
          <div className="text-sm text-gray-400">Mastered</div>
        </div>
        <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
          <div className="text-2xl font-bold text-yellow-500">{learningCount}</div>
          <div className="text-sm text-gray-400">Learning</div>
        </div>
        <div className="text-center p-3 bg-blue-500/10 rounded-lg">
          <div className="text-2xl font-bold text-blue-500">{reviewingCount}</div>
          <div className="text-sm text-gray-400">Reviewing</div>
        </div>
      </div>

      {/* Ayah grid */}
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: totalAyahs }, (_, i) => i + 1).map(ayah => {
          const entry = entries.find(e => e.ayah_from <= ayah && e.ayah_to >= ayah);
          const status = entry?.status || 'new';

          return (
            <button
              key={ayah}
              className={`p-2 rounded text-center text-sm font-medium transition-colors ${
                status === 'mastered' ? 'bg-arabic-green text-white' :
                status === 'learning' ? 'bg-yellow-500 text-black' :
                status === 'reviewing' ? 'bg-blue-500 text-white' :
                'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {ayah}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

#### `app/components/memorization/ReviewSession.tsx`

```typescript
'use client';

import { useState } from 'react';

interface ReviewSessionProps {
  entry: MemorizationEntry;
  onComplete: (quality: number) => void;
  onSkip: () => void;
}

export function ReviewSession({ entry, onComplete, onSkip }: ReviewSessionProps) {
  const [step, setStep] = useState<'listen' | 'recite' | 'rate'>('listen');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [selfRating, setSelfRating] = useState(0);

  const handlePlayAudio = () => {
    // Play recitation audio for the ayah range
    setAudioPlaying(true);
    // Audio playback logic here
    setTimeout(() => setAudioPlaying(false), 5000); // Placeholder
  };

  const handleRecite = async () => {
    // Record user's recitation
    const recording = await recordUserRecitation();
    // Upload to R2
    await uploadAudio(recording, entry.id);
    setStep('rate');
  };

  const handleRate = (quality: number) => {
    setSelfRating(quality);
    // Submit review result
    fetch(`/api/memorization/${entry.id}/review`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
      body: JSON.stringify({ quality }),
    })
    .then(res => res.json())
    .then(data => {
      onComplete(data.nextReview);
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Ayah display */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6 text-center">
        <h2 className="text-3xl text-arabic-green mb-4" dir="rtl">
          {entry.ayah_text}
        </h2>
        <p className="text-gray-400">Surah {entry.surah_id}, Ayahs {entry.ayah_from}-{entry.ayah_to}</p>
      </div>

      {/* Step 1: Listen */}
      {step === 'listen' && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Step 1: Listen</h3>
          <p className="text-gray-400 mb-6">Listen to the recitation and read along</p>

          <button
            onClick={handlePlayAudio}
            disabled={audioPlaying}
            className="w-full py-4 bg-arabic-green text-white rounded-lg text-lg disabled:opacity-50"
          >
            {audioPlaying ? 'Playing...' : '▶ Play Recitation'}
          </button>

          <button
            onClick={() => setStep('recite')}
            className="w-full mt-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            I've listened — Continue to Recite
          </button>
        </div>
      )}

      {/* Step 2: Recite */}
      {step === 'recite' && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Step 2: Recite</h3>
          <p className="text-gray-400 mb-6">Record yourself reciting the ayahs</p>

          <button
            onClick={handleRecite}
            className="w-full py-4 bg-arabic-green text-white rounded-lg text-lg"
          >
            🎤 Record Recitation
          </button>

          <button
            onClick={onSkip}
            className="w-full mt-4 py-3 text-gray-400 hover:text-white"
          >
            Skip for now
          </button>
        </div>
      )}

      {/* Step 3: Rate */}
      {step === 'rate' && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Step 3: Rate Your Recall</h3>
          <p className="text-gray-400 mb-6">How well did you remember?</p>

          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(quality => (
              <button
                key={quality}
                onClick={() => handleRate(quality)}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  selfRating === quality ? 'bg-arabic-green/20 border border-arabic-green' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {getQualityLabel(quality)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getQualityLabel(quality: number): string {
  const labels = {
    1: 'I didn\'t remember at all',
    2: 'I struggled to recall',
    3: 'I remembered with difficulty',
    4: 'I remembered fairly well',
    5: 'I remembered perfectly',
  };
  return labels[quality as keyof typeof labels] || '';
}
```

## Setup Commands

```bash
# No additional setup needed — uses D1 tables from Module 0
# Ensure R2 bucket is created for audio storage (optional)
wrangler r2 bucket create languagebuilder-audio
```

## Verification Checklist
- [ ] Surah progress endpoint returns correct entries
- [ ] Adding new memorization entry works
- [ ] Review submission updates spaced repetition schedule
- [ ] SM-2 algorithm produces correct intervals
- [ ] Audio recording can be uploaded to R2
- [ ] Next-ayah recall exercise works
- [ ] Today's review targets endpoint returns due items
- [ ] Frontend surah progress displays correctly
- [ ] Review session flow works (listen → recite → rate)
- [ ] Memorization status updates (learning → reviewing → mastered)

## What's NOT in This Module
- Progress dashboard UI (Module 5)
- Tajweed visualization during recitation (Module 6)
- Grammar integration in memorization (Module 7)
- AI tutor for memorization feedback (Module 8)

## Next Module
**Module 5: Progress Dashboard & Onboarding** — Visual tracking of all learning metrics, weekly goals, streak counter, score history charts, and the onboarding flow that ties assessment to learning path.
