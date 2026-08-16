# Module 7 — Grammar Deep-Dive

> **Pre-implementation design spec.** Written before the code, and kept for its
> reasoning rather than as a description of the app. Where it disagrees with the app,
> the app is right.
>
> Authoritative now: `README.md` for what works and what is planned, `AGENTS.md` for the
> live API and page lists (both generated from source and gated in CI), and
> `docs/lesson-review.html` for the lesson content.
>
> Live 2026-08-16: five bands; Look up (`/tutor`); Saheeh International; 424 lessons; FSRS-6; Access JWT. See `AGENTS.md` Architecture.



## Overview
Interactive sentence parsing, verb conjugation tables, balagha (rhetoric) examples with analysis, and real-time grammar checking. The advanced grammar component that goes beyond the basic lessons in Module 3.

## Dependencies
- **Module 0**: D1 database, worker routes, auth working
- **Module 1**: Grammar lessons seeded in database, vocabulary data available
- **Module 3**: Learning engine working (basic grammar delivered)

## What This Module Delivers
- Interactive sentence parser that breaks down Arabic sentences into components
- Complete verb conjugation tables for all forms (past, present, imperative, passive)
- Balagha (rhetoric) examples with detailed analysis
- Real-time grammar checking for user input
- Grammar mastery tracking by category
- Practice exercises specific to advanced grammar concepts

## Architecture

### Grammar Deep-Dive Flow

```
User selects grammar deep-dive
        ↓
  Choose focus area: Nahw / Sarf / Balagha
        ↓
┌─────────────────────────────────────────────────┐
│  Interactive Lesson                              │
│  - Parse example sentences                      │
│  - View conjugation tables                       │
│  - Analyze balagha examples                     │
│  - Practice with user input                     │
└─────────────────────────────────────────────────┘
        ↓
  Grammar checking: User types Arabic sentence
        ↓
  Parser analyzes structure and suggests corrections
        ↓
  Progress saved, mastery updated
```

## File Specifications

### `workers/src/routes/grammar.ts` — API Routes

```typescript
import { Hono } from 'hono';
import { Database } from '../lib/db';

const grammar = new Hono();

// Get grammar deep-dive content
grammar.get('/deepdive/:category', async (c) => {
  const { category } = c.req.param(); // 'nahw', 'sarf', 'balagha'
  const userId = c.get('userId');
  const db = new Database(c.env.DB);

  // Get user's mastery level for this category
  const mastery = await db.get(
    `SELECT mastery_level FROM grammar_mastery WHERE user_id = ? AND category = ?`,
    [userId, category]
  );

  // Get advanced lessons for this category
  const lessons = await db.query(
    `SELECT * FROM lessons WHERE module = 'grammar' AND level >= ? ORDER BY level ASC`,
    [mastery?.mastery_level || 1]
  );

  return c.json({ category, lessons, mastery });
});

// Parse a user's Arabic sentence
grammar.post('/parse', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);
  const body = await c.req.json();

  const { sentence } = body;

  // Basic Arabic sentence parser
  const parsed = parseArabicSentence(sentence);

  // Check for common grammar errors
  const errors = checkGrammarErrors(sentence, parsed);

  return c.json({
    parsed,
    errors,
    suggestions: errors.map(e => e.suggestion),
  });
});

// Submit grammar exercise
grammar.post('/exercise', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);
  const body = await c.req.json();

  const { exerciseId, answer, correct } = body;

  await db.run(
    `INSERT INTO grammar_exercises (user_id, exercise_id, answer, correct, answered_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [userId, exerciseId, answer, correct ? 1 : 0]
  );

  return c.json({ success: true, correct });
});

// Get grammar mastery by category
grammar.get('/mastery', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);

  const mastery = await db.query(
    `SELECT * FROM grammar_mastery WHERE user_id = ?`,
    [userId]
  );

  return c.json({ mastery });
});
```

### `workers/src/lib/grammar-parser.ts` — Arabic Sentence Parser

```typescript
export interface ParsedSentence {
  words: ParsedWord[];
  structure: string;
  subject?: ParsedWord;
  predicate?: ParsedWord;
  object?: ParsedWord;
}

export interface ParsedWord {
  text: string;
  type: 'noun' | 'verb' | 'particle' | 'pronoun' | 'adjective' | 'preposition';
  case?: 'nominative' | 'accusative' | 'genitive';
  gender?: 'masculine' | 'feminine';
  number?: 'singular' | 'dual' | 'plural';
  person?: 'first' | 'second' | 'third';
  tense?: 'past' | 'present' | 'imperative';
  definition?: string;
}

export interface GrammarError {
  type: string;
  position: number;
  word: string;
  message: string;
  suggestion: string;
}

