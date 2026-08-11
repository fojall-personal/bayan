import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';

import {
  schedule,
  gradeFromAccuracy,
  isGrade,
  GRADE_VALUES,
  REQUEST_RETENTION,
  TRACK_RETENTION,
  estimateReviewsPerDay,
  isWarmStart,
  type Grade,
  type FsrsState,
} from '../lib/space-repetition';
import { parseAyahRange } from '../lib/memorization-input';
import type { MemorizationRow, MemorizationUnitsRow } from '../db/schema';

export const memorizationRoutes = new Hono<AppEnv>();

/**
 * The caller's own hifz retention preference, or the unchanged default.
 *
 * NULL (the column's state for every learner who has never opted in) means
 * REQUEST_RETENTION — never TRACK_RETENTION.hifz automatically. That constant
 * is the SUGGESTED value a settings screen offers, not something applied
 * silently; an existing learner's schedule must not shift on its own.
 */
async function hifzRetentionFor(db: Database, userId: string): Promise<number> {
  const row = await db.get<{ hifz_retention: number | null }>(
    `SELECT hifz_retention FROM users WHERE id = ?`,
    [userId]
  );
  return row?.hifz_retention ?? REQUEST_RETENTION;
}

/**
 * Was this review chained off a span the learner just recited, rather than
 * recalled cold? Looks at the adjacent PRECEDING span (this entry's
 * ayah_from - 1 as someone else's ayah_to) and checks whether it was
 * reviewed within the warm-start window of now. No adjacent span, or that
 * span never reviewed, both mean false — chaining can't be claimed without
 * evidence of it.
 */
async function precedingSpanWarmStart(
  db: Database,
  userId: string,
  surahId: number,
  ayahFrom: number,
  now: Date
): Promise<boolean> {
  if (ayahFrom <= 1) return false;
  const preceding = await db.get<{ last_reviewed: string | null }>(
    `SELECT last_reviewed FROM memorization WHERE user_id = ? AND surah_id = ? AND ayah_to = ?`,
    [userId, surahId, ayahFrom - 1]
  );
  return isWarmStart(preceding?.last_reviewed ?? null, now);
}

