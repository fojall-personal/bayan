# Module 2 — Assessment Engine

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
> - a model-backed tutor — the tutor answers from corpus lookups and makes no model call


## Overview
The diagnostic engine that places users on the correct learning path. Runs a 30-45 minute test across 4 domains (literacy, comprehension, grammar, memorization) and generates a personalized curriculum.

## Dependencies
- **Module 0**: D1 database, worker routes, auth working
- **Module 1**: Database seeded with assessment questions, vocabulary, and lesson data

## What This Module Delivers
- A 4-module diagnostic assessment flow (frontend + backend)
- Audio recording integration for literacy module
- Scoring algorithm with weighted scoring
- Adaptive learning path generation
- Results dashboard with visual breakdown
- Learning path assignment logic (Path 1/2/3)

## Architecture

### Assessment Flow

```
User starts assessment
        ↓
┌─────────────────────────────────────────────────┐
│  Module A: Script Literacy (10 min)             │
│  - Listen & identify letters/words (audio)      │
│  - Vowel recognition (fatha, kasra, damma)      │
│  - Output: Literacy score (0-100)               │
└─────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────┐
│  Module B: Comprehension (15 min)               │
│  - Read Quran passages at escalating difficulty  │
│  - Answer comprehension questions               │
│  - Output: Comprehension level (A1-A3)          │
└─────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────┐
│  Module C: Grammar Knowledge (15 min)            │
│  - Nahw, Sarf, Balagha, Tajweed questions       │
│  - Multiple choice + pattern recognition        │
│  - Output: Grammar proficiency (0-100)          │
└─────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────┐
│  Module D: Memorization Baseline (10 min)        │
│  - Next-ayah recall for memorized surahs        │
│  - Phrase completion from memory                │
│  - Output: Current hifz level                   │
└─────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────┐
│  Scoring & Path Assignment                      │
│  - Weighted composite score                     │
│  - Generate personalized learning path          │
│  - Store results in assessment_results table    │
└─────────────────────────────────────────────────┘
        ↓
  Results dashboard with next steps
```

## File Specifications

### `workers/src/routes/assessment.ts` — API Routes

```typescript
import { Hono } from 'hono';
import { Database } from '../lib/db';

const assessment = new Hono();

// Start a new assessment session
assessment.post('/start', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);

  const sessionId = crypto.randomUUID();
  await db.run(
    `INSERT INTO assessment_sessions (id, user_id, status) VALUES (?, ?, ?)`,
    [sessionId, userId, 'in_progress']
  );

  return c.json({ sessionId, message: 'Assessment started' });
});

// Submit answers for a module
assessment.post('/:sessionId/module/:moduleId/submit', async (c) => {
  const { sessionId, moduleId } = c.req.param();
  const userId = c.get('userId');
  const body = await c.req.json();

  const { answers, timestamps } = body;
  const db = new Database(c.env.DB);

  // Load questions for this module from seeded content
  const questions = await getQuestionsForModule(db, moduleId);

  // Score the answers
  const score = scoreModuleAnswers(questions, answers);

  // Record the result
  await db.run(
    `UPDATE assessment_sessions SET module_${moduleId}_score = ?, module_${moduleId}_completed = 1, completed_at = datetime('now') WHERE id = ?`,
    [score, sessionId]
  );

  return c.json({ score, module: moduleId });
});

// Complete assessment and get learning path
assessment.post('/:sessionId/complete', async (c) => {
  const { sessionId } = c.req.param();
  const userId = c.get('userId');
  const db = new Database(c.env.DB);

  const session = await db.get(
    `SELECT * FROM assessment_sessions WHERE id = ?`,
    [sessionId]
  );

  if (!session) return c.json({ error: 'Session not found' }, 404);

  // Calculate weighted composite score
  const compositeScore = calculateCompositeScore({
    literacy: session.literacy_score || 0,
    comprehension: session.comprehension_score || 0,
    grammar: session.grammar_score || 0,
    memorization: session.memorization_score || 0,
  });

  // Generate learning path
  const learningPath = generateLearningPath({
    literacy: session.literacy_score || 0,
    comprehension: session.comprehension_score || 0,
    grammar: session.grammar_score || 0,
    memorization: session.memorization_score || 0,
  });

  // Store results
  const resultId = crypto.randomUUID();
  await db.run(
    `INSERT INTO assessment_results (id, user_id, literacy_score, comprehension_score, grammar_score, memorization_score, level, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [resultId, userId, session.literacy_score, session.comprehension_score, session.grammar_score, session.memorization_score, learningPath.level, JSON.stringify(learningPath)]
  );

  // Update user's current path
  await db.run(
    `UPDATE users SET current_path = ?, onboarding_completed = 1 WHERE id = ?`,
    [learningPath.pathId, userId]
  );

  return c.json({
    resultId,
    compositeScore,
    learningPath,
    message: 'Assessment complete. Your learning path has been generated.'
  });
});

