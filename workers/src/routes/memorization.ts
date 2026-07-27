import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';

import { applySM2 } from '../lib/space-repetition';
import { parseAyahRange } from '../lib/memorization-input';
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

// POST /api/memorization/add — Add a new memorization entry
memorizationRoutes.post('/add', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Expected a JSON body' }, 400);
  }

  const parsed = parseAyahRange(body);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const { surahId, ayahFrom, ayahTo } = parsed.value;

  try {
    // Bound the ayah against the real length of this surah. Skipped when the
    // text has not been ingested, so a fresh deployment is still usable rather
    // than rejecting every entry.
    const lengthRow = await db.get<{ max_ayah: number | null }>(
      `SELECT MAX(ayah) AS max_ayah FROM quran_verses WHERE surah = ?`,
      [surahId]
    );
    const maxAyah = lengthRow?.max_ayah ?? null;
    if (maxAyah !== null && ayahTo > maxAyah) {
      return c.json(
        { error: `Surah ${surahId} has ${maxAyah} ayahs; ayahTo ${ayahTo} is out of range` },
        400
      );
    }

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
              q.text_uthmani AS ayah_text,
              q.text_simple  AS text_simple
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

// GET /api/memorization/curriculum?level=&limit=&offset=
//
// 908 ordered units derived from the pinned text. The tracker worked before this
// but a learner had to invent their own plan — pick a surah, pick a range, guess
// what was a sensible amount. Short surahs are whole units; longer ones are cut
// into reviewable groups, and each unit says why it sits where it does.
memorizationRoutes.get('/curriculum', async (c) => {
  const db = getDb(c);
  const userId = c.get('userId');
  const level = c.req.query('level');
  const limit = Math.min(Number(c.req.query('limit') ?? 25) || 25, 100);
  const offset = Math.max(Number(c.req.query('offset') ?? 0) || 0, 0);

  const where: string[] = [];
  const params: unknown[] = [];
  if (level) {
    const n = Number(level);
    if (!Number.isInteger(n) || n < 1 || n > 6) {
      return c.json({ error: 'level must be an integer 1–6' }, 400);
    }
    where.push('u.level = ?');
    params.push(n);
  }

  try {
    // LEFT JOIN so a unit the learner has already started is marked as such
    // rather than being offered again as if new.
    const rows = await db.query<Record<string, unknown>>(
      `SELECT u.id, u.sequence, u.level, u.surah_id, u.ayah_from, u.ayah_to,
              u.ayah_count, u.surah_name, u.rationale,
              m.status AS tracked_status
       FROM memorization_units u
       LEFT JOIN memorization m
         ON m.user_id = ? AND m.surah_id = u.surah_id
        AND m.ayah_from = u.ayah_from AND m.ayah_to = u.ayah_to
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY u.sequence ASC
       LIMIT ? OFFSET ?`,
      [userId, ...params, limit, offset]
    );

    const totalRow = await db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM memorization_units${level ? ' WHERE level = ?' : ''}`,
      level ? [Number(level)] : []
    );

    return c.json({
      data: rows.map((r) => ({
        id: r.id,
        sequence: r.sequence,
        level: r.level,
        surahId: r.surah_id,
        surahName: r.surah_name,
        ayahFrom: r.ayah_from,
        ayahTo: r.ayah_to,
        ayahCount: r.ayah_count,
        rationale: r.rationale,
        tracked: r.tracked_status !== null && r.tracked_status !== undefined,
        status: r.tracked_status ?? null,
      })),
      total: totalRow?.n ?? 0,
      attribution: { source: 'Tanzil Uthmani text', url: 'https://tanzil.net', licence: 'CC-BY' },
    });
  } catch (error) {
    console.error('Curriculum error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
