# Module 3 — Learning Engine

> **Pre-implementation design spec.** Written before the code, and kept for its
> reasoning rather than as a description of the app. Where it disagrees with the app,
> the app is right.
>
> Authoritative now: `README.md` for what works and what is planned, `AGENTS.md` for the
> live API and page lists (both generated from source and gated in CI), and
> `docs/lesson-review.html` for the lesson content.
>
> Live 2026-08-16: five bands; Look up (`/tutor`); Saheeh International; 424 lessons; FSRS-6; Access JWT. See `AGENTS.md` Architecture.
>
> Known to describe things that did not ship:
> - audio recording of your own recitation — never built; no microphone capture exists


## Overview
Delivers personalized lessons, exercises, vocabulary flashcards, and grammar drills. The core teaching component that transforms assessment results into actionable learning experiences.

## Dependencies
- **Module 0**: D1 database, worker routes, auth working
- **Module 1**: Grammar lessons seeded in database, vocabulary data available
- **Module 2**: Learning path assigned to user (Path 1/2/3), lesson order determined

## What This Module Delivers
- Interactive lesson delivery system with progressive disclosure
- 30+ grammar lessons with exercises (seeded from Module 1 data)
- Vocabulary flashcard system with spaced repetition
- Grammar pattern recognition drills
- Audio pronunciation modeling (TTS integration)
- Lesson progress tracking with attempt counting
- Prerequisite checking (can't access advanced lessons without basics)
- Exercise types: multiple choice, fill-in-blank, matching, audio repetition

## Architecture

### Lesson Delivery Flow

```
User opens Learning tab
        ↓
  Check current_path + prerequisites
        ↓
  Load next available lesson
        ↓
┌─────────────────────────────────────────────────┐
│  Lesson Display                                 │
│  - Explanation text (Arabic + English)          │
│  - Audio pronunciation (TTS)                    │
│  - Visual examples                              │
│  - Interactive exercises                        │
└─────────────────────────────────────────────────┘
        ↓
  User completes exercises
        ↓
  Score calculation + progress update
        ↓
  Next lesson / Review reminder
```

### Exercise Types Supported

| Type | Description | Example |
|------|-------------|---------|
| Multiple Choice | Select correct answer from options | "What does كِتَاب mean?" → [Book, Write, Read, Door] |
| Fill in Blank | Type Arabic text to complete | "ال + كِتَاب = _____" |
| Match | Pair items correctly | Match Arabic words to English meanings |
| Audio Repeat | Listen and repeat (self-recorded) | Listen to pronunciation, record yourself |
| Pattern Recognition | Identify grammar patterns | "Is this a sun letter or moon letter?" |
| Translation | Translate Arabic to English | Translate a Quranic phrase |
| Next Ayah | Complete a memorized passage | "What comes after هذه الآية?" |

## File Specifications

### `workers/src/routes/learning.ts` — API Routes

```typescript
import { Hono } from 'hono';
import { Database } from '../lib/db';

const learning = new Hono();

// Get next lesson based on learning path
learning.get('/next', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);

  // Get user's current path
  const user = await db.get(
    `SELECT current_path FROM users WHERE id = ?`,
    [userId]
  );

  if (!user) return c.json({ error: 'User not found' }, 404);

  // Get all lessons, filter by prerequisites
  const allLessons = await db.query(
    `SELECT * FROM lessons ORDER BY level ASC, id ASC`
  );

  // Apply prerequisite logic
  const availableLessons = allLessons.filter(lesson => {
    const completedLessons = await getCompletedLessonIds(db, userId);
    return lesson.prerequisites.every((prereq: string) =>
      completedLessons.includes(prereq)
    );
  });

  // Get the next lesson (first uncompleted one in path order)
  const pathOrder = getPathOrder(user.current_path);
  const nextLesson = availableLessons.find(lesson =>
    pathOrder.includes(lesson.module) && !isLessonCompleted(db, userId, lesson.id)
  );

  if (!nextLesson) {
    return c.json({
      message: 'All lessons in your path are complete!',
      lesson: null
    });
  }

  return c.json({
    lesson: nextLesson,
    totalInPath: allLessons.length,
    completedInPath: completedLessons.length,
    nextExercise: generateNextExercise(nextLesson)
  });
});

// Submit exercise answer
learning.post('/:lessonId/exercise', async (c) => {
  const { lessonId } = c.req.param();
  const userId = c.get('userId');
  const body = await c.req.json();

  const { exerciseIndex, answer, timeSpent } = body;
  const db = new Database(c.env.DB);

  // Get lesson and exercise
  const lesson = await db.get(
    `SELECT * FROM lessons WHERE id = ?`,
    [lessonId]
  );

  if (!lesson) return c.json({ error: 'Lesson not found' }, 404);

  const exercises = JSON.parse(lesson.exercises);
  const exercise = exercises[exerciseIndex];

  // Check answer
  const isCorrect = checkAnswer(exercise, answer);

  // Update progress
  await db.run(
    `INSERT OR REPLACE INTO lesson_progress (lesson_id, module, completed, score, attempts, last_practiced, next_review)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now', '+1 day'))`,
    [lessonId, lesson.module, 0, isCorrect ? 100 : 0, 1]
  );

  // Track quiz attempt
  await db.run(
    `INSERT INTO quiz_attempts (id, user_id, lesson_id, module, questions_answered, questions_correct, time_seconds)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [crypto.randomUUID(), userId, lessonId, lesson.module, isCorrect ? 1 : 0, timeSpent]
  );

  return c.json({
    correct: isCorrect,
    explanation: exercise.explanation || 'Check your answer and try again.',
    nextExercise: exerciseIndex + 1 < exercises.length ? exercises[exerciseIndex + 1] : null
  });
});

// Get vocabulary words for review
learning.get('/vocabulary/review', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);

  const words = await db.query(
    `SELECT * FROM vocabulary_mastery WHERE next_review <= datetime('now')
     ORDER BY ease_factor ASC, reviews ASC LIMIT 20`
  );

  return c.json({ words });
});

// Submit vocabulary review result
learning.post('/vocabulary/:word/review', async (c) => {
  const { word } = c.req.param();
  const userId = c.get('userId');
  const body = await c.req.json();

  const { understood, timeSpent } = body;
  const db = new Database(c.env.DB);

  // Update spaced repetition
  await db.run(
    `UPDATE vocabulary_mastery SET
     meaning_known = ?,
     last_seen = datetime('now'),
     next_review = datetime('now', '+' || ? || ' days'),
     reviews = reviews + 1,
     ease_factor = CASE WHEN ? = 1 THEN ease_factor + 0.2 ELSE ease_factor - 0.1 END,
     INTERVAL_days = CASE WHEN ? = 1 THEN INTERVAL_days * 2 ELSE 1 END
     WHERE user_id = ? AND word = ?`,
    [understood, understood ? 2 : 1, understood, understood, userId, word]
  );

  return c.json({ success: true });
});

// Get all available lessons for user's path
learning.get('/lessons', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);

  const user = await db.get(
    `SELECT current_path FROM users WHERE id = ?`,
    [userId]
  );

  const allLessons = await db.query(
    `SELECT * FROM lessons ORDER BY level ASC, id ASC`
  );

  const completedLessons = await db.query(
    `SELECT lesson_id FROM lesson_progress WHERE completed = 1 AND user_id = ?`,
    [userId]
  );

  return c.json({
    lessons: allLessons,
    completed: completedLessons.map(l => l.lesson_id),
    currentPath: user.current_path
  });
});
```

### `workers/src/lib/lesson-engine.ts` — Lesson Logic

```typescript
export interface Lesson {
  id: string;
  title: string;
  module: 'literacy' | 'grammar' | 'vocabulary' | 'tajweed';
  level: 1 | 2 | 3 | 4 | 5;
  content: LessonContent;
  exercises: Exercise[];
  prerequisites: string[];
  estimated_minutes: number;
}

export interface LessonContent {
  explanation: string;
  examples: Example[];
  rules?: Rule[];
  conjugation_table?: ConjugationTable;
}

export interface Example {
  arabic: string;
  transliteration: string;
  meaning: string;
  rule?: string;
}

export interface Rule {
  name: string;
  description: string;
  letters?: string;
  examples: string[];
}

export interface ConjugationTable {
  root: string;
  meaning: string;
  forms: Record<string, string>;
}

export interface Exercise {
  type: 'multiple_choice' | 'fill_blank' | 'match' | 'audio_repeat' | 'pattern_recognition' | 'translation' | 'next_ayah';
  question: string;
  options?: { text: string; correct: boolean }[];
  correct?: string | number;
  pairs?: { item: string; answer: string }[];
  explanation?: string;
  audioUrl?: string;
  surah?: number;
  ayah?: number;
}

// Path order definitions
const PATH_ORDERS: Record<string, string[]> = {
  path1: ['literacy', 'literacy', 'literacy', 'grammar', 'grammar', 'vocabulary', 'vocabulary', 'tajweed', 'tajweed'],
  path2: ['grammar', 'grammar', 'vocabulary', 'comprehension', 'comprehension', 'tajweed', 'tajweed'],
  path3: ['tajweed', 'tajweed', 'grammar', 'grammar', 'balagha', 'balagha'],
};

// Get the learning path order
function getPathOrder(pathId: string): string[] {
  return PATH_ORDERS[pathId] || PATH_ORDERS.path1;
}

// Generate the next exercise for a lesson
function generateNextExercise(lesson: Lesson): Exercise | null {
  if (!lesson.exercises || lesson.exercises.length === 0) return null;
  return lesson.exercises[0];
}

// Check if an answer is correct
function checkAnswer(exercise: Exercise, answer: any): boolean {
  switch (exercise.type) {
    case 'multiple_choice':
      return exercise.options?.[answer]?.correct || false;

    case 'fill_blank':
      return normalizeArabic(answer) === normalizeArabic(exercise.correct);

    case 'match':
      // For matching, all pairs must be correct
      return JSON.stringify(answer) === JSON.stringify(exercise.correct);

    case 'pattern_recognition':
      return exercise.options?.[answer]?.correct || false;

    case 'translation':
      return normalizeArabic(answer) === normalizeArabic(exercise.correct);

    case 'next_ayah':
      return exercise.options?.[answer]?.correct || false;

    case 'audio_repeat':
      // Audio is self-recorded — we can't automatically grade
      // Return true to mark as "attempted" (manual review later)
      return true;

    default:
      return false;
  }
}

// Normalize Arabic text for comparison
function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/آ|إ|أ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}
```

### Frontend Components

#### `app/components/learning/LessonView.tsx`

```typescript
'use client';

import { useState } from 'react';

interface LessonViewProps {
  lesson: Lesson;
  onComplete: (score: number) => void;
  onSkip: () => void;
}

export function LessonView({ lesson, onComplete, onSkip }: LessonViewProps) {
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | number>('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);

  const exercise = lesson.exercises[currentExerciseIndex];

  const handleAnswer = async (answer: string | number) => {
    setSelectedAnswer(answer);

    const response = await fetch(`/api/learning/${lesson.id}/exercise`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
      body: JSON.stringify({
        exerciseIndex: currentExerciseIndex,
        answer,
        timeSpent: 30 // Approximate
      }),
    });

    const result = await response.json();

    if (result.correct) {
      setScore(prev => prev + 100 / lesson.exercises.length);
    }

    setShowExplanation(true);
  };

  const handleNext = () => {
    if (currentExerciseIndex < lesson.exercises.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
      setSelectedAnswer('');
      setShowExplanation(false);
    } else {
      onComplete(Math.round(score));
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Lesson header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{lesson.title}</h1>
        <div className="flex gap-4 text-sm text-gray-400">
          <span>Module: {lesson.module}</span>
          <span>Level: {lesson.level}</span>
          <span>~{lesson.estimated_minutes} min</span>
        </div>
      </div>

      {/* Content section */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: lesson.content.explanation }} />

        {/* Examples */}
        {lesson.content.examples && (
          <div className="mt-6 space-y-4">
            {lesson.content.examples.map((example, i) => (
              <div key={i} className="bg-gray-700 rounded p-4">
                <div className="text-2xl text-arabic-green mb-2" dir="rtl">{example.arabic}</div>
                <div className="text-gray-300">{example.meaning}</div>
                {example.rule && (
                  <div className="text-sm text-arabic-gold mt-1">{example.rule}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Conjugation table */}
        {lesson.content.conjugation_table && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="p-2 text-left">Form</th>
                  <th className="p-2 text-right" dir="rtl">Arabic</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(lesson.content.conjugation_table.forms).map(([form, arabic]) => (
                  <tr key={form} className="border-b border-gray-700">
                    <td className="p-2">{form}</td>
                    <td className="p-2 text-right" dir="rtl">{arabic}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Exercise section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="mb-4">
          <span className="text-sm text-gray-400">Exercise {currentExerciseIndex + 1} / {lesson.exercises.length}</span>
        </div>

        <h3 className="text-lg font-semibold mb-4">{exercise.question}</h3>

        {/* Multiple choice */}
        {exercise.options && (
          <div className="space-y-2">
            {exercise.options.map((option, i) => (
              <button
                key={i}
                onClick={() => !showExplanation && handleAnswer(option.text)}
                disabled={showExplanation}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  showExplanation
                    ? option.correct
                      ? 'bg-arabic-green/20 border border-arabic-green'
                      : 'bg-gray-700'
                    : selectedAnswer === option.text
                      ? 'bg-arabic-green/20 border border-arabic-green'
                      : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {option.text}
              </button>
            ))}
          </div>
        )}

        {/* Fill in blank */}
        {exercise.type === 'fill_blank' && !showExplanation && (
          <input
            type="text"
            dir="rtl"
            value={selectedAnswer || ''}
            onChange={(e) => setSelectedAnswer(e.target.value)}
            placeholder="Type your answer..."
            className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 text-white dir-rtl"
          />
        )}

        {/* Explanation */}
        {showExplanation && exercise.explanation && (
          <div className="mt-4 p-4 bg-arabic-green/10 border border-arabic-green rounded-lg">
            <p className="text-arabic-green">{exercise.explanation}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={onSkip}
            className="px-4 py-2 text-gray-400 hover:text-white"
          >
            Skip Lesson
          </button>
          <button
            onClick={handleNext}
            disabled={!selectedAnswer && !showExplanation}
            className="px-6 py-2 bg-arabic-green text-white rounded-lg disabled:opacity-50"
          >
            {currentExerciseIndex < lesson.exercises.length - 1 ? 'Next Exercise' : 'Complete Lesson'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### `app/app/learning/page.tsx` — Learning Page

```typescript
'use client';

import { useState, useEffect } from 'react';
import { LessonView } from '../../components/learning/LessonView';

export default function LearningPage() {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  // Load next lesson
  useEffect(() => {
    fetch('/api/learning/next', {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
    })
    .then(res => res.json())
    .then(data => {
      setLesson(data.lesson);
      setLoading(false);
    })
    .catch(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading lesson...</div>;

  if (!lesson) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">All Lessons Complete!</h2>
        <p className="text-gray-400 mb-6">You've finished all lessons in your learning path.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-arabic-green text-white rounded-lg"
        >
          Start Over
        </button>
      </div>
    );
  }

  return (
    <LessonView
      lesson={lesson}
      onComplete={(score) => {
        // Lesson complete — show progress update
        alert(`Lesson complete! Score: ${score}%`);
        window.location.reload(); // Reload to get next lesson
      }}
      onSkip={() => window.location.reload()}
    />
  );
}
```

## Setup Commands

```bash
# No additional setup — uses lessons seeded in Module 1
# Just ensure lesson content is properly formatted in content/grammar/lessons.json
```

## Verification Checklist
- [ ] `/api/learning/next` returns next available lesson based on path
- [ ] Prerequisites are correctly enforced (can't skip lessons)
- [ ] Exercise answers are validated correctly
- [ ] Progress is saved to `lesson_progress` table
- [ ] Quiz attempts are recorded in `quiz_attempts`
- [ ] Vocabulary review system works (shows due words)
- [ ] Vocabulary spaced repetition updates correctly
- [ ] Frontend lesson view renders exercises properly
- [ ] Multiple exercise types work (MC, fill-in, match, etc.)
- [ ] Audio pronunciation can be triggered (TTS integration)

## What's NOT in This Module
- Spaced repetition scheduling logic (Module 4)
- Memorization tracking (Module 4)
- Progress dashboard UI (Module 5)
- Tajweed visualization (Module 6)
- Grammar deep-dive features (Module 7)

## Next Module
**Module 4: Memorization Tracker** — Hifz progress tracking, spaced repetition scheduling, audio recording for self-review, and next-ayah recall exercises.
