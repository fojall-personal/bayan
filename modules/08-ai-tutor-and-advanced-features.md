# Module 8 — AI Tutor & Advanced Features

> **Pre-implementation design spec.** Written before the code, and kept for its
> reasoning rather than as a description of the app. Where it disagrees with the app,
> the app is right.
>
> Authoritative now: `README.md` for what works and what is planned, `AGENTS.md` for the
> live API and page lists (both generated from source and gated in CI), and
> `docs/lesson-review.html` for the lesson content.
>
> Known to describe things that did not ship:
> - audio recording of your own recitation — never built; no microphone capture exists
> - a model-backed tutor — the tutor answers from corpus lookups and makes no model call


## Overview
Chat-based grammar explanations, personalized feedback on recordings, adaptive question generation, and advanced memorization tools including audio-based testing, cross-reference memorization, and certificate export.

## Dependencies
- **Module 0**: D1 database, worker routes, auth working
- **Module 1**: Content data seeded (lessons, vocabulary, assessment questions)
- **Module 2**: Assessment engine working (placement scores available)
- **Module 3**: Learning engine working (lesson progress tracked)
- **Module 4**: Memorization tracking working (spaced repetition active)
- **Module 5**: Progress dashboard working (metrics available)
- **Module 6**: Tajweed visualization working (rule data available)
- **Module 7**: Grammar deep-dive working (parsing + conjugation available)

## What This Module Delivers
- **AI Tutor chat** — Grammar explanations in natural language, context-aware (knows user's level, weak areas, recent progress)
- **Personalized feedback** — Analyzes user's audio recordings and provides targeted correction suggestions
- **Adaptive question generation** — Generates practice questions based on user's error patterns and weak areas
- **Audio-based memorization testing** — No text visible, user must recall purely from audio
- **Cross-reference memorization** — Links related themes across surahs for deeper retention
- **Certificate export** — Generate PDF certificates for memorization milestones
- **Advanced analytics** — Detailed breakdowns of learning patterns, time-on-task, error clustering

## Architecture

### AI Tutor Flow

```
User opens AI Tutor chat
        ↓
  System loads user context:
  - Current level & learning path
  - Recent lesson progress
  - Weak areas (from assessment)
  - Memorization status
  - Recent errors (from grammar exercises)
        ↓
┌─────────────────────────────────────────────────┐
│  User types: "Explain madd types"               │
│                                                   │
│  AI response (context-aware):                    │
│  "Since you're working on Surah Al-Fatiha,       │
│   let me show you the madd examples from there.  │
│   You've been struggling with madd necessary...  │
│   Here's a focused exercise:"                    │
│                                                   │
│  [Generated exercise based on user's weak areas] │
└─────────────────────────────────────────────────┘
```

### Adaptive Question Generation Flow

```
User completes exercises
        ↓
  System tracks error patterns:
  - Which rules they get wrong most often
  - Time taken per question type
  - Topics they avoid
        ↓
┌─────────────────────────────────────────────────┐
│  Next exercise selection:                         │
│  1. Focus on weak areas (70% of questions)       │
│  2. Reinforce strong areas (20%)                 │
│  3. Introduce new material (10%)                 │
└─────────────────────────────────────────────────┘
```

## File Specifications

### `workers/src/routes/tutor.ts` — AI Tutor API

```typescript
import { Hono } from 'hono';
import { Database } from '../lib/db';

const tutor = new Hono();

// Chat with AI tutor
tutor.post('/chat', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);
  const body = await c.req.json();

  const { message, conversationHistory } = body;

  // Load user context for personalized responses
  const context = await loadTutorContext(db, userId);

  // Generate response using system prompt + context
  const response = await generateTutorResponse(message, context, conversationHistory);

  // Save conversation to history
  await db.run(
    `INSERT INTO tutor_conversations (user_id, user_message, assistant_message, created_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [userId, message, response]
  );

  // Track which topics were discussed
  const topics = extractTopics(message);
  for (const topic of topics) {
    await db.run(
      `INSERT OR IGNORE INTO tutor_topic_history (user_id, topic, discussed_at)
       VALUES (?, ?, datetime('now'))`,
      [userId, topic]
    );
  }

  return c.json({ response, topics });
});

