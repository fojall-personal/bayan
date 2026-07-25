import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';

import { parseArabicSentence, checkGrammarErrors, VERB_CONJUGATIONS } from '../lib/grammar-parser';

export const grammarRoutes = new Hono<AppEnv>();

// GET /api/grammar/deepdive/:category — Get deep-dive content for nahw/sarf/balagha
grammarRoutes.get('/deepdive/:category', async (c) => {
  const { category } = c.req.param();
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const mastery = await db.get<Record<string, unknown>>(
      `SELECT * FROM grammar_mastery WHERE user_id = ? AND category = ?`,
      [userId, category]
    );

    const lessons = await db.query<Record<string, unknown>>(
      `SELECT * FROM lessons WHERE module = 'grammar' AND level >= ? ORDER BY level ASC`,
      [(mastery?.mastery_level as number) || 1]
    );

    return c.json({
      data: {
        category,
        lessons: lessons.map((l) => ({
          ...l,
          content: JSON.parse((l.content as string) || '{}'),
          exercises: JSON.parse((l.exercises as string) || '[]'),
        })),
        mastery: mastery
          ? {
              category: mastery.category,
              masteryLevel: mastery.mastery_level,
              totalAttempts: mastery.total_attempts,
              correctAttempts: mastery.correct_attempts,
            }
          : { category, masteryLevel: 1, totalAttempts: 0, correctAttempts: 0 },
      },
    });
  } catch (error) {
    console.error('Grammar deepdive error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/grammar/parse — Parse an Arabic sentence
grammarRoutes.post('/parse', async (c) => {
  const userId = c.get('userId');
  const { sentence } = await c.req.json();

  try {
    const parsed = parseArabicSentence(sentence);
    const errors = checkGrammarErrors(sentence, parsed);

    return c.json({
      data: {
        parsed,
        errors,
        suggestions: errors.map((e) => e.suggestion),
      },
    });
  } catch (error) {
    console.error('Grammar parse error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/grammar/conjugations — Get verb conjugation tables
grammarRoutes.get('/conjugations', async (c) => {
  return c.json({
    data: Object.entries(VERB_CONJUGATIONS).map(([root, forms]) => ({
      root,
      forms,
    })),
  });
});

// POST /api/grammar/exercise — Submit grammar exercise answer
grammarRoutes.post('/exercise', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  const { exerciseId, answer, correct } = await c.req.json();

  try {
    await db.run(
      `INSERT INTO grammar_exercises (id, user_id, exercise_id, answer, correct, answered_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [crypto.randomUUID(), userId, exerciseId, answer, correct ? 1 : 0]
    );

    // Update mastery
    const category = await db.get<Record<string, unknown>>(
      `SELECT module FROM lessons WHERE id = ?`,
      [exerciseId]
    );

    if (category) {
      await db.run(
        `INSERT INTO grammar_mastery (user_id, category, total_attempts, correct_attempts)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(user_id, category) DO UPDATE SET
           total_attempts = total_attempts + 1,
           correct_attempts = CASE WHEN ? = 1 THEN correct_attempts + 1 ELSE correct_attempts END,
           updated_at = datetime('now')`,
        [userId, category.module, correct ? 1 : 0, correct ? 1 : 0]
      );
    }

    return c.json({ data: { success: true, correct } });
  } catch (error) {
    console.error('Grammar exercise error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/grammar/mastery — Get grammar mastery by category
grammarRoutes.get('/mastery', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const mastery = await db.query<Record<string, unknown>>(
      `SELECT * FROM grammar_mastery WHERE user_id = ?`,
      [userId]
    );

    return c.json({
      data: mastery.map((m) => ({
        category: m.category,
        masteryLevel: m.mastery_level,
        totalAttempts: m.total_attempts,
        correctAttempts: m.correct_attempts,
        percentage: (m.total_attempts as number) > 0
          ? Math.round(((m.correct_attempts as number) / (m.total_attempts as number)) * 100)
          : 0,
      })),
    });
  } catch (error) {
    console.error('Grammar mastery error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
