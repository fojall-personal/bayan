import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';
import type {
  AssessmentResultsRow,
  LessonProgressRow,
  MemorizationRow,
} from '../db/schema';

export const progressRoutes = new Hono<AppEnv>();

// GET /api/progress/scores — Score history for charts
progressRoutes.get('/scores', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const history = await db.query<Pick<AssessmentResultsRow, 'literacy_score' | 'comprehension_score' | 'grammar_score' | 'memorization_score' | 'completed_at'>>(
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

// The daily-streak helper lived here and was called only by
// GET /api/progress/dashboard, which served the deleted /dashboard page. Both are
// gone. Nothing in the app displays a daily streak today: /progress marks which
// days had activity from assessment dates, which is a calendar rather than a
// streak. Worth stating plainly instead of leaving a computation nothing reads.

// Get weekly progress
async function getWeeklyProgress(
  db: Database,
  userId: string
): Promise<{ lessonsCompleted: number; reviewsCompleted: number; targetLessons: number; targetReviews: number }> {
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const lessons = await db.query<Pick<LessonProgressRow, 'lesson_id'>>(
    `SELECT lesson_id FROM lesson_progress
     WHERE user_id = ? AND last_practiced >= ?`,
    [userId, startOfWeek.toISOString()]
  );

  const reviews = await db.query<Pick<MemorizationRow, 'id'>>(
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
    const next = await db.query<{ root: string; occurrences: number }>(
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

/**
 * GET /api/progress/reading-queue — ayahs just past the edge of what you can read.
 *
 * Coverage reports ayahs that are 100% readable. That is the REVIEW band. Reading
 * research puts the productive threshold at 95% of words known for minimal
 * comprehension and 98% for adequate (Laufer 2020; Hu & Nation 2000; Schmitt et al.
 * 2011) — which in ayah terms is one, sometimes two, unknown roots. An ayah with
 * nothing unknown teaches nothing new; an ayah with six is a wall.
 *
 * Ordered by how much the unknown root pays back elsewhere in the Quran, so learning
 * one word opens the largest number of further ayahs. That ordering is the same
 * frequency argument the whole coverage model runs on, applied one ayah at a time.
 */
progressRoutes.get('/reading-queue', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  const limit = Math.min(Number(c.req.query('limit') ?? 10) || 10, 50);

  try {
    const rows = await db.query<{
      surah_id: number;
      ayah_id: number;
      unknown_rooted: number;
      total_rooted: number;
      blocking_root: string;
      root_occurrences: number;
      text_uthmani: string | null;
    }>(
      `WITH known AS (
         SELECT root FROM user_known_root WHERE user_id = ?
       ),
       unknown_words AS (
         SELECT surah_id, ayah_id, root
           FROM quran_word_morphology
          WHERE root IS NOT NULL
            AND root NOT IN (SELECT root FROM known)
       ),
       ayah_state AS (
         SELECT m.surah_id, m.ayah_id,
                SUM(CASE WHEN m.root IS NOT NULL
                          AND m.root NOT IN (SELECT root FROM known)
                         THEN 1 ELSE 0 END) AS unknown_rooted,
                SUM(CASE WHEN m.root IS NOT NULL THEN 1 ELSE 0 END) AS total_rooted
           FROM quran_word_morphology m
          GROUP BY m.surah_id, m.ayah_id
       ),
       root_freq AS (
         SELECT root, COUNT(*) AS occurrences
           FROM quran_word_morphology
          WHERE root IS NOT NULL
          GROUP BY root
       )
       SELECT s.surah_id, s.ayah_id, s.unknown_rooted, s.total_rooted,
              u.root AS blocking_root,
              f.occurrences AS root_occurrences,
              v.text_uthmani
         FROM ayah_state s
         JOIN unknown_words u
           ON u.surah_id = s.surah_id AND u.ayah_id = s.ayah_id
         JOIN root_freq f ON f.root = u.root
         LEFT JOIN quran_verses v ON v.surah = s.surah_id AND v.ayah = s.ayah_id
        WHERE s.unknown_rooted = 1
          AND s.total_rooted >= 3
        -- Coverage first, frequency second.
        --
        -- Ordering by frequency alone put 7:7 at the top with 3 of 4 words known —
        -- 75%, not 95%. "Exactly one unknown root" is a COUNT, and the research
        -- threshold is a PROPORTION: one unknown word in a four-word ayah is a quarter
        -- of it. So rank by how much of the ayah is already known, and use the
        -- unknown root's payoff elsewhere in the Quran only to break ties.
        ORDER BY CAST(s.total_rooted - s.unknown_rooted AS REAL) / s.total_rooted DESC,
                 f.occurrences DESC, s.surah_id, s.ayah_id
        LIMIT ?`,
      [userId, limit]
    );

    return c.json({
      data: {
        items: rows.map((r) => ({
          surah: r.surah_id,
          ayah: r.ayah_id,
          text: r.text_uthmani,
          /** The single root standing between the learner and this ayah. */
          blockingRoot: r.blocking_root,
          rootOccurrences: r.root_occurrences,
          knownWords: r.total_rooted - r.unknown_rooted,
          totalWords: r.total_rooted,
          // Stated so the 95% claim is checkable rather than asserted.
          coveragePct:
            r.total_rooted > 0
              ? Math.round(((r.total_rooted - r.unknown_rooted) / r.total_rooted) * 100)
              : 0,
        })),
        // The band this queue represents, so the UI can explain itself.
        // Stated as what it actually is. The reading research puts productive
        // comprehension at 95–98% of words known, but that is measured over running
        // text; a single short ayah cannot hit 95% with one unknown word unless it is
        // twenty words long. So the filter is one unknown root and the ORDER is by
        // coverage, which puts the closest-to-readable ayahs first without pretending
        // a four-word ayah at 75% is in the same band as a thirty-word one at 97%.
        thresholdNote:
          'Ayahs with exactly one unknown root, best-covered first. Coverage is shown per ayah — 95% and above is where reading is productive rather than a wall.',
      },
    });
  } catch (error) {
    console.error('Reading queue error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

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

/**
 * GET /api/progress/calibration — twelve roots to check knowledge against.
 *
 * The alternative was seeding known roots from the placement score: level 3 implies
 * the top 120 roots, and so on. That would be fabrication — the assessment's
 * eighteen questions cover literacy, comprehension, grammar and memorization, and
 * not one tests which roots a learner knows. Inferring a vocabulary from a
 * comprehension score is the same failure as citing Arabic nobody checked.
 *
 * So: measure. Twelve roots sampled ACROSS the frequency ranking rather than the
 * first twelve, each with its commonest attested word and that word's gloss —
 * a bare triliteral is recognisable to almost nobody, and the word is what you
 * actually meet on the page.
 */
const CALIBRATION_RANKS = [5, 15, 30, 60, 100, 160, 250, 380, 550, 800, 1100, 1500];

progressRoutes.get('/calibration', async (c) => {
  const db = getDb(c);

  try {
    // Rank every root by frequency once, then pick the sampled positions. LIMIT/
    // OFFSET per rank would be twelve scans of 128,219 segments.
    const ranked = await db.query<{ root: string; occurrences: number }>(
      `SELECT root, COUNT(*) AS occurrences
         FROM quran_word_morphology
        WHERE root IS NOT NULL
        GROUP BY root
        ORDER BY occurrences DESC`
    );

    const picks = CALIBRATION_RANKS
      .filter((r) => r <= ranked.length)
      .map((rank) => ({ rank, ...ranked[rank - 1] }));

    // The commonest word actually built on each root, so the prompt shows something
    // a learner has met rather than a paradigm they have not.
    const items = await Promise.all(
      picks.map(async (p) => {
        const word = await db.get<{ arabic: string; english: string }>(
          `SELECT g.arabic, g.english
             FROM quran_word_morphology m
             JOIN quran_word_gloss g
               ON g.surah_id = m.surah_id AND g.ayah_id = m.ayah_id
              AND g.position = m.word_index
            WHERE m.root = ?
            GROUP BY g.arabic, g.english
            ORDER BY COUNT(*) DESC
            LIMIT 1`,
          [p.root]
        );
        return {
          root: p.root,
          rank: p.rank,
          occurrences: p.occurrences,
          exampleArabic: word?.arabic ?? null,
          exampleEnglish: word?.english ?? null,
        };
      })
    );

    return c.json({
      data: { items, rootsTotal: ranked.length },
      basis:
        'Roots sampled across the frequency ranking. Answers are recorded as fact; ' +
        'any bulk fill beyond them is an estimate you opt into.',
    });
  } catch (error) {
    console.error('Calibration error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/progress/calibration — record the answers, and optionally fill a band.
 *
 * Body: { known: string[], fillToRank?: number }
 *
 * `known` is measurement and is written as given. `fillToRank` is the inference —
 * "you knew everything up to rank 100, so mark the rest of that band too" — and it
 * only happens because the learner asked for it. Keeping the two separate is the
 * whole point: a guess recorded as a measurement is how progress models stop being
 * trustworthy.
 */
progressRoutes.post('/calibration', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const body = (await c.req.json()) as { known?: unknown; fillToRank?: unknown };
    const known = Array.isArray(body.known)
      ? body.known.filter((r): r is string => typeof r === 'string' && r.length > 0)
      : [];
    const fillToRank =
      typeof body.fillToRank === 'number' && body.fillToRank > 0
        ? Math.min(Math.floor(body.fillToRank), 1642)
        : 0;

    const before = await ayahsReadable(db, userId);

    let roots = [...new Set(known)];
    if (fillToRank > 0) {
      const band = await db.query<{ root: string }>(
        `SELECT root FROM quran_word_morphology
          WHERE root IS NOT NULL
          GROUP BY root
          ORDER BY COUNT(*) DESC
          LIMIT ?`,
        [fillToRank]
      );
      roots = [...new Set([...roots, ...band.map((b) => b.root)])];
    }

    // Verify every root against the corpus before writing. A typo in the request
    // would otherwise inflate the count with something that can never make an ayah
    // readable.
    const attested = new Set(
      (
        await db.query<{ root: string }>(
          `SELECT DISTINCT root FROM quran_word_morphology WHERE root IS NOT NULL`
        )
      ).map((r) => r.root)
    );
    const valid = roots.filter((r) => attested.has(r));
    const rejected = roots.filter((r) => !attested.has(r));

    for (const r of valid) {
      await db.run(
        `INSERT OR IGNORE INTO user_known_root (user_id, root) VALUES (?, ?)`,
        [userId, r]
      );
    }

    const after = await ayahsReadable(db, userId);
    return c.json({
      data: {
        rootsRecorded: valid.length,
        rejected,
        measured: known.length,
        inferred: Math.max(0, valid.length - known.length),
        ayahsUnlocked: after - before,
        ayahsReadable: after,
        ayahsTotal: 6236,
      },
    });
  } catch (error) {
    console.error('Calibration save error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