// Get suggested exercises based on error patterns
tutor.get('/suggested-exercises', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);

  // Get user's error patterns
  const errors = await db.query(
    `SELECT exercise_id, lesson_id, module, COUNT(*) as error_count
     FROM quiz_attempts
     WHERE user_id = ? AND questions_correct = 0
     GROUP BY lesson_id, module
     ORDER BY error_count DESC
     LIMIT 10`,
    [userId]
  );

  // Get user's strong areas
  const strong = await db.query(
    `SELECT lesson_id, module, COUNT(*) as correct_count
     FROM quiz_attempts
     WHERE user_id = ? AND questions_correct > 0
     GROUP BY lesson_id, module
     ORDER BY correct_count DESC
     LIMIT 5`,
    [userId]
  );

  // Generate adaptive exercise recommendations
  const recommendations = generateRecommendations(errors, strong, userId);

  return c.json({ recommendations });
});

// Generate personalized feedback on a recording
tutor.post('/feedback', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);
  const body = await c.req.json();

  const { audioUrl, surahId, ayahFrom, ayahTo, transcript } = body;

  // Load the correct recitation for comparison
  const correctAudio = await getCorrectAudio(surahId, ayahFrom, ayahTo);

  // Generate feedback based on audio comparison
  const feedback = await generateAudioFeedback(transcript, correctAudio, userId);

  return c.json({ feedback });
});

// Load user context for tutor responses
async function loadTutorContext(db: Database, userId: string) {
  const [user, assessment, recentLessons, memorization, errors] = await Promise.all([
    db.get(`SELECT * FROM users WHERE id = ?`, [userId]),
    db.get(`SELECT * FROM assessment_results ORDER BY completed_at DESC LIMIT 1`, [userId]),
    db.query(`SELECT * FROM lesson_progress WHERE user_id = ? ORDER BY last_practiced DESC LIMIT 5`, [userId]),
    db.query(`SELECT surah_id, status, next_review FROM memorization WHERE user_id = ? AND next_review <= datetime('now') LIMIT 10`, [userId]),
    db.query(`SELECT lesson_id, module, questions_correct, questions_answered FROM quiz_attempts WHERE user_id = ? ORDER BY completed_at DESC LIMIT 20`, [userId]),
  ]);

  // Calculate error rate per module
  const moduleErrors: Record<string, number> = {};
  errors.forEach((attempt: any) => {
    const rate = attempt.questions_correct / attempt.questions_answered;
    moduleErrors[attempt.module] = (moduleErrors[attempt.module] || 0) + (1 - rate);
  });

  // Identify weakest areas
  const weakAreas = Object.entries(moduleErrors)
    .sort((a, b) => b[1] - a[1])
    .map(([module]) => module);

  return {
    user: user!,
    assessment: assessment!,
    recentLessons: recentLessons.slice(0, 3),
    memorizationDue: memorization,
    weakAreas,
    currentPath: user!.current_path,
  };
}

// Generate tutor response (simplified — would use external AI API in production)
async function generateTutorResponse(message: string, context: any, history: any[]): Promise<string> {
  // System prompt with context
  const systemPrompt = `You are a helpful Arabic language tutor for the Language Builder app.
User's level: ${context.assessment?.level || 'beginner'}
Learning path: ${context.currentPath}
Weak areas: ${context.weakAreas.join(', ')}
Recently studied: ${context.recentLessons.map((l: any) => l.lesson_id).join(', ')}
Memorization due today: ${context.memorizationDue.length} ayahs`;

  // In production, this would call an external AI API (OpenAI, Claude, etc.)
  // For now, return a contextualized response based on the message
  if (message.toLowerCase().includes('madd')) {
    return `Great question about Madd! Since you're currently working on ${context.weakAreas.includes('grammar') ? 'grammar' : 'memorization'}, let me explain this in the context of your current learning.

There are three main types of Madd:
1. **Madd Tabi'i** (Natural) — 2 counts, like in قَالَ
2. **Madd Wajib** (Necessary) — 4-5 counts, like in السَّآمَّة
3. **Madd Lazim** (Forced) — 6 counts, like in الْحَآئِرِينَ

Would you like me to generate some practice exercises focusing on Madd? I can tailor them to your current level.`;
  }

  if (message.toLowerCase().includes('grammar') || message.toLowerCase().includes('nahw')) {
    return `Let's focus on grammar! Based on your recent quiz attempts, you're doing well with basic noun recognition but could use more practice with verb conjugation.

Here's a quick exercise:
Complete this sentence: هُوَ ___ الكِتَابَ (He ___ the book)
Options: أَكَلَ / كَتَبَ / قَرَأَ / ذَهَبَ

The correct answer is كَتَبَ (he wrote). You seem to be confusing verb patterns. Let me explain the difference between Form I (فَعَلَ) and Form II (فَاعَلَ) verbs...`;
  }

  return `I understand you're asking about "${message}". Let me check your recent progress to give you the most relevant answer...

Based on your learning path and recent activity, I'd suggest focusing on the areas where you've had the most difficulty. Would you like me to:
1. Generate practice questions on your weak areas?
2. Explain a specific concept in more detail?
3. Review your recent quiz results?`;
}

