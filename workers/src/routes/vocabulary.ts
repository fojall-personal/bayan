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


// ── GET /api/vocabulary/word/:word — detail for a single unrooted word ────
//
// Function words (مِن, فِي, عَلَى, ...) have no root, so /root/:root has nothing
// to key off of for them. RootCard opens RootFamilyDetail on click; this is the
// equivalent destination for FunctionWordCard, which previously had no detail
// view to open and no-op'd on click.

vocabularyRoutes.get('/word/:word', async (c) => {
  const { word } = c.req.param();
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const row = await db.get<
      Pick<VocabularyRow, 'word' | 'transliteration' | 'meaning' | 'root' | 'part_of_speech' | 'frequency_rank'>
    >(
      `SELECT word, transliteration, meaning, root, part_of_speech, frequency_rank
         FROM vocabulary
        WHERE word = ?`,
      [word]
    );

    if (!row) {
      return c.json({ error: `No vocabulary entry for "${word}"` }, 404);
    }

    const masteryRow = await db.get<
      Pick<VocabularyMasteryRow, 'meaning_known' | 'reading_known' | 'reviews'>
    >(
      `SELECT COALESCE(meaning_known, 0) AS meaning_known,
              COALESCE(reading_known, 0) AS reading_known,
              COALESCE(reviews, 0) AS reviews
         FROM vocabulary_mastery
        WHERE user_id = ? AND word = ?`,
      [userId, word]
    );

    const correct = masteryRow?.meaning_known ?? 0;
    const total = masteryRow?.reviews ?? 0;

    return c.json({
      data: {
        word: row.word,
        transliteration: row.transliteration,
        meaning: row.meaning,
        root: row.root,
        partOfSpeech: row.part_of_speech,
        frequencyRank: row.frequency_rank,
        mastery: {
          correctAttempts: correct,
          totalAttempts: total,
          masteryLevel: masteryLevel(correct, total),
        },
      },
    });
  } catch (error) {
    console.error('Vocabulary word detail error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