// Basic Arabic sentence parser
function parseArabicSentence(sentence: string): ParsedSentence {
  const words = sentence.split(/\s+/);
  const parsed: ParsedWord[] = [];
  let subject: ParsedWord | undefined;
  let predicate: ParsedWord | undefined;
  let object: ParsedWord | undefined;

  words.forEach((word, index) => {
    const parsedWord = parseSingleWord(word, index);
    parsed.push(parsedWord);

    // Basic sentence structure detection
    if (parsedWord.type === 'verb') {
      predicate = parsedWord;
    } else if (parsedWord.type === 'noun' && !subject) {
      subject = parsedWord;
    } else if (parsedWord.type === 'noun' && subject && !object) {
      object = parsedWord;
    }
  });

  let structure = 'unknown';
  if (subject && predicate && object) {
    structure = 'VSO'; // Verb-Subject-Object (common in Arabic)
  } else if (subject && predicate) {
    structure = 'VS';
  } else if (subject) {
    structure = 'S...';
  }

  return { words: parsed, structure, subject, predicate, object };
}

// Parse a single Arabic word
function parseSingleWord(word: string, index: number): ParsedWord {
  // Simple heuristics for word type detection
  let type: ParsedWord['type'] = 'noun';
  let tense: ParsedWord['tense'] | undefined;

  // Check for verb patterns
  if (isVerb(word)) {
    type = 'verb';
    tense = detectTense(word);
  }
  // Check for particles
  else if (isParticle(word)) {
    type = 'particle';
  }
  // Check for pronouns
  else if (isPronoun(word)) {
    type = 'pronoun';
  }
  // Check for prepositions
  else if (isPreposition(word)) {
    type = 'preposition';
  }

  return {
    text: word,
    type,
    tense,
    definition: getWordDefinition(word),
  };
}

// Check if word is a verb (basic pattern matching)
function isVerb(word: string): boolean {
  const verbPatterns = [
    /^ك ت ب/,  // كتب
    /^ق ر أ/,  //قرأ
    /^ذ ه ب/,  //ذهب
    /^ج ل س/,  //جلس
    /^ك ان/,   //كان
    /^ي ك و ن/, //يكون
  ];

  return verbPatterns.some(pattern => pattern.test(word));
}

// Detect tense from verb
function detectTense(word: string): 'past' | 'present' | 'imperative' {
  if (word.startsWith('ي') || word.startsWith('أ')) return 'present';
  if (word.endsWith('ْ')) return 'imperative';
  return 'past';
}

// Check if word is a particle
function isParticle(word: string): boolean {
  const particles = ['إن', 'أن', 'كان', 'كانت', 'كانا', 'كانوا', 'كانت'];
  return particles.includes(word);
}

// Check if word is a pronoun
function isPronoun(word: string): boolean {
  const pronouns = ['هو', 'هي', 'هما', 'هم', 'هنّ', 'أنتَ', 'أنتِ', 'أنتم', 'أنتنّ', 'أنا', 'نحن'];
  return pronouns.includes(word);
}

// Check if word is a preposition
function isPreposition(word: string): boolean {
  const prepositions = ['في', 'من', 'إلى', 'على', 'عن', 'ب', 'لـ', 'كـ'];
  return prepositions.includes(word);
}

// Get basic definition for a word
function getWordDefinition(word: string): string | undefined {
  const definitions: Record<string, string> = {
    'كتب': 'he wrote',
    'قرأ': 'he read',
    'ذهب': 'he went',
    'جلس': 'he sat',
    'كان': 'he was',
    'يكون': 'he is/will be',
  };

  return definitions[word] || undefined;
}

// Check for common grammar errors
function checkGrammarErrors(sentence: string, parsed: ParsedSentence): GrammarError[] {
  const errors: GrammarError[] = [];

  // Check for missing subject in present tense sentences
  if (parsed.predicate?.tense === 'present' && !parsed.subject) {
    errors.push({
      type: 'missing_subject',
      position: 0,
      word: parsed.predicate.text,
      message: 'Present tense verb usually requires a subject',
      suggestion: 'Add a subject pronoun or noun',
    });
  }

  // Check for verb-noun agreement
  if (parsed.subject && parsed.predicate && parsed.predicate.type === 'verb') {
    // Basic gender agreement check
    if (parsed.subject.gender === 'feminine' && !parsed.predicate.text.endsWith('ت')) {
      errors.push({
        type: 'gender_agreement',
        position: parsed.predicate.text.length,
        word: parsed.predicate.text,
        message: 'Verb does not agree in gender with subject',
        suggestion: 'Add ت to the verb for feminine subject',
      });
    }
  }

  return errors;
}
```

### `app/components/grammar/DeepDiveView.tsx`

```typescript
'use client';

import { useState } from 'react';

interface DeepDiveViewProps {
  category: 'nahw' | 'sarf' | 'balagha';
}

