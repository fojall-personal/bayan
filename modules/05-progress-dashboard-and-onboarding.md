# Module 5 — Progress Dashboard & Onboarding

## Overview
The user's home base: visual tracking of all learning metrics, weekly goals, streak counter, score history, and the onboarding flow that personalizes the experience after assessment.

## Dependencies
- **Module 0**: D1 database, worker routes, auth working
- **Module 1**: Database seeded with user data, assessment results stored
- **Module 2**: Assessment complete, learning path assigned, `onboarding_completed` flag set
- **Module 3**: Lesson progress tracked in `lesson_progress` table
- **Module 4**: Memorization entries stored with review dates

## What This Module Delivers
- Landing page showing: current lesson, memorization targets for today, quick review options
- Visual progress bars per module (literacy, comprehension, grammar, memorization)
- Weekly goals and completion tracking with visual calendar
- Streak counter with fire emoji + day count
- Score history charts (line chart showing improvement over time)
- Onboarding flow for first-time users (goal selection, self-assessment, diagnostic prompt)
- Responsive design for mobile and desktop

## Architecture

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Navigation Bar                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │  Quick Actions    │  │  Today's Learning Plan          │  │
│  │                   │  │                                 │  │
│  │  [Continue       │  │  • Review: 3 vocabulary words   │  │
│  │    Lesson]        │  │  • New: Grammar-05 (20 min)    │  │
│  │  [Memorization    │  │  • Recall: Surah 1, Ayah 1-3  │  │
│  │    Review]        │  │  • Practice: Tajweed rules     │  │
│  │  [Quick Quiz]     │  │                                 │  │
│  └─────────────────┘  └─────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Progress Overview                                       ││
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  ││
│  │  │LIT   │ │COMP  │ │GRAM  │ │HIFZ  │                  ││
│  │  │72%   │ │58%   │ │45%   │ │61%   │                  ││
│  │  │████░  │ │███░  │ │██░   │ │████░ │                  ││
│  │  └──────┘ └──────┘ └──────┘ └──────┘                  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────────┐│
│  │  Streak & Goals   │  │  Score History                   ││
│  │                   │  │                                  ││
│  │  🔥 7 day streak  │  │  [Line chart of scores over      ││
│  │                   │  │   time — literacy, grammar, etc] ││
│  │  This week: 3/5   │  │                                  ││
│  │  lessons done     │  │                                  ││
│  └──────────────────┘  └──────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## File Specifications

### `workers/src/routes/progress.ts` — API Routes

