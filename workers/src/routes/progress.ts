import { Hono } from 'hono';
import type { Database } from '../lib/db';

export const progressRoutes = new Hono<{ Bindings: { DB: Database } }>();

// GET /api/progress/summary — Get user progress summary
progressRoutes.get('/summary', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  try {
    // Count total lessons
    const totalLessons = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM lessons`
    );

    // Count completed lessons
    const completedLessons = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM lesson_progress WHERE completed = 1`
    );

    // Count memorization entries
    const memorizedEntries = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM memorization WHERE user_id = ?`,
      [userId]
    );

    // Count mastered entries
    const masteredEntries = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM memorization WHERE user_id = ? AND status = 'mastered'`,
      [userId]
    );

    // Get latest assessment
    const latestAssessment = await db.get<Record<string, unknown>>(
      `SELECT * FROM assessment_results WHERE user_id = ? ORDER BY completed_at DESC LIMIT 1`,
      [userId]
    );

    return c.json({
      data: {
        total_lessons: totalLessons[0]?.count || 0,
        completed_lessons: completedLessons[0]?.count || 0,
        memorized_entries: memorizedEntries[0]?.count || 0,
        mastered_entries: masteredEntries[0]?.count || 0,
        latest_assessment: latestAssessment || null,
      },
    });
  } catch (error) {
    console.error('Progress summary error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/progress/lesson/:id — Get lesson progress details
progressRoutes.get('/lesson/:id', async (c) => {
  const userId = c.get('userId');
  const lessonId = c.req.param('id');
  const db = c.env.DB;

  try {
    const progress = await db.get<Record<string, unknown>>(
      `SELECT * FROM lesson_progress WHERE lesson_id = ?`,
      [lessonId]
    );

    if (!progress) {
      return c.json({ data: null });
    }

    // Get quiz attempts for this lesson
    const attempts = await db.query<Record<string, unknown>>(
      `SELECT * FROM quiz_attempts WHERE user_id = ? AND lesson_id = ? ORDER BY completed_at DESC LIMIT 5`,
      [userId, lessonId]
    );

    return c.json({
      data: {
        completed: (progress.completed as number) === 1,
        score: progress.score,
        attempts: progress.attempts,
        streak: progress.streak,
        last_practiced: progress.last_practiced,
        quiz_attempts: attempts,
      },
    });
  } catch (error) {
    console.error('Progress lesson error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/progress/review — Get items due for review (spaced repetition)
progressRoutes.get('/review', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const now = new Date().toISOString();

  try {
    const dueItems = await db.query<Record<string, unknown>>(
      `SELECT * FROM spaced_repetition WHERE user_id = ? AND due_date <= ? ORDER BY due_date ASC`,
      [userId, now]
    );

    return c.json({
      data: dueItems,
    });
  } catch (error) {
    console.error('Progress review error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