// Get assessment progress
assessment.get('/:sessionId', async (c) => {
  const { sessionId } = c.req.param();
  const db = new Database(c.env.DB);

  const session = await db.get(
    `SELECT * FROM assessment_sessions WHERE id = ?`,
    [sessionId]
  );

  if (!session) return c.json({ error: 'Session not found' }, 404);

  return c.json(session);
});
```

### `workers/src/lib/scoring.ts` — Scoring Algorithm

```typescript
export interface AssessmentScores {
  literacy: number;          // 0-100
  comprehension: number;     // 0-100
  grammar: number;           // 0-100
  memorization: number;      // 0-100
}

export interface LearningPath {
  pathId: string;            // 'beginner', 'conversational', 'advanced'
  level: string;             // 'beginner', 'intermediate', 'advanced'
  recommendedModules: string[];  // ordered list of modules to focus on
  estimatedWeeks: number;
  weaknessAreas: string[];
  priorityFocus: string;
}

// Weighted scoring for composite placement
export function calculateCompositeScore(scores: AssessmentScores): number {
  const weights = {
    literacy: 0.20,
    comprehension: 0.30,
    grammar: 0.25,
    memorization: 0.25,
  };

  const weighted = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + (scores[key as keyof AssessmentScores] * weight),
    0
  );

  return Math.round(weighted);
}

// Adaptive learning path generation
export function generateLearningPath(scores: AssessmentScores): LearningPath {
  const weaknesses: string[] = [];
  const strengths: string[] = [];

  // Identify weakest and strongest areas
  const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  const weakest = sorted[0][0];
  const strongest = sorted[sorted.length - 1][0];

  for (const [key, score] of Object.entries(scores)) {
    if (score < 50) weaknesses.push(key);
    if (score >= 80) strengths.push(key);
  }

  // Determine learning path
  let pathId: string;
  let level: string;
  let estimatedWeeks: number;

  if (scores.literacy < 40) {
    // Path 1: Complete Beginner (no Arabic reading)
    pathId = 'beginner';
    level = 'beginner';
    estimatedWeeks = 24;
  } else if (scores.comprehension < 50 && scores.grammar < 50) {
    // Path 2: Conversational Speaker
    pathId = 'conversational';
    level = 'intermediate';
    estimatedWeeks = 16;
  } else {
    // Path 3: Advanced Reader
    pathId = 'advanced';
    level = 'advanced';
    estimatedWeeks = 12;
  }

  // Generate recommended module order based on weakest areas
  const recommendedModules = generateModuleOrder(weaknesses, scores);

  return {
    pathId,
    level,
    recommendedModules,
    estimatedWeeks,
    weaknessAreas: weaknesses,
    priorityFocus: weakest,
  };
}

// Generate ordered list of modules to focus on
function generateModuleOrder(weaknesses: string[], scores: AssessmentScores): string[] {
  // Always start with the weakest area
  const modules: string[] = [];

  if (weaknesses.includes('literacy')) modules.push('literacy');
  if (weaknesses.includes('comprehension')) modules.push('comprehension');
  if (weaknesses.includes('grammar')) modules.push('grammar');
  if (weaknesses.includes('memorization')) modules.push('memorization');

  // Add remaining modules for maintenance
  const allModules = ['literacy', 'comprehension', 'grammar', 'memorization'];
  for (const m of allModules) {
    if (!modules.includes(m)) {
      modules.push(m);
    }
  }

  return modules;
}

// Score a module's answers against the question set
export function scoreModuleAnswers(questions: any[], answers: any[]): number {
  let correct = 0;
  const total = questions.length;

  questions.forEach((q, i) => {
    const userAnswer = answers[i];
    if (userAnswer === undefined) return; // Skip unanswered

    switch (q.type) {
      case 'multiple_choice':
      case 'identification':
      case 'pattern_recognition':
        if (userAnswer === q.correct) correct++;
        break;

      case 'audio_listen':
        // For audio questions, compare the selected option text
        if (q.options[userAnswer]?.correct) correct++;
        break;

      case 'fill_blank':
        // Flexible matching: normalize Arabic text
        if (normalizeArabic(userAnswer) === normalizeArabic(q.correct)) correct++;
        break;

      case 'next_ayah':
        if (userAnswer === q.correct) correct++;
        break;

      default:
        // Unknown type — count as correct to not penalize
        correct++;
    }
  });

  return Math.round((correct / total) * 100);
}

