import { Hono } from 'hono';
import type { Database } from '../lib/db';

export const learningRoutes = new Hono<{ Bindings: { DB: Database } }>();

// GET /api/learning/lessons — Get all lessons (or filtered by module/level)
learningRoutes.get('/lessons', async (c) => {
  const db = c.env.DB;
  const { module: mod, level } = c.req.query();

  try {
    let sql = 'SELECT * FROM lessons';
    const params: unknown[] = [];

    if (mod) {
      sql += ' WHERE module = ?';
      params.push(mod);
    }
    if (level) {
      sql += level ? ' AND level = ?' : '';
      params.push(level);
    }

    const lessons = await db.query<Record<string, unknown>>(sql, params);

    return c.json({
      data: lessons.map((l) => ({
        ...l,
        content: JSON.parse((l.content as string) || '[]'),
        exercises: JSON.parse((l.exercises as string) || '[]'),
        prerequisites: JSON.parse((l.prerequisites as string) || '[]'),
      })),
    });
  } catch (error) {
    console.error('Learning lessons error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/learning/lessons/:id — Get single lesson with progress
learningRoutes.get('/lessons/:id', async (c) => {
  const userId = c.get('userId');
  const lessonId = c.req.param('id');
  const db = c.env.DB;

  try {
    const lesson = await db.get<Record<string, unknown>>(
      `SELECT * FROM lessons WHERE id = ?`,
      [lessonId]
    );

    if (!lesson) {
      return c.json({ error: 'Lesson not found' }, 404);
    }

    const progress = await db.get<Record<string, unknown>>(
      `SELECT * FROM lesson_progress WHERE lesson_id = ?`,
      [lessonId]
    );

    return c.json({
      data: {
        ...lesson,
        content: JSON.parse((lesson.content as string) || '[]'),
        exercises: JSON.parse((lesson.exercises as string) || '[]'),
        prerequisites: JSON.parse((lesson.prerequisites as string) || '[]'),
        progress: progress
          ? {
              completed: (progress.completed as number) === 1,
              score: progress.score,
              attempts: progress.attempts,
              streak: progress.streak,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Learning lesson detail error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/learning/lessons/:id/submit — Submit lesson answers
learningRoutes.post('/lessons/:id/submit', async (c) => {
  const userId = c.get('userId');
  const lessonId = c.req.param('id');
  const db = c.env.DB;
  const { answers, score } = await c.req.json();

  try {
    // Upsert lesson progress
    await db.run(
      `INSERT INTO lesson_progress (lesson_id, module, completed, score, attempts, last_practiced, streak)
       VALUES (?, ?, 0, ?, 1, datetime('now'), 1)
       ON CONFLICT(lesson_id) DO UPDATE SET
         score = ?,
         attempts = attempts + 1,
         last_practiced = datetime('now'),
         streak = CASE WHEN ? = 1 THEN streak + 1 ELSE 0 END`,
      [
        lessonId,
        'literacy', // placeholder — will be dynamic
        score || 0,
        score || 0,
        (score || 0) >= 70 ? 1 : 0,
      ]
    );

    // Log quiz attempt
    const id = crypto.randomUUID();
    const total = (answers as unknown[][])?.length || 0;
    const correct = Math.round(total * ((score || 0) / 100));

    await db.run(
      `INSERT INTO quiz_attempts (id, user_id, lesson_id, module, questions_answered, questions_correct, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, userId, lessonId, 'literacy', total, correct]
    );

    return c.json({
      data: { score: score || 0, correct, total },
    });
  } catch (error) {
    console.error('Learning submit error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
