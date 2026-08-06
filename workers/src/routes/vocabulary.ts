import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';

import { buildFamily } from '../lib/root-families';
import type {
  VocabularyRow,
  VocabularyMasteryRow,
} from '../db/schema';

export const vocabularyRoutes = new Hono<AppEnv>();

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Derive mastery level from correct/total attempts, capped at 5.
 *
 * Matches the contract documented in the route spec: every caller
 * (the vocabulary tab UI, the flashcard review path) agrees on a single
 * formula, so centralising it here is the only thing stopping them from
 * drifting.
 */
function masteryLevel(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(5, Math.round((correct * 5) / total));
}

// ── GET /api/vocabulary — list vocabulary roots with user progress ────────

vocabularyRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  const rawLimit = c.req.query('limit');
  let limit = 50;
  if (rawLimit !== undefined) {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return c.json({ error: 'limit must be a positive integer' }, 400);
    }
    limit = Math.min(parsed, 200);
  }

  try {
    const rows = await db.query<
      Pick<VocabularyRow, 'word' | 'transliteration' | 'meaning' | 'root' | 'frequency_rank' | 'part_of_speech'> & {
        meaning_known: number;
        reading_known: number;
        reviews: number;
      }
    >(
      `SELECT v.word, v.transliteration, v.meaning, v.root, v.frequency_rank, v.part_of_speech,
              COALESCE(vm.meaning_known, 0) AS meaning_known,
              COALESCE(vm.reading_known, 0) AS reading_known,
              COALESCE(vm.reviews, 0) AS reviews
         FROM vocabulary v
         LEFT JOIN vocabulary_mastery vm
           ON vm.word = v.word AND vm.user_id = ?
        ORDER BY v.frequency_rank ASC
        LIMIT ?`,
      [userId, limit]
    );

    const data = rows.map((r) => ({
      word: r.word,
      transliteration: r.transliteration,
      meaning: r.meaning,
      root: r.root,
      frequency_rank: r.frequency_rank,
      part_of_speech: r.part_of_speech,
      mastery: {
        meaningKnown: r.meaning_known,
        readingKnown: r.reading_known,
        reviews: r.reviews,
      },
    }));

    return c.json({ data });
  } catch (error) {
    console.error('Vocabulary list error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ── GET /api/vocabulary/root/:root — family detail for a root ────────────

vocabularyRoutes.get('/root/:root', async (c) => {
  const { root } = c.req.param();
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const morphRows = await db.query<
      Pick<VocabularyRow, 'root'> & {
        lemma: string | null;
        pos: string | null;
        verb_form: string | null;
        aspect: string | null;
        voice: string | null;
        case_case: string | null;
        gender: string | null;
        number: string | null;
        person: string | null;
      }
    >(
      `SELECT lemma, root, pos, verb_form, aspect, voice, case_case, gender, number, person
         FROM quran_word_morphology
        WHERE root = ?`,
      [root]
    );

    if (morphRows.length === 0) {
      return c.json(
        { error: `No occurrences of root "${root}" in the corpus` },
        404
      );
    }

    const family = buildFamily(root, morphRows);

    // User mastery for this root: aggregated across every word that
    // belongs to it. A root with no word-level attempts returns the
    // zero-object so the UI can render "no data" instead of failing on
    // undefined.
    const masteryRow = await db.get<
      Pick<VocabularyMasteryRow, 'meaning_known' | 'reading_known' | 'reviews'>
    >(
      `SELECT COALESCE(SUM(meaning_known), 0) AS meaning_known,
              COALESCE(SUM(reading_known), 0) AS reading_known,
              COALESCE(SUM(reviews), 0) AS reviews
         FROM vocabulary_mastery
        WHERE user_id = ?
          AND word IN (SELECT word FROM vocabulary WHERE root = ?)`,
      [userId, root]
    );

    const correct = masteryRow?.meaning_known ?? 0;
    const total = masteryRow?.reviews ?? 0;

    return c.json({
      data: {
        root: family.root,
        rootArabic: family.rootArabic,
        members: family.members,
        formsAttested: family.formsAttested,
        totalOccurrences: family.totalOccurrences,
        mastery: {
          correctAttempts: correct,
          totalAttempts: total,
          masteryLevel: masteryLevel(correct, total),
        },
      },
    });
  } catch (error) {
    console.error('Vocabulary root detail error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ── GET /api/vocabulary/grouped — all rooted vocabulary, grouped by root ──
//
// Mirrors the shape of GET /api/learning/vocabulary: { data: { roots: [...] } }
// where each root carries its family members in frequency order. The vocabulary
// tab's data feed (and every UI surface that used to hit /api/learning/vocabulary)
// consumes this grouped shape — flat lists force the client to regroup, which is
// error-prone and duplicates work the server already does once per request.
//
// Words without a root are excluded: the grouped contract requires a root key,
// and the four unrooted function words (مِن, فِي, عَن, بَعْض) are not
// representable as a family anyway. The GET / list (kept for compatibility)
// still returns them flat.
vocabularyRoutes.get('/grouped', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const rows = await db.query<{
      root: string | null;
      meaning: string;
      word: string;
      transliteration: string | null;
      frequency_rank: number;
      part_of_speech: string | null;
      meaning_known: number | null;
      reading_known: number | null;
      reviews: number | null;
    }>(
      `SELECT v.root,
              v.meaning,
              v.word,
              v.transliteration,
              v.frequency_rank,
              v.part_of_speech,
              vm.meaning_known,
              vm.reading_known,
              vm.reviews
         FROM vocabulary v
         LEFT JOIN vocabulary_mastery vm
           ON vm.word = v.word AND vm.user_id = ?
        WHERE v.root IS NOT NULL
        ORDER BY v.frequency_rank ASC`,
      [userId]
    );

    // Group by root, keeping frequency order. Each root carries the words the
    // learner already knows about (from any of the root-family entries).
    const byRoot = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!row.root) continue;
      const existing = byRoot.get(row.root) || [];
      existing.push(row);
      byRoot.set(row.root, existing);
    }

    const roots = Array.from(byRoot.entries()).map(([root, words]) => ({
      root,
      meaning: words[0].meaning,
      words: words.map((w) => ({
        word: w.word,
        meaning: w.meaning,
        transliteration: w.transliteration ?? '',
        frequency_rank: w.frequency_rank,
        part_of_speech: w.part_of_speech ?? '',
        meaning_known: w.meaning_known ?? 0,
        reading_known: w.reading_known ?? 0,
        reviews: w.reviews ?? 0,
      })),
    }));

    return c.json({ data: { roots } });
  } catch (error) {
    console.error('Vocabulary grouped error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ── POST /api/vocabulary/mastery — record one correct/incorrect attempt ──

vocabularyRoutes.post('/mastery', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  const body = (await c.req.json()) as { root?: unknown; correct?: unknown };
  const root = body?.root;

  if (typeof root !== 'string' || root.trim() === '') {
    return c.json({ error: 'root is required' }, 400);
  }

  const correctRaw = body.correct;
  if (typeof correctRaw !== 'boolean') {
    return c.json({ error: 'correct must be a boolean' }, 400);
  }
  const correct = correctRaw ? 1 : 0;

  try {
    // Verify the root is in the vocabulary table before recording.
    const vocab = await db.get<Pick<VocabularyRow, 'word'>>(
      `SELECT word FROM vocabulary WHERE root = ? LIMIT 1`,
      [root]
    );

    // If the vocabulary table has no row for this root (some corpus
    // roots never made it into the curated list), still record the
    // attempt — the user is reporting on their own knowledge. We key
    // on the word we resolved above; the root itself is never a column
    // in vocabulary_mastery, so the link is the vocabulary.word ->
    // vocabulary.root join.
    const word = vocab?.word ?? root;

    const current = await db.get<
      Pick<VocabularyMasteryRow, 'meaning_known' | 'reading_known' | 'reviews'>
    >(
      `SELECT COALESCE(SUM(meaning_known), 0) AS meaning_known,
              COALESCE(SUM(reading_known), 0) AS reading_known,
              COALESCE(SUM(reviews), 0) AS reviews
         FROM vocabulary_mastery
        WHERE user_id = ?
          AND word IN (SELECT word FROM vocabulary WHERE root = ?)`,
      [userId, root]
    );

    const newCorrect = (current?.meaning_known ?? 0) + correct;
    const newTotal = (current?.reviews ?? 0) + 1;
    const newMastery = masteryLevel(newCorrect, newTotal);

    await db.run(
      `INSERT INTO vocabulary_mastery
         (user_id, word, reviews, meaning_known, last_seen)
       VALUES (?, ?, 1, ?, datetime('now'))
       ON CONFLICT(user_id, word) DO UPDATE SET
         reviews       = reviews + 1,
         meaning_known = meaning_known + ?,
         last_seen     = datetime('now')`,
      [userId, word, correct, correct]
    );

    return c.json({
      data: {
        success: true,
        root,
        mastery: {
          correctAttempts: newCorrect,
          totalAttempts: newTotal,
          masteryLevel: newMastery,
        },
      },
    });
  } catch (error) {
    console.error('Vocabulary mastery update error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
