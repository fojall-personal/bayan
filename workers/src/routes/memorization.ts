import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';

import { applySM2 } from '../lib/space-repetition';
import type { MemorizationStatus } from '../lib/space-repetition';

export const memorizationRoutes = new Hono<AppEnv>();

// GET /api/memorization/surah/:surahId — Get surah progress
memorizationRoutes.get('/surah/:surahId', async (c) => {
  const { surahId } = c.req.param();
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const entries = await db.query<Record<string, unknown>>(
      `SELECT * FROM memorization WHERE user_id = ? AND surah_id = ? ORDER BY ayah_from ASC`,
      [userId, surahId]
    );

    return c.json({ surahId, entries });
  } catch (error) {
    console.error('Memorization surah error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/memorization/all — Get all memorization entries for user
memorizationRoutes.get('/all', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const all = await db.query<Record<string, unknown>>(
      `SELECT surah_id, status, COUNT(*) as ayah_count FROM memorization
       WHERE user_id = ? GROUP BY surah_id, status`,
      [userId]
    );

    return c.json({ entries: all });
  } catch (error) {
    console.error('Memorization all error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/memorization/add — Add a new memorization entry
memorizationRoutes.post('/add', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  const { surahId, ayahFrom, ayahTo } = await c.req.json();

  try {
    // Check if entry already exists
    const existing = await db.get<Record<string, unknown>>(
      `SELECT * FROM memorization WHERE user_id = ? AND surah_id = ? AND ayah_from = ? AND ayah_to = ?`,
      [userId, surahId, ayahFrom, ayahTo]
    );

    if (existing) {
      return c.json({ error: 'Entry already exists' }, 409);
    }

    await db.run(
      `INSERT INTO memorization (id, user_id, surah_id, ayah_from, ayah_to, status, next_review, quality, interval, ease_factor, revision_count)
       VALUES (?, ?, ?, ?, ?, 'learning', datetime('now', '+1 day'), 0, 0, 2.5, 0)`,
      [crypto.randomUUID(), userId, surahId, ayahFrom, ayahTo]
    );

    return c.json({
      success: true,
      entry: { surahId, ayahFrom, ayahTo, status: 'learning' },
    });
  } catch (error) {
    console.error('Memorization add error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/memorization/:id/review — Review a memorization entry (SM-2)
memorizationRoutes.post('/:id/review', async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId');
  const db = getDb(c);
  const { quality } = await c.req.json();

  try {
    const entry = await db.get<Record<string, unknown>>(
      `SELECT * FROM memorization WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (!entry) {
      return c.json({ error: 'Entry not found' }, 404);
    }

    // Apply SM-2 algorithm
    const sm2Entry = {
      id: entry.id as string,
      quality: (entry.quality as number) || 0,
      interval: (entry.interval as number) || 0,
      ease_factor: (entry.ease_factor as number) || 2.5,
      reviews_count: (entry.revision_count as number) || 0,
      status: (entry.status as MemorizationStatus) || 'learning',
      next_review: (entry.next_review as string) || '',
    };

    const result = applySM2(sm2Entry, quality);

    // Update entry
    await db.run(
      `UPDATE memorization SET
         quality = ?,
         last_reviewed = datetime('now'),
         next_review = ?,
         revision_count = revision_count + 1,
         status = ?,
         ease_factor = ?,
         interval = ?
       WHERE id = ? AND user_id = ?`,
      [
        quality,
        result.nextReview,
        result.status,
        result.easeFactor,
        result.interval,
        id,
        userId,
      ]
    );

    return c.json({
      success: true,
      nextReview: result.nextReview,
      status: result.status,
      interval: result.interval,
    });
  } catch (error) {
    console.error('Memorization review error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/memorization/:id/recall — Next-ayah recall exercise
memorizationRoutes.post('/:id/recall', async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId');
  const db = getDb(c);
  const { recalledAyah } = await c.req.json();

  try {
    const entry = await db.get<Record<string, unknown>>(
      `SELECT * FROM memorization WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (!entry) {
      return c.json({ error: 'Entry not found' }, 404);
    }

    // Get the next ayah in the surah
    const nextAyah = (entry.ayah_to as number) + 1;

    // Check if user's recall matches
    const isCorrect = recalledAyah === nextAyah;

    // Update review based on recall
    const newQuality = isCorrect ? 5 : Math.max(1, (entry.quality as number) - 2);
    const sm2Entry = {
      id: entry.id as string,
      quality: (entry.quality as number) || 0,
      interval: (entry.interval as number) || 0,
      ease_factor: (entry.ease_factor as number) || 2.5,
      reviews_count: (entry.revision_count as number) || 0,
      status: (entry.status as MemorizationStatus) || 'learning',
      next_review: (entry.next_review as string) || '',
    };

    const result = applySM2(sm2Entry, newQuality);

    await db.run(
      `UPDATE memorization SET
         next_review = ?,
         quality = ?,
         last_reviewed = datetime('now'),
         revision_count = revision_count + 1,
         status = ?
       WHERE id = ? AND user_id = ?`,
      [
        result.nextReview,
        newQuality,
        result.status,
        id,
        userId,
      ]
    );

    return c.json({
      success: true,
      correct: isCorrect,
      nextAyah,
      newQuality,
    });
  } catch (error) {
    console.error('Memorization recall error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/memorization/review/today — Get today's review targets
memorizationRoutes.get('/review/today', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const due = await db.query<Record<string, unknown>>(
      `SELECT m.*,
              q.verse_text as ayah_text,
              q.verse_simple as verse_simple
       FROM memorization m
       LEFT JOIN quran_verses q ON m.surah_id = q.surah AND m.ayah_to = q.ayah
       WHERE m.user_id = ? AND m.next_review <= datetime('now')
       ORDER BY m.next_review ASC`,
      [userId]
    );

    return c.json({ due });
  } catch (error) {
    console.error('Memorization today error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/memorization/surahs — Get all surahs with memorization status
memorizationRoutes.get('/surahs', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const surahs = await db.query<Record<string, unknown>>(
      `SELECT surah_id,
              SUM(CASE WHEN status = 'mastered' THEN 1 ELSE 0 END) as mastered,
              SUM(CASE WHEN status = 'learning' THEN 1 ELSE 0 END) as learning,
              SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) as reviewing,
              SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_ayahs
       FROM memorization
       WHERE user_id = ?
       GROUP BY surah_id
       ORDER BY surah_id ASC`,
      [userId]
    );

    return c.json({ surahs });
  } catch (error) {
    console.error('Memorization surahs error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