export function DeepDiveView({ category }: DeepDiveViewProps) {
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [userInput, setUserInput] = useState('');
  const [parseResult, setParseResult] = useState<any>(null);

  const handleParse = async () => {
    const response = await fetch('/api/grammar/parse', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sentence: userInput }),
    });

    const result = await response.json();
    setParseResult(result);
  };

  const lessons = getLessonsForCategory(category);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">
        Grammar Deep-Dive: {category === 'nahw' ? 'Syntax (النحو)' : category === 'sarf' ? 'Morphology (الصرف)' : 'Rhetoric (البلاغة)'}
      </h1>

      {/* Lesson selection */}
      <div className="grid grid-cols-2 gap-4">
        {lessons.map(lesson => (
          <button
            key={lesson.id}
            onClick={() => setSelectedLesson(lesson)}
            className={`p-4 rounded-lg text-left transition-colors ${
              selectedLesson?.id === lesson.id
                ? 'bg-arabic-green/20 border border-arabic-green'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <h3 className="font-semibold mb-1">{lesson.title}</h3>
            <p className="text-sm text-gray-400">Level {lesson.level} • {lesson.estimated_minutes} min</p>
          </button>
        ))}
      </div>

      {/* Lesson content */}
      {selectedLesson && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">{selectedLesson.title}</h2>

          <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: selectedLesson.content.explanation }} />

          {/* Conjugation table for sarf */}
          {selectedLesson.content.conjugation_table && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="p-2 text-left">Form</th>
                    <th className="p-2 text-right" dir="rtl">Arabic</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(selectedLesson.content.conjugation_table.forms).map(([form, arabic]) => (
                    <tr key={form} className="border-b border-gray-700">
                      <td className="p-2">{form}</td>
                      <td className="p-2 text-right" dir="rtl">{arabic}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Practice section */}
          <div className="mt-6 p-4 bg-gray-700 rounded-lg">
            <h3 className="font-semibold mb-2">Practice: Parse a Sentence</h3>
            <input
              type="text"
              dir="rtl"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type an Arabic sentence..."
              className="w-full p-3 bg-gray-600 rounded-lg border border-gray-500 text-white dir-rtl"
            />
            <button
              onClick={handleParse}
              disabled={!userInput}
              className="mt-3 px-6 py-2 bg-arabic-green text-white rounded-lg disabled:opacity-50"
            >
              Parse Sentence
            </button>

            {/* Parse results */}
            {parseResult && (
              <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                <h4 className="font-semibold mb-2">Parsed Structure:</h4>
                <div className="text-sm space-y-1">
                  <div>Structure: {parseResult.parsed.structure}</div>
                  {parseResult.parsed.subject && (
                    <div>Subject: {parseResult.parsed.subject.text} ({parseResult.parsed.subject.type})</div>
                  )}
                  {parseResult.parsed.predicate && (
                    <div>Predicate: {parseResult.parsed.predicate.text} ({parseResult.parsed.predicate.tense})</div>
                  )}
                  {parseResult.parsed.object && (
                    <div>Object: {parseResult.parsed.object.text}</div>
                  )}
                </div>

                {parseResult.errors.length > 0 && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500 rounded-lg">
                    <h5 className="font-semibold text-red-400 mb-2">Grammar Issues Found:</h5>
                    {parseResult.errors.map((error: any, i: number) => (
                      <div key={i} className="text-sm text-red-300">
                        • {error.message} — Suggestion: {error.suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getLessonsForCategory(category: string) {
  // Return lessons from the seeded database
  return [
    { id: 'grammar-01', title: 'Articles and Nouns', level: 1, estimated_minutes: 20, content: { explanation: '...' } },
    { id: 'grammar-02', title: 'Verb Conjugation', level: 1, estimated_minutes: 25, content: { explanation: '...' } },
    // ... more lessons
  ];
}
```

## Setup Commands

```bash
# No additional setup needed — uses lessons from Module 1
# Grammar parser is client-side logic, no server dependencies
```

## Verification Checklist
- [ ] `/api/grammar/deepdive/:category` returns lessons for the category
- [ ] Sentence parser correctly identifies word types (noun, verb, particle)
- [ ] Conjugation tables render correctly in frontend
- [ ] Grammar errors are detected for common cases (gender agreement, missing subject)
- [ ] Practice exercises can be submitted and tracked
- [ ] Mastery tracking updates correctly
- [ ] Frontend deep-dive view renders all sections
- [ ] Parse results display structure, subject, predicate, object
- [ ] Grammar errors show with suggestions

## What's NOT in This Module
- AI tutor chat interface (Module 8)
- Memorization tracking (Module 4)
- Progress dashboard (Module 5)
- Tajweed visualization (Module 6)

## Next Module
**Module 8: AI Tutor & Advanced Features** — Chat-based grammar explanations, personalized feedback on recordings, adaptive question generation, and advanced memorization tools.