```typescript
import { Hono } from 'hono';
import { Database } from '../lib/db';

const progress = new Hono();

// Get complete dashboard data
progress.get('/dashboard', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);

  // Fetch all dashboard data in parallel
  const [user, latestAssessment, lessonProgress, memorization, streak] = await Promise.all([
    db.get(`SELECT * FROM users WHERE id = ?`, [userId]),
    db.get(`SELECT * FROM assessment_results WHERE user_id = ? ORDER BY completed_at DESC LIMIT 1`, [userId]),
    db.query(`SELECT * FROM lesson_progress WHERE user_id = ? ORDER BY last_practiced DESC LIMIT 10`, [userId]),
    db.query(`SELECT * FROM memorization WHERE user_id = ? AND next_review <= datetime('now')`, [userId]),
    calculateStreak(db, userId),
  ]);

  // Calculate summary metrics
  const totalLessons = await db.get(`SELECT COUNT(*) as count FROM lessons`);
  const completedLessons = await db.query(
    `SELECT COUNT(*) as count FROM lesson_progress WHERE completed = 1 AND user_id = ?`,
    [userId]
  );

  const memorizedSurahs = await db.query(
    `SELECT DISTINCT surah_id FROM memorization WHERE user_id = ? AND status = 'mastered'`,
    [userId]
  );

  const vocabularyReviewed = await db.query(
    `SELECT COUNT(*) as count FROM vocabulary_mastery WHERE user_id = ? AND last_seen >= datetime('now', '-7 days')`,
    [userId]
  );

  return c.json({
    user,
    latestAssessment,
    todayReview: memorization,
    streak,
    stats: {
      totalLessons: totalLessons?.count || 0,
      completedLessons: completedLessons?.[0]?.count || 0,
      memorizedSurahs: memorizedSurahs.length,
      vocabularyReviewed: vocabularyReviewed?.[0]?.count || 0,
    },
    weeklyProgress: await getWeeklyProgress(db, userId),
  });
});

// Get score history for charts
progress.get('/scores', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);

  const history = await db.query(
    `SELECT literacy_score, comprehension_score, grammar_score, memorization_score, completed_at
     FROM assessment_results
     WHERE user_id = ?
     ORDER BY completed_at ASC`,
    [userId]
  );

  return c.json({ history });
});

// Get weekly progress
async function getWeeklyProgress(db: Database, userId: string) {
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const lessons = await db.query(
    `SELECT lesson_id, last_practiced FROM lesson_progress
     WHERE user_id = ? AND last_practiced >= ?`,
    [userId, startOfWeek.toISOString()]
  );

  const reviews = await db.query(
    `SELECT item_type, next_review FROM spaced_repetition
     WHERE user_id = ? AND next_review >= ?`,
    [userId, startOfWeek.toISOString()]
  );

  return {
    lessonsCompleted: lessons.length,
    reviewsCompleted: reviews.length,
    targetLessons: 5,
    targetReviews: 10,
  };
}

// Calculate streak
async function calculateStreak(db: Database, userId: string): Promise<number> {
  let streak = 0;
  let checkDate = new Date();

  // Check if user was active today
  const today = await db.get(
    `SELECT COUNT(*) as count FROM lesson_progress WHERE user_id = ? AND last_practiced >= date('now')`,
    [userId]
  );

  if (!today || today.count === 0) {
    // Check yesterday
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Count consecutive days
  while (true) {
    const dayData = await db.get(
      `SELECT COUNT(*) as count FROM lesson_progress
       WHERE user_id = ? AND DATE(last_practiced) = DATE(?, '-' || ? || ' days')`,
      [userId, new Date().toISOString(), streak]
    );

    if (!dayData || dayData.count === 0) break;
    streak++;
  }

  return streak;
}
```

### Frontend Components