// Generate recommendations for next exercises
function generateRecommendations(errors: any[], strong: any[], userId: string): any[] {
  const recommendations: any[] = [];

  // Focus on weak areas (70%)
  errors.slice(0, 3).forEach((err: any) => {
    recommendations.push({
      type: 'weak_area_focus',
      lessonId: err.lesson_id,
      module: err.module,
      priority: 'high',
      reason: `${err.error_count} errors in this area`,
    });
  });

  // Reinforce strong areas (20%)
  strong.slice(0, 2).forEach((s: any) => {
    recommendations.push({
      type: 'strong_area_reinforce',
      lessonId: s.lesson_id,
      module: s.module,
      priority: 'medium',
      reason: `Strong performance in this area`,
    });
  });

  return recommendations;
}
```

### `app/components/tutor/TutorChat.tsx`

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  topics?: string[];
  timestamp: Date;
}

export function TutorChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/tutor/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        topics: data.topics,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto h-[600px] flex flex-col">
      <h1 className="text-2xl font-bold mb-4">AI Tutor</h1>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <p className="text-lg mb-2">Welcome to your AI Tutor!</p>
            <p className="text-sm">Ask me anything about Arabic grammar, Quran memorization, or tajweed.</p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {['Explain madd types', 'Help with grammar', 'Generate practice questions'].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-1 bg-gray-700 rounded-full text-sm hover:bg-gray-600"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(message => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-lg ${
                message.role === 'user'
                  ? 'bg-arabic-green text-white'
                  : 'bg-gray-700 text-gray-100'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.topics && message.topics.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {message.topics.map((topic: string) => (
                    <span key={topic} className="text-xs bg-gray-600 px-2 py-1 rounded">
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask me anything about Arabic..."
          className="flex-1 p-3 bg-gray-700 rounded-lg border border-gray-600 text-white"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-6 py-3 bg-arabic-green text-white rounded-lg disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

### `app/components/memorization/AdvancedTools.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';

