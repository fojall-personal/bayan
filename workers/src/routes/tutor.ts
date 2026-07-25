import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';

export const tutorRoutes = new Hono<AppEnv>();

// POST /api/tutor/chat — Chat with AI tutor (context-aware)
tutorRoutes.post('/chat', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  const { message, conversationHistory } = await c.req.json();

  try {
    // Load user context for personalized responses
    const [user, assessment, recentLessons, memorizationDue] =
      await Promise.all([
        db.get<Record<string, unknown>>(
          `SELECT * FROM users WHERE id = ?`,
          [userId]
        ),
        db.get<Record<string, unknown>>(
          `SELECT * FROM assessment_results ORDER BY completed_at DESC LIMIT 1`,
          [userId]
        ),
        db.query<Record<string, unknown>>(
          `SELECT * FROM lesson_progress WHERE user_id = ? ORDER BY last_practiced DESC LIMIT 5`,
          [userId]
        ),
        db.query<Record<string, unknown>>(
          `SELECT surah_id, status FROM memorization
           WHERE user_id = ? AND next_review <= datetime('now')
           LIMIT 10`,
          [userId]
        ),
      ]);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Calculate weak areas from recent quiz attempts
    const errors = await db.query<Record<string, unknown>>(
      `SELECT lesson_id, module, questions_correct, questions_answered
       FROM quiz_attempts WHERE user_id = ? ORDER BY completed_at DESC LIMIT 20`,
      [userId]
    );

    const moduleErrors: Record<string, number> = {};
    errors.forEach((attempt) => {
      const rate = (attempt.questions_correct as number) /
        (attempt.questions_answered as number);
      moduleErrors[attempt.module as string] =
        (moduleErrors[attempt.module as string] || 0) + (1 - rate);
    });

    const weakAreas = Object.entries(moduleErrors)
      .sort((a, b) => b[1] - a[1])
      .map(([mod]) => mod)
      .slice(0, 3);

    // Generate contextual response
    const response = generateTutorResponse(message, {
      user,
      assessment,
      recentLessons: recentLessons.slice(0, 3),
      memorizationDue: memorizationDue || [],
      weakAreas,
      currentPath: user.current_path,
    });

    // Save conversation
    await db.run(
      `INSERT INTO tutor_conversations (id, user_id, user_message, assistant_message, created_at)
       VALUES (randomblob(16), ?, ?, ?, datetime('now'))`,
      [userId, message, response]
    );

    // Extract topics
    const topics = extractTopics(message);
    for (const topic of topics) {
      await db.run(
        `INSERT OR IGNORE INTO tutor_topic_history (id, user_id, topic, discussed_at)
         VALUES (randomblob(16), ?, ?, datetime('now'))`,
        [userId, topic]
      );
    }

    return c.json({ data: { response, topics } });
  } catch (error) {
    console.error('Tutor chat error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/tutor/suggested-exercises — Get exercise recommendations based on error patterns
tutorRoutes.get('/suggested-exercises', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const errors = await db.query<Record<string, unknown>>(
      `SELECT lesson_id, module, COUNT(*) as error_count
       FROM quiz_attempts
       WHERE user_id = ? AND questions_correct = 0
       GROUP BY lesson_id, module
       ORDER BY error_count DESC
       LIMIT 10`,
      [userId]
    );

    const strong = await db.query<Record<string, unknown>>(
      `SELECT lesson_id, module, COUNT(*) as correct_count
       FROM quiz_attempts
       WHERE user_id = ? AND questions_correct > 0
       GROUP BY lesson_id, module
       ORDER BY correct_count DESC
       LIMIT 5`,
      [userId]
    );

    const recommendations: any[] = [];

    // Focus on weak areas (70%)
    errors.slice(0, 3).forEach((err) => {
      recommendations.push({
        type: 'weak_area_focus',
        lessonId: err.lesson_id,
        module: err.module,
        priority: 'high',
        reason: `${err.error_count} errors in this area`,
      });
    });

    // Reinforce strong areas (20%)
    strong.slice(0, 2).forEach((s) => {
      recommendations.push({
        type: 'strong_area_reinforce',
        lessonId: s.lesson_id,
        module: s.module,
        priority: 'medium',
        reason: 'Strong performance in this area',
      });
    });

    return c.json({ data: { recommendations } });
  } catch (error) {
    console.error('Suggested exercises error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/tutor/feedback — Generate feedback on audio recording
tutorRoutes.post('/feedback', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  const { audioUrl, surahId, ayahFrom, ayahTo } = await c.req.json();

  try {
    // In production, this would compare audio recordings
    // For MVP, return a placeholder response
    return c.json({
      data: {
        feedback: `Review completed. Compare your recitation of Surah ${surahId}, Ayahs ${ayahFrom}-${ayahTo} with the official recitation. Focus on clear pronunciation of each letter's articulation point (makharij).`,
      },
    });
  } catch (error) {
    console.error('Feedback error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/tutor/history — Get conversation history
tutorRoutes.get('/history', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const history = await db.query<Record<string, unknown>>(
      `SELECT user_message, assistant_message, created_at
       FROM tutor_conversations
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    return c.json({
      data: history.map((h) => ({
        userMessage: h.user_message,
        assistantMessage: h.assistant_message,
        createdAt: h.created_at,
      })),
    });
  } catch (error) {
    console.error('Tutor history error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Generate contextual tutor response
function generateTutorResponse(message: string, context: any): string {
  const msg = message.toLowerCase();

  if (msg.includes('madd')) {
    return `Great question about Madd! Since you're working on ${context.weakAreas.includes('grammar') ? 'grammar' : 'memorization'}, let me explain this in context.\n\nThere are three main types:\n1. **Madd Tabi'i** — 2 counts, like قَالَ\n2. **Madd Wajib** — 4-5 counts, like السَّآمَّة\n3. **Madd Lazim** — 6 counts, like الْحَآئِرِينَ\n\nWould you like practice exercises on Madd?`;
  }

  if (msg.includes('grammar') || msg.includes('nahw') || msg.includes('سرف')) {
    return `Let's focus on grammar! Based on your recent attempts, you're doing well with basic nouns but could use more verb conjugation practice.\n\nTry this: هُوَ ___ الكِتَابَ\nOptions: أَكَلَ / كَتَبَ / قَرَأَ / ذَهَبَ\n\nThe answer is كَتَبَ (he wrote). You may be confusing verb patterns between Form I (فَعَلَ) and Form II (فَاعَلَ).`;
  }

  if (msg.includes('memoriz') || msg.includes('hifz') || msg.includes('حفظ')) {
    const dueCount = context.memorizationDue.length;
    return `You have ${dueCount} ayahs due for review today. Here's a tip: review them in order, then test yourself by reciting from memory without looking.\n\nFor better retention, try the audio testing feature — listen to the ayah and type what you hear. This strengthens recall without visual cues.`;
  }

  if (msg.includes('tajweed')) {
    return `Tajweed is essential for correct Quran recitation. Your current level suggests focusing on:\n\n• **Noon Saakin rules** — Idgham, Ikhfa, Izhar\n• **Madd types** — Tabi'i, Wajib, Lazim\n• **Qalqalah** — The bouncing sound of ق ط ب ج د\n\nWant me to generate practice exercises for a specific rule?`;
  }

  return `I understand you're asking about "${message}". Based on your learning path (${context.currentPath}) and recent activity, I'd suggest:\n\n1. Practice your weak areas first\n2. Review your memorization due today\n3. Try a grammar exercise to reinforce what you've learned\n\nWould you like me to generate practice questions on a specific topic?`;
}

// Extract topics from message
function extractTopics(message: string): string[] {
  const topics: string[] = [];
  const msg = message.toLowerCase();

  if (msg.includes('madd') || msg.includes('مَدّ')) topics.push('madd');
  if (msg.includes('noon') || msg.includes('نون')) topics.push('noon-saakin');
  if (msg.includes('grammar') || msg.includes('nahw') || msg.includes('نحو')) topics.push('grammar');
  if (msg.includes('memoriz') || msg.includes('hifz') || msg.includes('حفظ')) topics.push('memorization');
  if (msg.includes('tajweed') || msg.includes('تجويد')) topics.push('tajweed');
  if (msg.includes('conjugat') || msg.includes('سرف')) topics.push('conjugation');
  if (msg.includes('balagha') || msg.includes('بلاغه')) topics.push('balagha');

  return topics.length > 0 ? topics : ['general'];
}