// Normalize Arabic text for comparison
function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '')   // Remove tashkeel (diacritics)
    .replace(/آ|إ|أ/g, 'ا')                    // Normalize alef
    .replace(/ة/g, 'ه')                         // Normalize ta marbuta
    .replace(/\s+/g, ' ')                       // Normalize whitespace
    .trim();
}
```

### `workers/src/routes/assessment.ts` — Content Loading

```typescript
// Load assessment questions from seeded content
async function getQuestionsForModule(db: Database, moduleId: string): Promise<any[]> {
  // Assessment questions are stored in a static JSON file
  // We load them via KV or fetch from content endpoint
  const content = await c.env.KV.get(`assessment:${moduleId}`);
  if (!content) {
    // Fallback: generate from lesson data
    return generateQuestionsFromContent(db, moduleId);
  }
  return JSON.parse(content);
}

// Generate assessment questions from lesson content (dynamic generation)
async function generateQuestionsFromContent(db: Database, moduleId: string): Promise<any[]> {
  // For the MVP, we use pre-seeded questions
  // This function would generate questions dynamically from lesson data
  // in future iterations (adaptive question generation)
  return [];
}
```

### Frontend Components

#### `app/components/assessment/AssessmentModule.tsx`

```typescript
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface AssessmentModuleProps {
  sessionId: string;
  moduleId: string;
  title: string;
  durationMinutes: number;
  questions: Question[];
  onComplete: (score: number) => void;
  onExit: () => void;
}

interface Question {
  id: string;
  type: 'multiple_choice' | 'audio_listen' | 'fill_blank' | 'next_ayah';
  instruction: string;
  options?: { text: string; correct: boolean }[];
  correct?: string;
  audioUrl?: string;
  surah?: number;
  ayah?: number;
}