#### `app/components/dashboard/Dashboard.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/progress/dashboard', {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
    })
    .then(res => res.json())
    .then(data => {
      setData(data);
      setLoading(false);
    })
    .catch(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading dashboard...</div>;
  if (!data) return <div>Failed to load dashboard</div>;

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, Fouad!</h1>
          <p className="text-gray-400">
            {data.user.onboarding_completed
              ? `You're on Path ${data.user.current_path.replace('path', '')}`
              : 'Complete your assessment to get started'
            }
          </p>
        </div>
        {data.streak > 0 && (
          <div className="flex items-center gap-2 bg-arabic-green/10 px-4 py-2 rounded-full">
            <span className="text-2xl">🔥</span>
            <span className="font-bold">{data.streak} day streak</span>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4">
        <a href="/learning" className="p-4 bg-arabic-green/10 border border-arabic-green rounded-lg hover:bg-arabic-green/20 transition-colors">
          <div className="text-2xl mb-2">📖</div>
          <div className="font-semibold">Continue Lesson</div>
          <div className="text-sm text-gray-400">Grammar-05 (20 min)</div>
        </a>
        <a href="/memorization" className="p-4 bg-blue-500/10 border border-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors">
          <div className="text-2xl mb-2">🕌</div>
          <div className="font-semibold">Memorization Review</div>
          <div className="text-sm text-gray-400">{data.todayReview.length} ayahs due</div>
        </a>
        <a href="/assessment" className="p-4 bg-purple-500/10 border border-purple-500 rounded-lg hover:bg-purple-500/20 transition-colors">
          <div className="text-2xl mb-2">📝</div>
          <div className="font-semibold">Quick Quiz</div>
          <div className="text-sm text-gray-400">Test your knowledge</div>
        </a>
      </div>

      {/* Progress overview */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Progress Overview</h2>
        <div className="grid grid-cols-4 gap-4">
          <ProgressBar label="Literacy" score={data.latestAssessment?.literacy_score || 0} color="green" />
          <ProgressBar label="Comprehension" score={data.latestAssessment?.comprehension_score || 0} color="blue" />
          <ProgressBar label="Grammar" score={data.latestAssessment?.grammar_score || 0} color="purple" />
          <ProgressBar label="Memorization" score={data.latestAssessment?.memorization_score || 0} color="orange" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Lessons Complete" value={`${data.stats.completedLessons}/${data.stats.totalLessons}`} />
        <StatCard label="Surahs Memorized" value={data.stats.memorizedSurahs.toString()} />
        <StatCard label="Words Reviewed" value={data.stats.vocabularyReviewed.toString()} />
        <StatCard label="This Week" value={`${data.weeklyProgress.lessonsCompleted}/${data.weeklyProgress.targetLessons}`} />
      </div>
    </div>
  );
}

function ProgressBar({ label, score, color }: { label: string; score: number; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'bg-arabic-green',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-bold">{score}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorMap[color]} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}
```

#### `app/components/onboarding/Onboarding.tsx`

```typescript
'use client';

import { useState } from 'react';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<'read_quran' | 'understand_arabic' | 'memorize_quran' | 'all'>('all');
  const [readingAbility, setReadingAbility] = useState<'no' | 'partial' | 'yes'>('no');
  const [memorizedSurahs, setMemorizedSurahs] = useState<'0' | '1-5' | '6-20' | '21+'>('0');
  const [challenge, setChallenge] = useState<'reading' | 'grammar' | 'memorization'>('reading');

  const handleStartAssessment = () => {
    // Save onboarding choices
    fetch('/api/auth/onboarding', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ goal, readingAbility, memorizedSurahs, challenge }),
    })
    .then(res => res.json())
    .then(() => {
      // Redirect to assessment
      window.location.href = '/assessment';
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              step >= s ? 'bg-arabic-green text-white' : 'bg-gray-700 text-gray-400'
            }`}>
              {s}
            </div>
            {s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-arabic-green' : 'bg-gray-700'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Goal Selection */}
      {step === 1 && (
        <div className="bg-gray-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">What's your goal?</h2>
          <div className="space-y-3">
            {[
              { value: 'read_quran', label: 'Read the Quran fluently', icon: '📖' },
              { value: 'understand_arabic', label: 'Understand Classical Arabic', icon: '🧠' },
              { value: 'memorize_quran', label: 'Memorize the Quran (Hifz)', icon: '🕌' },
              { value: 'all', label: 'All of the above', icon: '✨' },
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setGoal(option.value as any)}
                className={`w-full p-4 rounded-lg text-left flex items-center gap-4 transition-colors ${
                  goal === option.value ? 'bg-arabic-green/20 border border-arabic-green' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <span className="text-2xl">{option.icon}</span>
                <span className="font-semibold">{option.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!goal}
            className="w-full mt-6 py-3 bg-arabic-green text-white rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Step 2: Self-Assessment */}
      {step === 2 && (
        <div className="bg-gray-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Quick Self-Assessment</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-lg font-semibold mb-3">Can you read Arabic script?</label>
              <div className="flex gap-3">
                {[
                  { value: 'no', label: 'No' },
                  { value: 'partial', label: 'Partially' },
                  { value: 'yes', label: 'Yes, comfortably' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setReadingAbility(option.value as any)}
                    className={`flex-1 p-3 rounded-lg border transition-colors ${
                      readingAbility === option.value ? 'border-arabic-green bg-arabic-green/10' : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-lg font-semibold mb-3">How many surahs have you memorized?</label>
              <div className="flex gap-3">
                {[
                  { value: '0', label: 'None' },
                  { value: '1-5', label: '1-5' },
                  { value: '6-20', label: '6-20' },
                  { value: '21+', label: '21+' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setMemorizedSurahs(option.value as any)}
                    className={`flex-1 p-3 rounded-lg border transition-colors ${
                      memorizedSurahs === option.value ? 'border-arabic-green bg-arabic-green/10' : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-lg font-semibold mb-3">What's your biggest challenge?</label>
              <div className="flex gap-3">
                {[
                  { value: 'reading', label: 'Reading Arabic' },
                  { value: 'grammar', label: 'Grammar' },
                  { value: 'memorization', label: 'Memorization' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setChallenge(option.value as any)}
                    className={`flex-1 p-3 rounded-lg border transition-colors ${
                      challenge === option.value ? 'border-arabic-green bg-arabic-green/10' : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 py-3 bg-arabic-green text-white rounded-lg"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Assessment Prompt */}
      {step === 3 && (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-gray-400 mb-6">
            Take our 30-minute diagnostic assessment to personalize your learning path.
            We'll assess your Arabic reading, comprehension, grammar, and memorization levels.
          </p>

          <div className="bg-gray-700 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold mb-2">Your Profile:</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Goal: {goal}</li>
              <li>• Reading: {readingAbility}</li>
              <li>• Memorized: {memorizedSurahs} surahs</li>
              <li>• Challenge: {challenge}</li>
            </ul>
          </div>

          <button
            onClick={handleStartAssessment}
            className="w-full py-4 bg-arabic-green text-white rounded-lg text-lg font-semibold"
          >
            Start Assessment →
          </button>

          <button
            onClick={() => setStep(2)}
            className="w-full mt-3 py-2 text-gray-400 hover:text-white"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
```

#### `app/app/progress/page.tsx` — Progress Page

```typescript
'use client';

import { useState, useEffect } from 'react';

export default function ProgressPage() {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/progress/scores', {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
    })
    .then(res => res.json())
    .then(data => {
      setScores(data.history);
      setLoading(false);
    })
    .catch(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading progress...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Your Progress</h1>

      {/* Score history chart */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Score History</h2>
        {scores.length === 0 ? (
          <p className="text-gray-400">No assessment data yet. Take the diagnostic assessment to get started.</p>
        ) : (
          <div className="space-y-3">
            {scores.map((score, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="text-sm text-gray-400 w-24">
                  {new Date(score.completed_at).toLocaleDateString()}
                </div>
                <div className="flex-1 flex gap-2">
                  <ScoreBar label="Literacy" value={score.literacy_score} max={100} color="bg-arabic-green" />
                  <ScoreBar label="Grammar" value={score.grammar_score} max={100} color="bg-purple-500" />
                  <ScoreBar label="Memorization" value={score.memorization_score} max={100} color="bg-orange-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly calendar */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">This Week</h2>
        <WeeklyCalendar />
      </div>
    </div>
  );
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex-1">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

function WeeklyCalendar() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // Get current week dates
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, i) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const isToday = date.toDateString() === today.toDateString();

        return (
          <div
            key={day}
            className={`p-3 rounded-lg text-center ${
              isToday ? 'bg-arabic-green/20 border border-arabic-green' : 'bg-gray-700'
            }`}
          >
            <div className="text-sm text-gray-400">{day}</div>
            <div className="text-lg font-bold">{date.getDate()}</div>
          </div>
        );
      })}
    </div>
  );
}
```

### `workers/src/routes/auth.ts` — Onboarding Endpoint

```typescript
import { Hono } from 'hono';
import { Database } from '../lib/db';

const auth = new Hono();

// Complete onboarding and save user preferences
auth.post('/onboarding', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);
  const body = await c.req.json();

  const { goal, readingAbility, memorizedSurahs, challenge } = body;

  // Determine initial learning path based on self-assessment
  let currentPath = 'path1'; // Default: beginner
  if (readingAbility === 'yes' && memorizedSurahs !== '0') {
    currentPath = 'path3'; // Advanced
  } else if (readingAbility === 'partial') {
    currentPath = 'path2'; // Conversational
  }

  await db.run(
    `UPDATE users SET
     goal = ?,
     current_path = ?,
     onboarding_completed = 1,
     updated_at = datetime('now')
     WHERE id = ?`,
    [goal, currentPath, userId]
  );

  return c.json({ success: true, currentPath });
});
```

## Setup Commands

```bash
# No additional setup needed
# Dashboard and onboarding use existing data from Modules 0-4
```

## Verification Checklist
- [ ] `/api/progress/dashboard` returns all dashboard data
- [ ] Streak calculation is accurate (counts consecutive days)
- [ ] Weekly progress metrics are correct
- [ ] Score history returns assessment results in chronological order
- [ ] Onboarding flow completes and saves user preferences
- [ ] Learning path is assigned correctly based on onboarding answers
- [ ] Frontend dashboard renders all sections
- [ ] Progress bars update correctly with real data
- [ ] Onboarding form validates all fields before proceeding
- [ ] Mobile responsive layout works

## What's NOT in This Module
- Tajweed visualization (Module 6)
- Grammar deep-dive features (Module 7)
- AI tutor (Module 8)
- Community features (not planned for single-user)

## Next Module
**Module 6: Tajweed Visualization** — Color-coded Quran text by rule, interactive makharij diagrams, audio comparison, and rule-specific practice exercises.
