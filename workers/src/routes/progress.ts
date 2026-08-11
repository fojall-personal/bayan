import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';
import type { AssessmentResultsRow } from '../db/schema';

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
       known_fw AS (
         SELECT lemma, pos FROM user_known_function_word WHERE user_id = ?
       ),
       ayah_state AS (
         SELECT surah_id, ayah_id,
                SUM(CASE WHEN m.root IS NOT NULL
                          AND m.root NOT IN (SELECT root FROM known)
                         THEN 1 ELSE 0 END) AS unknown_rooted,
                SUM(CASE WHEN m.root IS NULL
                          AND m.lemma IS NOT NULL AND m.lemma <> '' AND m.pos IS NOT NULL
                          AND NOT EXISTS (
                                SELECT 1 FROM known_fw f
                                 WHERE f.lemma = m.lemma AND f.pos = m.pos)
                         THEN 1 ELSE 0 END) AS unknown_fn
         FROM quran_word_morphology m
         GROUP BY surah_id, ayah_id
       )
       SELECT
         (SELECT COUNT(*) FROM ayah_state
           WHERE unknown_rooted = 0 AND unknown_fn = 0)               AS ayahs_readable,
         (SELECT COUNT(*) FROM ayah_state)                            AS ayahs_total,
         (SELECT COUNT(*) FROM known)                                 AS roots_known,
         (SELECT COUNT(DISTINCT root) FROM quran_word_morphology
           WHERE root IS NOT NULL)                                    AS roots_total,
         (SELECT COUNT(*) FROM known_fw)                              AS fn_known,
         (SELECT COUNT(*) FROM (
            SELECT 1 FROM quran_word_morphology
             WHERE root IS NULL AND lemma IS NOT NULL AND lemma <> ''
               AND pos IS NOT NULL
             GROUP BY lemma, pos))                                    AS fn_total,
         (SELECT COUNT(*) FROM quran_word_morphology
           WHERE root IN (SELECT root FROM known))                    AS segments_known,
         (SELECT COUNT(*) FROM quran_word_morphology
           WHERE root IS NOT NULL)                                    AS segments_rooted,
         (SELECT COUNT(*) FROM (
            SELECT surah_id FROM ayah_state
            GROUP BY surah_id
            HAVING SUM(unknown_rooted) = 0 AND SUM(unknown_fn) = 0))  AS surahs_readable`,
      [userId, userId]
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

    // Pattern (wazn) coverage — a separate metric, deliberately NOT folded into
    // ayahsReadable above. A learner can read غفر without knowing it is Form I by
    // name, so gating readability on pattern knowledge would make coverage drop
    // again for a much weaker reason than the function-word rollout had. This is
    // "which of the trackable forms do you know," parallel to roots and function
    // words, not a new AND-condition on top of them. Scoped to forms that are
    // actually attested with a verb_form value — Form I has none (see
    // 0024_known_patterns.sql) and is out of scope by construction, not filtered
    // here.
    const patternRow = await db.get<{ known: number; total: number }>(
      `SELECT
         (SELECT COUNT(*) FROM user_known_pattern WHERE user_id = ?) AS known,
         (SELECT COUNT(DISTINCT verb_form) FROM quran_word_morphology
           WHERE verb_form IS NOT NULL)                              AS total`,
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
        functionWordsKnown: row.fn_known,
        functionWordsTotal: row.fn_total,
        patternsKnown: patternRow?.known ?? 0,
        patternsTotal: patternRow?.total ?? 0,
        surahsReadable: row.surahs_readable,
        surahsTotal: 114,
        nextRoots: next,
      },
      // Stated, not buried: the reader should know what "readable" counts.
      basis:
        'An ayah counts as readable when every rooted word has a known root AND every ' +
        'function word is known. Function words — particles, pronouns, negations — are ' +
        '35.5% of the text and carry the syntax; they were previously assumed known. ' +
        'There are 215 of them (counted per part of speech, because maA is a relative ' +
        'pronoun 1,476 times and a negation 705 times) and the top 50 cover 94% of ' +
        'their occurrences. Pattern (wazn) coverage is separate and does not affect ' +
        'ayahsReadable — knowing a word does not require knowing its verb form by name.',
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
/**
 * Ayahs where every rooted word AND every function word is known.
 *
 * The function-word half is not a refinement. Measured against this corpus, 27,462 of
 * 77,429 word tokens carry no root — prepositions (9,886), conjunctions (4,090),
 * relative pronouns (2,202), negations (1,258) — and the old query counted every one
 * of them as known. So "fully readable" was asserted over 64.5% of the text and
 * assumed for the rest, which is precisely the part that carries the syntax.
 *
 * Matched on (lemma, pos), never lemma alone: `maA` is a relative pronoun 1,476 times
 * and a negation 705 times. They are different words that share a spelling.
 */
async function ayahsReadable(db: Database, userId: string): Promise<number> {
  const row = await db.get<{ n: number }>(
    `WITH known AS (SELECT root FROM user_known_root WHERE user_id = ?),
          known_fw AS (
            SELECT lemma, pos FROM user_known_function_word WHERE user_id = ?
          )
     SELECT COUNT(*) AS n FROM (
       SELECT surah_id, ayah_id
         FROM quran_word_morphology m
        GROUP BY surah_id, ayah_id
       HAVING SUM(CASE WHEN m.root IS NOT NULL
                        AND m.root NOT IN (SELECT root FROM known)
                       THEN 1 ELSE 0 END) = 0
          AND SUM(CASE WHEN m.root IS NULL
                        AND m.lemma IS NOT NULL AND m.lemma <> '' AND m.pos IS NOT NULL
                        AND NOT EXISTS (
                              SELECT 1 FROM known_fw f
                               WHERE f.lemma = m.lemma AND f.pos = m.pos)
                       THEN 1 ELSE 0 END) = 0
     )`,
    [userId, userId]
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

/**
 * GET    /api/progress/function-words            — the 175 function words, by frequency
 * POST   /api/progress/function-words/:lemma/:pos/known
 * DELETE /api/progress/function-words/:lemma/:pos/known
 *
 * Coverage assumed every unrooted word was already known — 35.5% of the text, and
 * precisely the words that carry the syntax. These endpoints are the missing state.
 *
 * Addressed by (lemma, pos), never lemma alone: `maA` is REL 1,476 times and NEG 705
 * times. Two words, one spelling, learned separately.
 */
progressRoutes.get('/function-words', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const items = await db.query<{
      lemma: string;
      pos: string;
      occurrences: number;
      known: number;
    }>(
      `SELECT m.lemma,
              m.pos,
              COUNT(*) AS occurrences,
              CASE WHEN k.lemma IS NULL THEN 0 ELSE 1 END AS known
         FROM quran_word_morphology m
         LEFT JOIN user_known_function_word k
           ON k.user_id = ? AND k.lemma = m.lemma AND k.pos = m.pos
        WHERE m.root IS NULL
          AND m.lemma IS NOT NULL AND m.lemma <> ''
          AND m.pos IS NOT NULL
        GROUP BY m.lemma, m.pos
        ORDER BY occurrences DESC, m.lemma, m.pos`,
      [userId]
    );

    return c.json({
      data: {
        items: items.map((i) => ({
          lemma: i.lemma,
          pos: i.pos,
          occurrences: i.occurrences,
          known: i.known === 1,
        })),
      },
      // Measured, so the learner can check the claim rather than trust it.
      basis:
        'Function words are segments with no root — particles, pronouns, negations. ' +
        'There are 215 (lemma,pos) pairs in the Quran; the top 50 cover 94% of all ' +
        'function-word ' +
        'occurrences. Listed separately per part of speech, because maA is a relative ' +
        'pronoun 1,476 times and a negation 705 times.',
    });
  } catch (error) {
    console.error('Function words error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

progressRoutes.post('/function-words/:lemma/:pos/known', async (c) => {
  const userId = c.get('userId');
  const lemma = c.req.param('lemma');
  const pos = c.req.param('pos');
  const db = getDb(c);

  try {
    // Same refusal as roots: an unattested pair can never make an ayah readable,
    // so accepting a typo would inflate the count with nothing.
    const exists = await db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM quran_word_morphology
        WHERE lemma = ? AND pos = ? AND root IS NULL`,
      [lemma, pos]
    );
    if (!exists || exists.n === 0) {
      return c.json(
        { error: `The corpus has no function word "${lemma}" as ${pos}` },
        404
      );
    }

    const before = await ayahsReadable(db, userId);
    await db.run(
      `INSERT OR IGNORE INTO user_known_function_word (user_id, lemma, pos)
       VALUES (?, ?, ?)`,
      [userId, lemma, pos]
    );
    const after = await ayahsReadable(db, userId);

    return c.json({
      data: {
        lemma,
        pos,
        occurrences: exists.n,
        ayahsUnlocked: after - before,
        ayahsReadable: after,
        ayahsTotal: 6236,
      },
    });
  } catch (error) {
    console.error('Mark function word known error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

progressRoutes.delete('/function-words/:lemma/:pos/known', async (c) => {
  const userId = c.get('userId');
  const lemma = c.req.param('lemma');
  const pos = c.req.param('pos');
  const db = getDb(c);

  try {
    await db.run(
      `DELETE FROM user_known_function_word
        WHERE user_id = ? AND lemma = ? AND pos = ?`,
      [userId, lemma, pos]
    );
    return c.json({ data: { lemma, pos } });
  } catch (error) {
    console.error('Unmark function word error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/progress/freeflow — contiguous runs of ayat you can already read at pace.
 *
 * Coverage and the reading queue are both effortful bands — 100% known (review) or
 * one root short (i+1). Neither builds speed, and Refold names "only mining, never
 * freeflowing" as a top-3 learner mistake: a learner who only ever does hard work
 * stays slow forever. This is the third band — reading a run of ayat you already
 * know, at pace, with no lookups.
 *
 * "Contiguous" is the point. A scattered single ayah at 100% is not a reading
 * session; a run of ten in a row is. The threshold is 98%, not 100% — Laufer 2020's
 * adequate-comprehension figure — computed the same way coverage counts it: every
 * segment that is either a known root or a known function word (rooted and
 * unrooted words both count, per Task 3; a run that only checked roots would be
 * exactly the bug that made coverage wrong before).
 */
progressRoutes.get('/freeflow', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  const minWords = Math.max(0, Number(c.req.query('minWords') ?? 0) || 0);

  try {
    const rows = await db.query<{
      surah_id: number;
      ayah_id: number;
      word_count: number;
      total_meaningful: number;
      unknown_meaningful: number;
    }>(
      `WITH known AS (
         SELECT root FROM user_known_root WHERE user_id = ?
       ),
       known_fw AS (
         SELECT lemma, pos FROM user_known_function_word WHERE user_id = ?
       )
       SELECT surah_id, ayah_id,
              COUNT(DISTINCT word_index) AS word_count,
              SUM(CASE WHEN m.root IS NOT NULL THEN 1
                       WHEN m.lemma IS NOT NULL AND m.lemma <> '' AND m.pos IS NOT NULL THEN 1
                       ELSE 0 END) AS total_meaningful,
              SUM(CASE WHEN m.root IS NOT NULL
                            AND m.root NOT IN (SELECT root FROM known) THEN 1
                       WHEN m.root IS NULL
                            AND m.lemma IS NOT NULL AND m.lemma <> '' AND m.pos IS NOT NULL
                            AND NOT EXISTS (
                                  SELECT 1 FROM known_fw f
                                   WHERE f.lemma = m.lemma AND f.pos = m.pos)
                       THEN 1 ELSE 0 END) AS unknown_meaningful
         FROM quran_word_morphology m
        GROUP BY surah_id, ayah_id
        ORDER BY surah_id, ayah_id`,
      [userId, userId]
    );

    // Group into maximal contiguous runs, in JS rather than SQL — this is an
    // ordered scan with a running window, not a set operation. An ayah with zero
    // meaningful segments (only disconnected letters) is vacuously 100% covered,
    // matching how coverage/ayahsReadable already treat unrooted, unlabeled words.
    // A gap in ayah_id — even within the same surah — ends the run rather than
    // being silently bridged, for the same reason Task 8's own eval exists: an
    // unmeasured ayah must never be assumed readable.
    type Run = { surah: number; ayahFrom: number; ayahTo: number; wordCount: number };
    const runs: Run[] = [];
    let current: Run | null = null;

    for (const r of rows) {
      const coverage =
        r.total_meaningful === 0
          ? 1
          : (r.total_meaningful - r.unknown_meaningful) / r.total_meaningful;
      const qualifies = coverage >= 0.98;

      if (qualifies && current && current.surah === r.surah_id && current.ayahTo === r.ayah_id - 1) {
        current.ayahTo = r.ayah_id;
        current.wordCount += r.word_count;
      } else {
        if (current) runs.push(current);
        current = qualifies
          ? { surah: r.surah_id, ayahFrom: r.ayah_id, ayahTo: r.ayah_id, wordCount: r.word_count }
          : null;
      }
    }
    if (current) runs.push(current);

    const filtered = runs
      .filter((r) => r.wordCount >= minWords)
      .sort((a, b) => b.wordCount - a.wordCount || a.surah - b.surah || a.ayahFrom - b.ayahFrom);

    return c.json({
      data: {
        runs: filtered.map((r) => ({
          surah: r.surah,
          ayahFrom: r.ayahFrom,
          ayahTo: r.ayahTo,
          ayahCount: r.ayahTo - r.ayahFrom + 1,
          wordCount: r.wordCount,
          // A rough reading pace, not a cited figure — flagged as an estimate
          // rather than dressed up as measured, same discipline as the coverage
          // model's interest-income estimate. ~2.2 words/sec is a moderate,
          // unhurried tarteel pace; the UI should say "about" and mean it.
          estimatedSeconds: Math.round(r.wordCount / 2.2),
        })),
      },
      basis:
        'Contiguous ayahs at 98% or more of words known — rooted and function words ' +
        'both, per the coverage model. Longest run first, filtered to runs with at ' +
        'least minWords words so a single short ayah does not count as a reading ' +
        'session.',
    });
  } catch (error) {
    console.error('Freeflow error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET    /api/progress/patterns                — attested verb forms, by frequency
 * POST   /api/progress/patterns/:form/known
 * DELETE /api/progress/patterns/:form/known
 *
 * Same shape as roots and function words, applied to the other half of the
 * multiplicative pair the coverage model is missing: Bayan tracks roots, but
 * Arabic is root x pattern (knowing a root plus a form lets you decode a word
 * you have never met). Form I is the unmarked default (verb_form IS NULL in the
 * corpus) and is deliberately not trackable here — there is no attested value to
 * validate a POST against, and a learner does not "learn" the base form
 * separately from the root itself.
 */
progressRoutes.get('/patterns', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const items = await db.query<{
      verb_form: string;
      occurrences: number;
      known: number;
    }>(
      `SELECT m.verb_form,
              COUNT(*) AS occurrences,
              CASE WHEN k.verb_form IS NULL THEN 0 ELSE 1 END AS known
         FROM quran_word_morphology m
         LEFT JOIN user_known_pattern k
           ON k.user_id = ? AND k.verb_form = m.verb_form
        WHERE m.verb_form IS NOT NULL
        GROUP BY m.verb_form
        ORDER BY occurrences DESC`,
      [userId]
    );

    return c.json({
      data: {
        items: items.map((i) => ({
          verbForm: i.verb_form,
          occurrences: i.occurrences,
          known: i.known === 1,
        })),
      },
      basis:
        'Derived verb forms only (Form I is the unmarked default and has no ' +
        'attested value here). Six forms — I, IV, II, VIII, III, V — cover 99% of ' +
        'the 19,356 verb stems in the Quran; the rest are individually rare.',
    });
  } catch (error) {
    console.error('Patterns error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

progressRoutes.post('/patterns/:form/known', async (c) => {
  const userId = c.get('userId');
  const form = c.req.param('form');
  const db = getDb(c);

  try {
    // Refuse a form the corpus does not attest — same discipline as roots and
    // function words: an unattested value can never mean anything, so accepting
    // one would inflate the count with nothing real.
    const exists = await db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM quran_word_morphology WHERE verb_form = ?`,
      [form]
    );
    if (!exists || exists.n === 0) {
      return c.json({ error: `The corpus has no verb form "${form}"` }, 404);
    }

    await db.run(
      `INSERT OR IGNORE INTO user_known_pattern (user_id, verb_form) VALUES (?, ?)`,
      [userId, form]
    );

    return c.json({ data: { verbForm: form, occurrences: exists.n } });
  } catch (error) {
    console.error('Mark pattern known error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

progressRoutes.delete('/patterns/:form/known', async (c) => {
  const userId = c.get('userId');
  const form = c.req.param('form');
  const db = getDb(c);

  try {
    await db.run(
      `DELETE FROM user_known_pattern WHERE user_id = ? AND verb_form = ?`,
      [userId, form]
    );
    return c.json({ data: { verbForm: form } });
  } catch (error) {
    console.error('Unmark pattern error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/progress/pattern-grid — root x wazn, the multiplicative payoff made visible.
 *
 * Rows are the learner's own known roots (frequency order, capped — a learner with
 * 400 known roots cannot see them all on one screen, so this is the commonest N,
 * not an arbitrary N). Columns are every verb form actually attested in the corpus.
 * `cells` lists only the (root, form) combinations that genuinely occur — most of
 * the grid is structurally empty (a root does not occur in every form), and the UI
 * is expected to treat "no cell" as "does not occur," not as a loading gap.
 */
progressRoutes.get('/pattern-grid', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  const limit = Math.min(Number(c.req.query('limit') ?? 20) || 20, 50);

  try {
    const roots = await db.query<{ root: string; occurrences: number }>(
      `SELECT k.root, COUNT(*) AS occurrences
         FROM user_known_root k
         JOIN quran_word_morphology m ON m.root = k.root
        WHERE k.user_id = ?
        GROUP BY k.root
        ORDER BY occurrences DESC
        LIMIT ?`,
      [userId, limit]
    );

    const forms = await db.query<{
      verb_form: string;
      occurrences: number;
      known: number;
    }>(
      `SELECT m.verb_form,
              COUNT(*) AS occurrences,
              CASE WHEN k.verb_form IS NULL THEN 0 ELSE 1 END AS known
         FROM quran_word_morphology m
         LEFT JOIN user_known_pattern k
           ON k.user_id = ? AND k.verb_form = m.verb_form
        WHERE m.verb_form IS NOT NULL
        GROUP BY m.verb_form
        ORDER BY occurrences DESC`,
      [userId]
    );

    const rootList = roots.map((r) => r.root);
    const cells =
      rootList.length === 0
        ? []
        : await db.query<{ root: string; verb_form: string; occurrences: number }>(
            `SELECT root, verb_form, COUNT(*) AS occurrences
               FROM quran_word_morphology
              WHERE verb_form IS NOT NULL
                AND root IN (${rootList.map(() => '?').join(',')})
              GROUP BY root, verb_form`,
            rootList
          );

    return c.json({
      data: {
        roots: roots.map((r) => ({ root: r.root, occurrences: r.occurrences })),
        forms: forms.map((f) => ({
          verbForm: f.verb_form,
          occurrences: f.occurrences,
          known: f.known === 1,
        })),
        cells: cells.map((cell) => ({
          root: cell.root,
          verbForm: cell.verb_form,
          occurrences: cell.occurrences,
        })),
      },
      basis:
        'Rows are your known roots, commonest first, capped at the requested limit. ' +
        'Columns are every verb form attested anywhere in the Quran. A lit cell means ' +
        'that root actually occurs in that form; a cell you know both halves of is a ' +
        'word you could decode without ever having met it.',
    });
  } catch (error) {
    console.error('Pattern grid error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
