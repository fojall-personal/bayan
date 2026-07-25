import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';

import { calculateCompositeScore, assignLearningPath, generateAssessmentResult } from '../lib/scoring';

export const assessmentRoutes = new Hono<AppEnv>();

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
  const db = getDb(c);
  const { literacy_score, comprehension_score, grammar_score, memorization_score } =
    await c.req.json();

  try {
    const scores = {
      literacy: literacy_score || 0,
      comprehension: comprehension_score || 0,
      grammar: grammar_score || 0,
      memorization: memorization_score || 0,
    };

    const result = generateAssessmentResult(scores, userId);

    // Save to database
    await db.run(
      `INSERT INTO assessment_results (id, user_id, completed_at, literacy_score, comprehension_score, grammar_score, memorization_score, level, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.id,
        userId,
        result.completed_at,
        result.literacy_score,
        result.comprehension_score,
        result.grammar_score,
        result.memorization_score,
        result.level,
        JSON.stringify(result.details),
      ]
    );

    // Update user's learning path
    await db.run(
      `UPDATE users SET current_path = ?, onboarding_completed = 1, updated_at = datetime('now') WHERE id = ?`,
      [result.path, userId]
    );

    return c.json({
      data: {
        id: result.id,
        level: result.level,
        path: result.path,
        composite_score: result.composite_score,
        weakest_area: result.details.weakest_area,
        strongest_area: result.details.strongest_area,
        path_description: result.details.paths[result.path].description,
      },
    });
  } catch (error) {
    console.error('Assessment submit error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/assessment/results — Get latest assessment results
assessmentRoutes.get('/results', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

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