// GET /api/memorization/surah/:surahId — Get surah progress
memorizationRoutes.get('/surah/:surahId', async (c) => {
  const { surahId } = c.req.param();
  const surahNum = Number(surahId);

  // Reject out-of-range before querying, matching quran.ts's pattern for the
  // same kind of input — otherwise an invalid surahId silently returns an
  // empty `data` with 200 instead of surfacing the bad request.
  if (!Number.isInteger(surahNum) || surahNum < 1 || surahNum > 114) {
    return c.json({ error: 'Expected surahId 1–114' }, 400);
  }

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

// POST /api/memorization/:id/review — Review a memorization entry (FSRS-6)
memorizationRoutes.post('/:id/review', async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId');
  const db = getDb(c);
  const body = await c.req.json();
  const hasAccuracy = body.accuracy !== undefined;

  // Two ways in: a measured accuracy from typed recall (gradeRecall client-side),
  // or a self-reported grade from the "I recited it aloud" fallback — recitation
  // without typing is legitimate practice and not every session can be measured.
  // Whichever arrives, gradedFrom on the response says which it was, because a
  // schedule built from a measurement and one built from an opinion are not the
  // same evidence and later analysis needs to tell them apart.
  let grade: Grade;
  if (hasAccuracy) {
    // Reject rather than clamp: an accuracy outside 0..1 means the caller computed
    // it wrongly, and silently clamping would bury that in a plausible schedule.
    if (
      typeof body.accuracy !== 'number' ||
      Number.isNaN(body.accuracy) ||
      body.accuracy < 0 ||
      body.accuracy > 1
    ) {
      return c.json({ error: 'accuracy must be a number between 0 and 1' }, 400);
    }
    grade = gradeFromAccuracy(body.accuracy);
  } else {
    // Four named grades rather than a 1–5 number. FSRS grades on exactly four values,
    // and a numeric scale with five points would have to collapse two of them onto the
    // same schedule — a scale where two answers do the same thing is a lie to the
    // learner. Rejected loudly rather than defaulted, because silently treating an
    // unknown grade as "good" would corrupt the schedule invisibly.
    if (!isGrade(body.grade)) {
      return c.json({ error: `grade must be one of ${GRADE_VALUES.join(', ')}` }, 400);
    }
    grade = body.grade;
  }

  try {
    const entry = await db.get<MemorizationRow>(
      `SELECT * FROM memorization WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (!entry) {
      return c.json({ error: 'Entry not found' }, 404);
    }

    const now = new Date();

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
      grade,
      now,
      await hifzRetentionFor(db, userId)
    );

    const warmStart = await precedingSpanWarmStart(db, userId, entry.surah_id, entry.ayah_from, now);

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
         last_review = ?,
         warm_start = ?
       WHERE id = ? AND user_id = ?`,
      [
        result.nextReview,
        result.status,
        result.interval,
        result.stability,
        result.difficulty,
        result.fsrsState,
        result.lastReview,
        warmStart ? 1 : 0,
        id,
        userId,
      ]
    );

    return c.json({
      data: {
        success: true,
        grade,
        gradedFrom: hasAccuracy ? 'accuracy' : 'self',
        nextReview: result.nextReview,
        status: result.status,
        interval: result.interval,
        warmStart,
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

  // A missing/malformed recalledAyah must be rejected, not silently graded as
  // 'again' — matching /review's strict validation of `grade` above.
  if (typeof recalledAyah !== 'number' || !Number.isInteger(recalledAyah)) {
    return c.json({ error: 'recalledAyah must be an integer' }, 400);
  }

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
    const now = new Date();

    const result = schedule(
      {
        stability: entry.stability,
        difficulty: entry.difficulty,
        last_review: entry.last_review,
        fsrs_state: entry.fsrs_state,
        interval: entry.interval,
        reviews: entry.revision_count,
      },
      grade,
      now,
      await hifzRetentionFor(db, userId)
    );

    const warmStart = await precedingSpanWarmStart(db, userId, entry.surah_id, entry.ayah_from, now);

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
         last_review = ?,
         warm_start = ?
       WHERE id = ? AND user_id = ?`,
      [
        result.nextReview,
        result.status,
        result.interval,
        result.stability,
        result.difficulty,
        result.fsrsState,
        result.lastReview,
        warmStart ? 1 : 0,
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
        warmStart,
      },
    });
  } catch (error) {
    console.error('Memorization recall error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/memorization/review/today — Get today's review targets
//
// Sabaq (never reviewed) and sabqi (last reviewed within 30 days) select the
// same way this always has: due by FSRS's next_review. Manzil (last reviewed
// over 30 days ago) deliberately does NOT — chained recall depends on
// contiguity, so a per-item due-date queue would scatter what should surface
// as one contiguous span. Instead every manzil-tier span is ordered by
// position and split into 7 contiguous buckets; today's bucket (UTC
// day-of-week) is what surfaces, so the whole memorised body rotates through
// once a week regardless of any individual span's due date. Tier is computed
// from last_reviewed at query time, not stored — it is a pure function of
// review history, and storing it would just be a second place to keep in sync.
memorizationRoutes.get('/review/today', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const dueTiered = await db.query<
      MemorizationRow & { ayah_text: string | null; text_simple: string | null; tier: string }
    >(
      `SELECT m.*,
              q.text_uthmani AS ayah_text,
              q.text_simple  AS text_simple,
              CASE WHEN m.last_reviewed IS NULL THEN 'sabaq' ELSE 'sabqi' END AS tier
       FROM memorization m
       LEFT JOIN quran_verses q ON m.surah_id = q.surah AND m.ayah_to = q.ayah
       WHERE m.user_id = ?
         AND m.next_review <= datetime('now')
         AND (m.last_reviewed IS NULL OR julianday('now') - julianday(m.last_reviewed) <= 30)
       ORDER BY m.next_review ASC`,
      [userId]
    );

    const manzilAll = await db.query<
      MemorizationRow & { ayah_text: string | null; text_simple: string | null }
    >(
      `SELECT m.*,
              q.text_uthmani AS ayah_text,
              q.text_simple  AS text_simple
       FROM memorization m
       LEFT JOIN quran_verses q ON m.surah_id = q.surah AND m.ayah_to = q.ayah
       WHERE m.user_id = ?
         AND m.last_reviewed IS NOT NULL
         AND julianday('now') - julianday(m.last_reviewed) > 30
       ORDER BY m.surah_id ASC, m.ayah_from ASC`,
      [userId]
    );

    const bucket = new Date().getUTCDay(); // 0–6, rotates weekly
    const n = manzilAll.length;
    const start = Math.floor((bucket * n) / 7);
    const end = Math.floor(((bucket + 1) * n) / 7);
    const manzilToday = manzilAll.slice(start, end).map((row) => ({ ...row, tier: 'manzil' }));

    return c.json({ data: [...dueTiered, ...manzilToday] });
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

/**
 * GET  /api/memorization/retention — current preference + a real workload preview
 * POST /api/memorization/retention — set it
 *
 * "Make it a per-track setting, and show the workload cost before the learner
 * chooses" — the preview is computed from the caller's OWN current memorization
 * rows via estimateReviewsPerDay(), not a canned figure. NULL/unset means the
 * unchanged 0.9 default; TRACK_RETENTION.hifz (0.95) is offered as a suggestion,
 * never applied automatically.
 */
memorizationRoutes.get('/retention', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const current = await hifzRetentionFor(db, userId);

    const rows = await db.query<{
      stability: number | null;
      difficulty: number | null;
      last_review: string | null;
      fsrs_state: number | null;
      interval: number | null;
      revision_count: number | null;
    }>(
      `SELECT stability, difficulty, last_review, fsrs_state, interval, revision_count
         FROM memorization WHERE user_id = ?`,
      [userId]
    );
    const states: FsrsState[] = rows.map((r) => ({
      stability: r.stability,
      difficulty: r.difficulty,
      last_review: r.last_review,
      fsrs_state: r.fsrs_state,
      interval: r.interval,
      reviews: r.revision_count,
    }));

    const now = new Date();
    const candidates = [0.85, REQUEST_RETENTION, TRACK_RETENTION.hifz];
    const preview = [...new Set(candidates)]
      .sort((a, b) => a - b)
      .map((retention) => ({
        retention,
        estimatedReviewsPerDay: estimateReviewsPerDay(states, retention, now),
      }));

    return c.json({
      data: {
        current,
        isDefault: current === REQUEST_RETENTION,
        suggestedHifz: TRACK_RETENTION.hifz,
        itemCount: states.length,
        preview,
      },
      basis:
        'preview is simulated from your own current memorization items — each ' +
        'scheduled one step ahead at a good grade, the modal real outcome — not a ' +
        'general figure. Estimate, not a guarantee.',
    });
  } catch (error) {
    console.error('Retention preview error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

memorizationRoutes.post('/retention', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const body = (await c.req.json()) as { retention?: unknown };
    // A retention outside a sane band is refused rather than clamped, same
    // discipline as accuracy validation elsewhere in this file — silently
    // clamping would bury a caller's mistake in a plausible-looking schedule.
    if (
      typeof body.retention !== 'number' ||
      Number.isNaN(body.retention) ||
      body.retention < 0.7 ||
      body.retention > 0.99
    ) {
      return c.json({ error: 'retention must be a number between 0.7 and 0.99' }, 400);
    }

    await db.run(`UPDATE users SET hifz_retention = ? WHERE id = ?`, [
      body.retention,
      userId,
    ]);

    return c.json({ data: { retention: body.retention } });
  } catch (error) {
    console.error('Set retention error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

memorizationRoutes.delete('/retention', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    // Back to the unchanged default — "I want to undo my choice" needs the
    // same escape hatch every other known-state toggle in this app has.
    await db.run(`UPDATE users SET hifz_retention = NULL WHERE id = ?`, [userId]);
    return c.json({ data: { retention: REQUEST_RETENTION } });
  } catch (error) {
    console.error('Reset retention error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
