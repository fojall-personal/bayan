import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';

import { schedule, gradeFromAccuracy, isGrade, GRADE_VALUES } from '../lib/space-repetition';
import { parseAyahRange } from '../lib/memorization-input';
import type { MemorizationRow, MemorizationUnitsRow } from '../db/schema';

export const memorizationRoutes = new Hono<AppEnv>();

// GET /api/memorization/surah/:surahId — Get surah progress
memorizationRoutes.get('/surah/:surahId', async (c) => {
  const { surahId } = c.req.param();
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const entries = await db.query<MemorizationRow>(
      `SELECT * FROM memorization WHERE user_id = ? AND surah_id = ? ORDER BY ayah_from ASC`,
      [userId, surahId]
    );

    return c.json({ data: entries });
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
    const existing = await db.get<MemorizationRow>(
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
      data: {
        success: true,
        entry: { surahId, ayahFrom, ayahTo, status: 'learning' },
      },
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
  const { grade } = await c.req.json();

  // Four named grades rather than a 1–5 number. FSRS grades on exactly four values,
  // and a numeric scale with five points would have to collapse two of them onto the
  // same schedule — a scale where two answers do the same thing is a lie to the
  // learner. Rejected loudly rather than defaulted, because silently treating an
  // unknown grade as "good" would corrupt the schedule invisibly.
  if (!isGrade(grade)) {
    return c.json({ error: `grade must be one of ${GRADE_VALUES.join(', ')}` }, 400);
  }

  try {
    const entry = await db.get<MemorizationRow>(
      `SELECT * FROM memorization WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (!entry) {
      return c.json({ error: 'Entry not found' }, 404);
    }

    const result = schedule(
      {
        stability: entry.stability,
        difficulty: entry.difficulty,
        last_review: entry.last_review,
        fsrs_state: entry.fsrs_state,
        // Seeds stability when this row has never had an FSRS review, so an ayah
        // already held for months does not drop back to day one.
        interval: entry.interval,
        reviews: entry.revision_count,
      },
      grade
    );

    await db.run(
      `UPDATE memorization SET
         last_reviewed = datetime('now'),
         next_review = ?,
         revision_count = revision_count + 1,
         status = ?,
         interval = ?,
         stability = ?,
         difficulty = ?,
         fsrs_state = ?,
         last_review = ?
       WHERE id = ? AND user_id = ?`,
      [
        result.nextReview,
        result.status,
        result.interval,
        result.stability,
        result.difficulty,
        result.fsrsState,
        result.lastReview,
        id,
        userId,
      ]
    );

    return c.json({
      data: {
        success: true,
        nextReview: result.nextReview,
        status: result.status,
        interval: result.interval,
      },
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
    const entry = await db.get<MemorizationRow>(
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

    // Grade from what this attempt actually showed.
    //
    // This used to be `isCorrect ? 5 : Math.max(1, quality - 2)` — the new grade
    // computed from the PREVIOUS grade, which says nothing about how this attempt
    // went. Two learners reciting identically got different schedules because one had
    // been doing better beforehand. It is a binary check (did you name the next
    // ayah), so it maps to the two unambiguous grades and leaves the middle two to
    // surfaces that can actually measure partial recall.
    const grade = isCorrect ? 'good' : 'again';

    const result = schedule(
      {
        stability: entry.stability,
        difficulty: entry.difficulty,
        last_review: entry.last_review,
        fsrs_state: entry.fsrs_state,
        interval: entry.interval,
        reviews: entry.revision_count,
      },
      grade
    );

    await db.run(
      `UPDATE memorization SET
         next_review = ?,
         last_reviewed = datetime('now'),
         revision_count = revision_count + 1,
         status = ?,
         interval = ?,
         stability = ?,
         difficulty = ?,
         fsrs_state = ?,
         last_review = ?
       WHERE id = ? AND user_id = ?`,
      [
        result.nextReview,
        result.status,
        result.interval,
        result.stability,
        result.difficulty,
        result.fsrsState,
        result.lastReview,
        id,
        userId,
      ]
    );

    return c.json({
      data: {
        success: true,
        correct: isCorrect,
        nextAyah,
        grade,
        nextReview: result.nextReview,
        interval: result.interval,
      },
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
    const due = await db.query<
      MemorizationRow & { ayah_text: string | null; text_simple: string | null }
    >(
      `SELECT m.*,
              q.text_uthmani AS ayah_text,
              q.text_simple  AS text_simple
       FROM memorization m
       LEFT JOIN quran_verses q ON m.surah_id = q.surah AND m.ayah_to = q.ayah
       WHERE m.user_id = ? AND m.next_review <= datetime('now')
       ORDER BY m.next_review ASC`,
      [userId]
    );

    return c.json({ data: due });
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
    const surahs = await db.query<Pick<MemorizationRow, 'surah_id'> & { mastered: number; learning: number; reviewing: number; new_ayahs: number }>(
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

    return c.json({ data: surahs });
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
    const rows = await db.query<Pick<MemorizationUnitsRow, 'id' | 'sequence' | 'level' | 'surah_id' | 'ayah_from' | 'ayah_to' | 'ayah_count' | 'surah_name' | 'rationale'> & { tracked_status: string | null }>(
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
