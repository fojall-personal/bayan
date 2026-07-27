import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';

import { calculateCompositeScore, assignLearningPath, generateAssessmentResult } from '../lib/scoring';
import type {
  AssessmentResultsRow,
} from '../db/schema';

export const assessmentRoutes = new Hono<AppEnv>();

// POST /api/assessment/submit — Submit assessment answers
assessmentRoutes.post('/submit', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  const { literacy_score, comprehension_score, grammar_score, memorization_score } =
    await c.req.json();

  try {
    // Scores arrive from the client, so clamp them. Previously any number was
    // stored verbatim, including negatives and values over 100.
    const clamp = (v: unknown) =>
      Math.max(0, Math.min(100, Number.isFinite(Number(v)) ? Number(v) : 0));

    const scores = {
      literacy: clamp(literacy_score),
      comprehension: clamp(comprehension_score),
      grammar: clamp(grammar_score),
      memorization: clamp(memorization_score),
    };

    const result = generateAssessmentResult(scores, userId);

    // Save to database
    await db.run(
      `INSERT INTO assessment_results (id, user_id, completed_at, literacy_score, comprehension_score, grammar_score, memorization_score, level, path, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.id,
        userId,
        result.completed_at,
        result.literacy_score,
        result.comprehension_score,
        result.grammar_score,
        result.memorization_score,
        result.level,
        result.path,
        JSON.stringify(result.details),
      ]
    );

    // Update user's learning path
    await db.run(
      `UPDATE users SET current_path = ?, onboarding_completed = 1, updated_at = datetime('now') WHERE id = ?`,
      [result.path, userId]
    );

    // Return the full stored row. The old response was a summary that the
    // results screen then tried to read as a full row, producing NaN% for the
    // composite and "Invalid Date" for the timestamp.
    return c.json({
      data: {
        id: result.id,
        user_id: userId,
        completed_at: result.completed_at,
        literacy_score: result.literacy_score,
        comprehension_score: result.comprehension_score,
        grammar_score: result.grammar_score,
        memorization_score: result.memorization_score,
        level: result.level,
        path: result.path,
        composite_score: result.composite_score,
        details: result.details,
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
    const result = await db.get<AssessmentResultsRow>(
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
