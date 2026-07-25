import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';

export const progressRoutes = new Hono<AppEnv>();

// GET /api/progress/dashboard — Complete dashboard data
progressRoutes.get('/dashboard', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    // Fetch all dashboard data
    const [user, latestAssessment, lessonProgress, dueMemorization, streak] =
      await Promise.all([
        db.get<Record<string, unknown>>(
          `SELECT * FROM users WHERE id = ?`,
          [userId]
        ),
        db.get<Record<string, unknown>>(
          `SELECT * FROM assessment_results WHERE user_id = ? ORDER BY completed_at DESC LIMIT 1`,
          [userId]
        ),
        db.query<Record<string, unknown>>(
          `SELECT * FROM lesson_progress WHERE user_id = ? ORDER BY last_practiced DESC LIMIT 10`,
          [userId]
        ),
        db.query<Record<string, unknown>>(
          `SELECT * FROM memorization WHERE user_id = ? AND next_review <= datetime('now')`,
          [userId]
        ),
        calculateStreak(db, userId),
      ]);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Calculate summary metrics
    const totalLessons = await db.get<Record<string, unknown>>(
      `SELECT COUNT(*) as count FROM lessons`
    );
    const completedLessons = await db.query<Record<string, unknown>>(
      `SELECT COUNT(*) as count FROM lesson_progress WHERE completed = 1 AND user_id = ?`,
      [userId]
    );
    const memorizedSurahs = await db.query<Record<string, unknown>>(
      `SELECT DISTINCT surah_id FROM memorization WHERE user_id = ? AND status = 'mastered'`,
      [userId]
    );
    const vocabularyReviewed = await db.get<Record<string, unknown>>(
      `SELECT COUNT(*) as count FROM vocabulary_mastery WHERE user_id = ? AND last_seen >= datetime('now', '-7 days')`,
      [userId]
    );

    const weeklyProgress = await getWeeklyProgress(db, userId);

    return c.json({
      data: {
        user: {
          id: user.id,
          goal: user.goal,
          onboarding_completed: (user.onboarding_completed as number) === 1,
          current_path: user.current_path,
          created_at: user.created_at,
        },
        latestAssessment: latestAssessment
          ? {
              ...latestAssessment,
              details: JSON.parse((latestAssessment.details as string) || '{}'),
            }
          : null,
        todayReview: dueMemorization || [],
        streak,
        stats: {
          totalLessons: (totalLessons?.count as number) || 0,
          completedLessons: (completedLessons?.[0]?.count as number) || 0,
          memorizedSurahs: (memorizedSurahs?.length as number) || 0,
          vocabularyReviewed: (vocabularyReviewed?.count as number) || 0,
        },
        weeklyProgress,
        lastLesson: lessonProgress?.[0] || null,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/progress/scores — Score history for charts
progressRoutes.get('/scores', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const history = await db.query<Record<string, unknown>>(
      `SELECT literacy_score, comprehension_score, grammar_score, memorization_score, completed_at
       FROM assessment_results
       WHERE user_id = ?
       ORDER BY completed_at ASC`,
      [userId]
    );

    return c.json({
      data: history.map((row) => ({
        literacy_score: row.literacy_score,
        comprehension_score: row.comprehension_score,
        grammar_score: row.grammar_score,
        memorization_score: row.memorization_score,
        completed_at: row.completed_at,
      })),
    });
  } catch (error) {
    console.error('Scores history error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Calculate streak
async function calculateStreak(db: Database, userId: string): Promise<number> {
  let streak = 0;
  let checkDate = new Date();

  // Check if user was active today
  const today = await db.get<Record<string, unknown>>(
    `SELECT COUNT(*) as count FROM lesson_progress WHERE user_id = ? AND DATE(last_practiced) = DATE('now')`,
    [userId]
  );

  if (!today || today.count === 0) {
    // Check yesterday
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Count consecutive days
  while (true) {
    const dayData = await db.get<Record<string, unknown>>(
      `SELECT COUNT(*) as count FROM lesson_progress
       WHERE user_id = ? AND DATE(last_practiced) = DATE(?, '-' || ? || ' days')`,
      [userId, new Date().toISOString(), streak]
    );

    if (!dayData || dayData.count === 0) break;
    streak++;
  }

  return streak;
}

// Get weekly progress
async function getWeeklyProgress(
  db: Database,
  userId: string
): Promise<{ lessonsCompleted: number; reviewsCompleted: number; targetLessons: number; targetReviews: number }> {
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const lessons = await db.query<Record<string, unknown>>(
    `SELECT lesson_id FROM lesson_progress
     WHERE user_id = ? AND last_practiced >= ?`,
    [userId, startOfWeek.toISOString()]
  );

  const reviews = await db.query<Record<string, unknown>>(
    `SELECT id FROM memorization
     WHERE user_id = ? AND last_reviewed >= ?`,
    [userId, startOfWeek.toISOString()]
  );

  return {
    lessonsCompleted: lessons.length,
    reviewsCompleted: reviews.length,
    targetLessons: 5,
    targetReviews: 10,
  };
}