export function AdvancedMemorizationTools() {
  const [audioTesting, setAudioTesting] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [score, setScore] = useState(0);
  const [crossRefResults, setCrossRefResults] = useState<any[]>([]);

  // Audio-based testing (no text visible)
  const startAudioTest = async () => {
    setAudioTesting(true);

    // Get a random memorization entry
    const response = await fetch('/api/memorization/review/today', {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
    });

    const data = await response.json();
    if (data.due.length > 0) {
      setCurrentQuestion(data.due[0]);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!currentQuestion) return;

    const response = await fetch(`/api/memorization/${currentQuestion.id}/recall`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
      body: JSON.stringify({ recalledAyah: answer }),
    });

    const result = await response.json();
    setScore(prev => prev + (result.correct ? 1 : 0));

    // Move to next question
    const nextDue = await fetch('/api/memorization/review/today', {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
    });
    const nextData = await nextDue.json();
    setCurrentQuestion(nextData.due[0] || null);
  };

  // Cross-reference memorization (find related themes across surahs)
  const getCrossReferences = async (surahId: number) => {
    const response = await fetch('/api/memorization/cross-reference', {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
      body: JSON.stringify({ surahId }),
      method: 'POST',
    });

    const data = await response.json();
    setCrossRefResults(data.references);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Advanced Memorization Tools</h1>

      {/* Audio-based testing */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Audio Testing (No Text)</h2>
        <p className="text-gray-400 mb-4">
          Test your memorization by recalling ayahs from audio only. No visual hints!
        </p>

        {!audioTesting && (
          <button
            onClick={startAudioTest}
            className="px-6 py-3 bg-arabic-green text-white rounded-lg"
          >
            Start Audio Test
          </button>
        )}

        {audioTesting && currentQuestion && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg mb-2">Listen carefully and type the next ayah:</p>
              <audio controls src={currentQuestion.audio_url} className="w-full" />
            </div>

            <input
              type="text"
              dir="rtl"
              placeholder="Type the next ayah..."
              className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 text-white dir-rtl"
              onKeyPress={(e) => e.key === 'Enter' && handleAnswer(e.target.value)}
            />

            <div className="flex justify-between text-sm text-gray-400">
              <span>Score: {score}</span>
              <button onClick={() => setAudioTesting(false)} className="text-red-400 hover:text-red-300">
                End Test
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cross-reference memorization */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Cross-Reference Memorization</h2>
        <p className="text-gray-400 mb-4">
          Find related themes and verses across different surahs to strengthen your memorization.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="number"
            placeholder="Surah number"
            className="flex-1 p-2 bg-gray-700 rounded-lg border border-gray-600"
            min="1"
            max="114"
          />
          <button
            onClick={() => getCrossReferences(1)}
            className="px-4 py-2 bg-arabic-green text-white rounded-lg"
          >
            Find References
          </button>
        </div>

        {crossRefResults.length > 0 && (
          <div className="space-y-3">
            {crossRefResults.map((ref: any, i: number) => (
              <div key={i} className="p-3 bg-gray-700 rounded-lg">
                <div className="flex justify-between mb-1">
                  <span className="font-semibold">Surah {ref.surah}, Ayah {ref.ayah}</span>
                  <span className="text-sm text-gray-400">{ref.theme}</span>
                </div>
                <p className="text-sm text-gray-300" dir="rtl">{ref.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Certificate export */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Memorization Certificate</h2>
        <p className="text-gray-400 mb-4">
          Generate a certificate for your memorization milestones.
        </p>

        <button
          onClick={() => window.location.href = '/api/memorization/certificate'}
          className="px-6 py-3 bg-arabic-green text-white rounded-lg"
        >
          Generate Certificate
        </button>
      </div>
    </div>
  );
}
```

### `workers/src/routes/certificate.ts` — Certificate Export

```typescript
// Generate PDF certificate for memorization milestones
import { Hono } from 'hono';
import { Database } from '../lib/db';

const certificate = new Hono();

certificate.get('/export', async (c) => {
  const userId = c.get('userId');
  const db = new Database(c.env.DB);

  // Get user's memorization data
  const memorization = await db.query(
    `SELECT surah_id, COUNT(*) as ayah_count
     FROM memorization
     WHERE user_id = ? AND status = 'mastered'
     GROUP BY surah_id
     ORDER BY surah_id ASC`,
    [userId]
  );

  // Generate certificate data
  const certificate = {
    title: 'Quran Memorization Certificate',
    subtitle: 'Ithbat Al-Hifz',
    userName: 'Fouad Jallouli',
    date: new Date().toISOString().split('T')[0],
    surahs: memorization.map((m: any) => ({
      number: m.surah_id,
      ayahs: m.ayah_count,
    })),
    totalAyahs: memorization.reduce((sum: number, m: any) => sum + m.ayah_count, 0),
    totalSurahs: memorization.length,
  };

  // In production, generate PDF using a library like pdfkit or puppeteer
  // For now, return JSON data that can be rendered as HTML certificate
  return c.json({ certificate });
});
```

## Setup Commands

```bash
# No additional setup needed
# AI tutor would integrate with an external AI API (OpenAI, Claude, etc.)
# For MVP, use contextual responses based on user data
```

## Verification Checklist
- [ ] `/api/tutor/chat` returns contextual responses based on user data
- [ ] Conversation history is saved to database
- [ ] Topics are extracted and tracked
- [ ] `/api/tutor/suggested-exercises` returns recommendations based on errors
- [ ] Audio feedback endpoint works (would need actual audio comparison in production)
- [ ] Advanced memorization tools render correctly
- [ ] Audio testing flow works (no text, recall from audio only)
- [ ] Cross-reference memorization shows related themes
- [ ] Certificate export generates valid data
- [ ] Frontend chat interface handles messages correctly
- [ ] Loading states work properly

## What's NOT in This Module
- Multi-user authentication (single user only)
- Community features (not planned for single-user)
- Parental controls / teacher mode (not needed)
- Mobile app (web-only for now)

## Final Notes
This is the last module in the MVP. All core features are now complete:
1. ✅ Assessment engine (Module 2)
2. ✅ Learning engine (Module 3)
3. ✅ Memorization tracker (Module 4)
4. ✅ Progress dashboard (Module 5)
5. ✅ Tajweed visualization (Module 6)
6. ✅ Grammar deep-dive (Module 7)
7. ✅ AI tutor & advanced features (Module 8)

The app is ready for deployment to Cloudflare!