export function AssessmentModule({
  sessionId,
  moduleId,
  title,
  durationMinutes,
  questions,
  onComplete,
  onExit,
}: AssessmentModuleProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(string | number)[]>(new Array(questions.length).fill(''));
  const [startTime] = useState(Date.now());
  const router = useRouter();

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const handleAnswer = useCallback((answer: string | number) => {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = answer;
    setAnswers(newAnswers);
  }, [answers, currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // All questions answered — submit
      submitAnswers();
    }
  }, [currentIndex, questions.length]);

  const submitAnswers = async () => {
    const response = await fetch(`/api/assessment/${sessionId}/module/${moduleId}/submit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
      body: JSON.stringify({ answers, timestamps: Date.now() - startTime }),
    });

    const result = await response.json();
    onComplete(result.score);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>{title}</span>
          <span>{currentIndex + 1} / {questions.length}</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-arabic-green transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Timer */}
      <div className="text-sm text-gray-400 mb-4">
        Time: {Math.floor((Date.now() - startTime) / 60000)} min
      </div>

      {/* Question */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">{currentQuestion.instruction}</h3>

        {/* Audio question */}
        {currentQuestion.audioUrl && (
          <audio controls src={currentQuestion.audioUrl} className="w-full mb-4" />
        )}

        {/* Multiple choice */}
        {currentQuestion.options && (
          <div className="space-y-2">
            {currentQuestion.options.map((option, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(option.text)}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  answers[currentIndex] === option.text
                    ? 'bg-arabic-green/20 border border-arabic-green'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {option.text}
              </button>
            ))}
          </div>
        )}

        {/* Fill in the blank */}
        {currentQuestion.type === 'fill_blank' && (
          <input
            type="text"
            dir="rtl"
            value={answers[currentIndex] || ''}
            onChange={(e) => handleAnswer(e.target.value)}
            placeholder="Type your answer..."
            className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 text-white dir-rtl"
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onExit}
          className="px-4 py-2 text-gray-400 hover:text-white"
        >
          Skip Module
        </button>
        <button
          onClick={handleNext}
          disabled={!answers[currentIndex]}
          className="px-6 py-2 bg-arabic-green text-white rounded-lg disabled:opacity-50"
        >
          {currentIndex < questions.length - 1 ? 'Next' : 'Submit Module'}
        </button>
      </div>
    </div>
  );
}
```

#### `app/app/assessment/page.tsx` — Assessment Page

```typescript
'use client';

import { useState, useEffect } from 'react';
import { AssessmentModule } from '../../components/assessment/AssessmentModule';

export default function AssessmentPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [completedModules, setCompletedModules] = useState<Record<string, number>>({});
  const [isComplete, setIsComplete] = useState(false);

  // Start assessment session
  useEffect(() => {
    if (!sessionId) {
      fetch('/api/assessment/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_TOKEN}` },
      })
      .then(res => res.json())
      .then(data => setSessionId(data.sessionId));
    }
  }, [sessionId]);

  // Module definitions
  const modules = [
    { id: 'literacy', title: 'Arabic Script Literacy', duration: 10 },
    { id: 'comprehension', title: 'Classical Arabic Comprehension', duration: 15 },
    { id: 'grammar', title: 'Arabic Grammar Knowledge', duration: 15 },
    { id: 'memorization', title: 'Memorization Baseline', duration: 10 },
  ];

  const handleModuleComplete = async (moduleId: string, score: number) => {
    const newCompleted = { ...completedModules, [moduleId]: score };
    setCompletedModules(newCompleted);

    // If all modules done, complete the assessment
    const allDone = modules.every(m => newCompleted[m.id] !== undefined);
    if (allDone) {
      await completeAssessment(sessionId!);
    }
  };

  const completeAssessment = async (id: string) => {
    const res = await fetch(`/api/assessment/${id}/complete`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
    });
    const result = await res.json();
    setIsComplete(true);
    // Store result for dashboard display
  };

  if (!sessionId) return <div>Loading assessment...</div>;

  if (isComplete) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Assessment Complete!</h2>
        <p className="text-gray-400 mb-6">Your learning path has been generated based on your results.</p>
        <a href="/progress" className="px-6 py-3 bg-arabic-green text-white rounded-lg">
          View Your Results
        </a>
      </div>
    );
  }

  // Show first incomplete module
  const currentModule = modules.find(m => completedModules[m.id] === undefined);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Diagnostic Assessment</h1>

      {/* Module progress overview */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {modules.map(module => (
          <div
            key={module.id}
            className={`p-4 rounded-lg border ${
              completedModules[module.id] !== undefined
                ? 'bg-arabic-green/10 border-arabic-green'
                : module.id === currentModule?.id
                  ? 'bg-gray-700 border-arabic-green'
                  : 'bg-gray-800 border-gray-700'
            }`}
          >
            <div className="text-sm text-gray-400 mb-1">{module.title}</div>
            <div className="text-lg font-semibold">
              {completedModules[module.id] !== undefined
                ? `${completedModules[module.id]}%`
                : module.id === currentModule?.id ? '▶' : '○'
              }
            </div>
          </div>
        ))}
      </div>

      {/* Active module */}
      {currentModule && (
        <AssessmentModule
          sessionId={sessionId}
          moduleId={currentModule.id}
          title={currentModule.title}
          durationMinutes={currentModule.duration}
          questions={getQuestionsForModule(currentModule.id)}
          onComplete={(score) => handleModuleComplete(currentModule.id, score)}
          onExit={() => {
            // Mark as skipped with 0 score
            handleModuleComplete(currentModule.id, 0);
          }}
        />
      )}
    </div>
  );
}
```

## Setup Commands

```bash
# No additional setup needed — uses data from Module 1
# Just ensure assessment questions are in content/assessments/
```

## Verification Checklist
- [ ] Assessment starts with `/api/assessment/start` — returns sessionId
- [ ] Each module submission works: `/api/assessment/:id/module/:mod/submit`
- [ ] Scoring algorithm produces correct scores (verified with known answers)
- [ ] Composite score calculation is accurate (manually verify weights)
- [ ] Learning path generation assigns correct path (beginner/conversational/advanced)
- [ ] Results stored in `assessment_results` table
- [ ] User's `current_path` updated correctly
- [ ] Frontend assessment page renders all 4 modules
- [ ] Progress tracking works between modules
- [ ] Completion triggers learning path assignment

## What's NOT in This Module
- Spaced repetition scheduling (Module 4)
- Lesson delivery (Module 3)
- Memorization tracking UI (Module 4)
- Progress dashboard (Module 5)
- Tajweed visualization (Module 6)
- AI tutor (Module 7+)

## Next Module
**Module 3: Learning Engine** — Delivers lessons, exercises, vocabulary flashcards, and grammar drills based on the learning path assigned by this assessment.
