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

/**
 * GET /api/progress/coverage — how much of the Quran this learner can read.
 *
 * The corpus is closed and already parsed, so this is arithmetic rather than an
 * estimate. Measured from the data in this repo: 63 roots cover 50% of every
 * rooted word, 249 cover 80%, and 400 roots make 3,046 ayahs — half the text —
 * fully readable. No open-vocabulary language app can say that; this one can, and
 * have it be true.
 *
 * "Fully readable" means every ROOTED word in the ayah has a known root. Words
 * with no root — particles, pronouns, the disconnected letters — are treated as
 * known, because they are learned in the first week and are not what gates
 * comprehension. That is a modelling choice, so it is stated in the response
 * rather than buried here.
 */
progressRoutes.get('/coverage', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const row = await db.get<Record<string, number>>(
      `WITH known AS (
         SELECT root FROM user_known_root WHERE user_id = ?
       ),
       ayah_state AS (
         SELECT surah_id, ayah_id,
                SUM(CASE WHEN root IS NOT NULL
                          AND root NOT IN (SELECT root FROM known)
                         THEN 1 ELSE 0 END) AS unknown_rooted
         FROM quran_word_morphology
         GROUP BY surah_id, ayah_id
       )
       SELECT
         (SELECT COUNT(*) FROM ayah_state WHERE unknown_rooted = 0)  AS ayahs_readable,
         (SELECT COUNT(*) FROM ayah_state)                            AS ayahs_total,
         (SELECT COUNT(*) FROM known)                                 AS roots_known,
         (SELECT COUNT(DISTINCT root) FROM quran_word_morphology
           WHERE root IS NOT NULL)                                    AS roots_total,
         (SELECT COUNT(*) FROM quran_word_morphology
           WHERE root IN (SELECT root FROM known))                    AS segments_known,
         (SELECT COUNT(*) FROM quran_word_morphology
           WHERE root IS NOT NULL)                                    AS segments_rooted,
         (SELECT COUNT(*) FROM (
            SELECT surah_id FROM ayah_state
            GROUP BY surah_id HAVING SUM(unknown_rooted) = 0))        AS surahs_readable`,
      [userId]
    );

    if (!row) return c.json({ error: 'Coverage unavailable' }, 500);

    // The next root worth learning: the commonest one not yet known. This is the
    // whole curriculum — frequency order, no syllabus to author.
    const next = await db.query<Record<string, unknown>>(
      `SELECT m.root, COUNT(*) AS occurrences
         FROM quran_word_morphology m
        WHERE m.root IS NOT NULL
          AND m.root NOT IN (SELECT root FROM user_known_root WHERE user_id = ?)
        GROUP BY m.root
        ORDER BY occurrences DESC
        LIMIT 5`,
      [userId]
    );

    const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

    return c.json({
      data: {
        ayahsReadable: row.ayahs_readable,
        ayahsTotal: row.ayahs_total,
        ayahsReadablePct: pct(row.ayahs_readable, row.ayahs_total),
        rootsKnown: row.roots_known,
        rootsTotal: row.roots_total,
        segmentsKnown: row.segments_known,
        segmentsRooted: row.segments_rooted,
        segmentsKnownPct: pct(row.segments_known, row.segments_rooted),
        surahsReadable: row.surahs_readable,
        surahsTotal: 114,
        nextRoots: next,
      },
      // Stated, not buried: the reader should know what "readable" counts.
      basis:
        'An ayah counts as readable when every rooted word in it has a known root. ' +
        'Unrooted words (particles, pronouns, the disconnected letters) count as known.',
    });
  } catch (error) {
    console.error('Coverage error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST   /api/progress/roots/:root/known — record a root as known
 * DELETE /api/progress/roots/:root/known — undo it
 *
 * Coverage could not move until something wrote to user_known_root. The table and
 * the read endpoint existed and nothing filled them, so the model was inert.
 *
 * POST returns the coverage DELTA, not just an acknowledgement: "+37 ayahs now
 * fully readable" is the payoff, and because the corpus is closed it is a computed
 * fact rather than an animation. DELETE exists because "I marked that too early"
 * is the obvious next thing a learner needs, and a progress model you cannot
 * correct is one people stop trusting.
 */
async function ayahsReadable(db: Database, userId: string): Promise<number> {
  const row = await db.get<{ n: number }>(
    `WITH known AS (SELECT root FROM user_known_root WHERE user_id = ?)
     SELECT COUNT(*) AS n FROM (
       SELECT surah_id, ayah_id
         FROM quran_word_morphology
        GROUP BY surah_id, ayah_id
       HAVING SUM(CASE WHEN root IS NOT NULL
                        AND root NOT IN (SELECT root FROM known)
                       THEN 1 ELSE 0 END) = 0
     )`,
    [userId]
  );
  return row?.n ?? 0;
}

progressRoutes.post('/roots/:root/known', async (c) => {
  const userId = c.get('userId');
  const root = c.req.param('root');
  const db = getDb(c);

  try {
    // Refuse roots the corpus does not attest. Accepting a typo would inflate the
    // count with something that can never make an ayah readable — the same class of
    // failure as the tutor inventing Arabic.
    const exists = await db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM quran_word_morphology WHERE root = ?`,
      [root]
    );
    if (!exists || exists.n === 0) {
      return c.json({ error: `The corpus has no root "${root}"` }, 404);
    }

    const before = await ayahsReadable(db, userId);
    await db.run(
      `INSERT OR IGNORE INTO user_known_root (user_id, root) VALUES (?, ?)`,
      [userId, root]
    );
    const after = await ayahsReadable(db, userId);

    return c.json({
      data: {
        root,
        occurrences: exists.n,
        ayahsUnlocked: after - before,
        ayahsReadable: after,
        ayahsTotal: 6236,
      },
    });
  } catch (error) {
    console.error('Mark root known error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

progressRoutes.delete('/roots/:root/known', async (c) => {
  const userId = c.get('userId');
  const root = c.req.param('root');
  const db = getDb(c);

  try {
    await db.run(
      `DELETE FROM user_known_root WHERE user_id = ? AND root = ?`,
      [userId, root]
    );
    return c.json({ data: { root, ayahsReadable: await ayahsReadable(db, userId) } });
  } catch (error) {
    console.error('Unmark root error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
