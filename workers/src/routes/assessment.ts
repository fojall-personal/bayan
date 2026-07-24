import { Hono } from 'hono';
import type { Database } from '../lib/db';

export const assessmentRoutes = new Hono<{ Bindings: { DB: Database } }>();

// GET /api/assessment/start — Get assessment questions
assessmentRoutes.get('/start', async (c) => {
  // Placeholder — will be populated in Module 2
  return c.json({
    data: {
      modules: ['literacy', 'comprehension', 'grammar', 'memorization'],
      total_questions: 60,
      estimated_minutes: 30,
    },
  });
});

// POST /api/assessment/submit — Submit assessment answers
assessmentRoutes.post('/submit', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const answers = await c.req.json();

  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO assessment_results (id, user_id, completed_at, literacy_score, comprehension_score, grammar_score, memorization_score, level, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        now,
        answers.literacy_score || 0,
        answers.comprehension_score || 0,
        answers.grammar_score || 0,
        answers.memorization_score || 0,
        answers.level || 'beginner',
        JSON.stringify(answers.details || {}),
      ]
    );

    return c.json({ data: { id, level: answers.level || 'beginner' } });
  } catch (error) {
    console.error('Assessment submit error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/assessment/results — Get latest assessment results
assessmentRoutes.get('/results', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  try {
    const result = await db.get<Record<string, unknown>>(
      `SELECT * FROM assessment_results WHERE user_id = ? ORDER BY completed_at DESC LIMIT 1`,
      [userId]
    );

    if (!result) {
      return c.json({ data: null });
    }

    return c.json({
      data: {
        ...result,
        details: JSON.parse((result.details as string) || '{}'),
      },
    });
  } catch (error) {
    console.error('Assessment results error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
