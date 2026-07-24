import { Hono } from 'hono';
import type { Database } from '../lib/db';

export const memorizationRoutes = new Hono<{ Bindings: { DB: Database } }>();

// GET /api/memorization/surahs — List all surahs with memorization status
memorizationRoutes.get('/surahs', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  try {
    const entries = await db.query<Record<string, unknown>>(
      `SELECT * FROM memorization WHERE user_id = ? ORDER BY surah_id, ayah_from`,
      [userId]
    );

    return c.json({
      data: entries.map((e) => ({
        ...e,
        status: e.status as string,
      })),
    });
  } catch (error) {
    console.error('Memorization surahs error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/memorization/record — Record a memorization entry
memorizationRoutes.post('/record', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const { surah_id, ayah_from, ayah_to, status } = await c.req.json();

  try {
    await db.run(
      `INSERT INTO memorization (user_id, surah_id, ayah_from, ayah_to, status, next_review)
       VALUES (?, ?, ?, ?, ?, datetime('now', '+1 day'))
       ON CONFLICT(user_id, surah_id, ayah_from, ayah_to) DO UPDATE SET
         status = excluded.status,
         next_review = excluded.next_review`,
      [userId, surah_id, ayah_from, ayah_to, status || 'new']
    );

    return c.json({ data: { success: true } });
  } catch (error) {
    console.error('Memorization record error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/memorization/review — Submit a review for a memorization entry
memorizationRoutes.post('/review', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const { surah_id, ayah_from, ayah_to, quality } = await c.req.json();

  try {
    // Calculate next review date using simple spaced repetition
    const interval = Math.pow(2, quality - 1); // 1d, 2d, 4d, 8d, 16d
    const nextReview = new Date(
      Date.now() + interval * 24 * 60 * 60 * 1000
    ).toISOString();

    await db.run(
      `UPDATE memorization SET
         last_reviewed = datetime('now'),
         next_review = ?,
         quality = ?,
         revision_count = revision_count + 1,
         status = CASE
           WHEN quality >= 4 THEN 'mastered'
           WHEN quality >= 3 THEN 'reviewing'
           ELSE 'learning'
         END
       WHERE user_id = ? AND surah_id = ? AND ayah_from = ? AND ayah_to = ?`,
      [nextReview, quality, userId, surah_id, ayah_from, ayah_to]
    );

    return c.json({ data: { success: true, next_review: nextReview } });
  } catch (error) {
    console.error('Memorization review error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
