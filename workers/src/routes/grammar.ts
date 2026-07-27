import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';

import { parseArabicSentence, checkGrammarErrors } from '../lib/grammar-parser';
import {
  buildFamily,
  drillsFromFamily,
  grammarFacts,
  type MorphRow,
} from '../lib/root-families';

export const grammarRoutes = new Hono<AppEnv>();

// GET /api/grammar/deepdive/:category — Get deep-dive content for nahw/sarf/balagha
grammarRoutes.get('/deepdive/:category', async (c) => {
  const { category } = c.req.param();
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const mastery = await db.get<Record<string, unknown>>(
      `SELECT * FROM grammar_mastery WHERE user_id = ? AND category = ?`,
      [userId, category]
    );

    const lessons = await db.query<Record<string, unknown>>(
      `SELECT * FROM lessons WHERE module = 'grammar' AND level >= ? ORDER BY level ASC`,
      [(mastery?.mastery_level as number) || 1]
    );

    return c.json({
      data: {
        category,
        lessons: lessons.map((l) => ({
          ...l,
          content: JSON.parse((l.content as string) || '{}'),
          exercises: JSON.parse((l.exercises as string) || '[]'),
        })),
        mastery: mastery
          ? {
              category: mastery.category,
              masteryLevel: mastery.mastery_level,
              totalAttempts: mastery.total_attempts,
              correctAttempts: mastery.correct_attempts,
            }
          : { category, masteryLevel: 1, totalAttempts: 0, correctAttempts: 0 },
      },
    });
  } catch (error) {
    console.error('Grammar deepdive error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/grammar/parse — Parse an Arabic sentence
grammarRoutes.post('/parse', async (c) => {
  const userId = c.get('userId');
  const { sentence } = await c.req.json();

  try {
    const parsed = parseArabicSentence(sentence);
    const errors = checkGrammarErrors(sentence, parsed);

    return c.json({
      data: {
        parsed,
        errors,
        suggestions: errors.map((e) => e.suggestion),
      },
    });
  } catch (error) {
    console.error('Grammar parse error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/grammar/exercise — Submit grammar exercise answer
grammarRoutes.post('/exercise', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  const { exerciseId, answer, correct } = await c.req.json();

  try {
    await db.run(
      `INSERT INTO grammar_exercises (id, user_id, exercise_id, answer, correct, answered_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [crypto.randomUUID(), userId, exerciseId, answer, correct ? 1 : 0]
    );

    // Update mastery
    const category = await db.get<Record<string, unknown>>(
      `SELECT module FROM lessons WHERE id = ?`,
      [exerciseId]
    );

    if (category) {
      await db.run(
        `INSERT INTO grammar_mastery (user_id, category, total_attempts, correct_attempts)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(user_id, category) DO UPDATE SET
           total_attempts = total_attempts + 1,
           correct_attempts = CASE WHEN ? = 1 THEN correct_attempts + 1 ELSE correct_attempts END,
           updated_at = datetime('now')`,
        [userId, category.module, correct ? 1 : 0, correct ? 1 : 0]
      );
    }

    return c.json({ data: { success: true, correct } });
  } catch (error) {
    console.error('Grammar exercise error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/grammar/mastery — Get grammar mastery by category
grammarRoutes.get('/mastery', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const mastery = await db.query<Record<string, unknown>>(
      `SELECT * FROM grammar_mastery WHERE user_id = ?`,
      [userId]
    );

    return c.json({
      data: mastery.map((m) => ({
        category: m.category,
        masteryLevel: m.mastery_level,
        totalAttempts: m.total_attempts,
        correctAttempts: m.correct_attempts,
        percentage: (m.total_attempts as number) > 0
          ? Math.round(((m.correct_attempts as number) / (m.total_attempts as number)) * 100)
          : 0,
      })),
    });
  } catch (error) {
    console.error('Grammar mastery error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ── Corpus-derived endpoints ────────────────────────────────────────────────
//
// Everything below reads the Quranic Arabic Corpus rather than authored content,
// which is the point: the facts are checkable against source data, and no model
// is involved in producing them (plan §F8 — "the model only narrates it").
//
// These became possible only after migration 0012. Before it the corpus was
// stored one row per WORD instead of per segment, so 40% of rows were missing
// and root 'qmr' did not exist in the table at all.
//
// ATTRIBUTION: Quranic Arabic Corpus v0.4, Kais Dukes, GNU GPL. Callers must
// surface the corpus.quran.com link — it is returned in `attribution` so the UI
// cannot forget it (plan risk R3).

const CORPUS_ATTRIBUTION = {
  source: 'Quranic Arabic Corpus (v0.4)',
  url: 'https://corpus.quran.com',
  licence: 'GNU GPL',
};

// GET /api/grammar/root/:root — the family for one root, in Arabic script.
// Buckwalter in, Arabic out; the corpus stores ASCII and a learner cannot read it.
grammarRoutes.get('/root/:root', async (c) => {
  const { root } = c.req.param();
  const db = getDb(c);

  try {
    const rows = await db.query<MorphRow>(
      `SELECT lemma, root, pos, verb_form, aspect, voice, case_case, gender, number, person
       FROM quran_word_morphology
       WHERE root = ?`,
      [root]
    );

    if (rows.length === 0) {
      // Honest 404. 58% of segments carry no root at all, and inventing a family
      // for an unattested root is exactly the failure F8 exists to avoid.
      return c.json(
        { error: `No occurrences of root "${root}" in the corpus`, attribution: CORPUS_ATTRIBUTION },
        404
      );
    }

    const family = buildFamily(root, rows);
    return c.json({ data: family, drills: drillsFromFamily(family), attribution: CORPUS_ATTRIBUTION });
  } catch (error) {
    console.error('Root family error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/grammar/drills/forms — pattern drills (F9), derived not authored.
// Only roots attesting 2+ forms yield a drill, so distractors are always real.
grammarRoutes.get('/drills/forms', async (c) => {
  const db = getDb(c);
  const limit = Math.min(Number(c.req.query('limit') ?? 20) || 20, 100);

  try {
    const candidates = await db.query<{ root: string }>(
      `SELECT root FROM quran_word_morphology
       WHERE verb_form IS NOT NULL AND root IS NOT NULL
       GROUP BY root
       HAVING COUNT(DISTINCT verb_form) > 1
       ORDER BY COUNT(*) DESC
       LIMIT ?`,
      [limit]
    );

    const drills = [];
    for (const { root } of candidates) {
      const rows = await db.query<MorphRow>(
        `SELECT lemma, root, pos, verb_form, aspect, voice, case_case, gender, number, person
         FROM quran_word_morphology WHERE root = ?`,
        [root]
      );
      drills.push(...drillsFromFamily(buildFamily(root, rows)));
    }

    return c.json({ data: drills, attribution: CORPUS_ATTRIBUTION });
  } catch (error) {
    console.error('Form drills error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/grammar/exercises?level=&kind=&limit=
//
// The derived exercise bank: 780 items across 5 kinds and 5 levels, every one
// generated from a corpus row and carrying its source location, so a wrong item
// can be traced and disproved. Levels come from root frequency — a word from a
// root occurring 300+ times is a level 1 question.
grammarRoutes.get('/exercises', async (c) => {
  const db = getDb(c);
  const level = c.req.query('level');
  const kind = c.req.query('kind');
  const limit = Math.min(Number(c.req.query('limit') ?? 10) || 10, 50);

  const where: string[] = [];
  const params: unknown[] = [];
  if (level) {
    const n = Number(level);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return c.json({ error: 'level must be an integer 1–5' }, 400);
    }
    where.push('level = ?');
    params.push(n);
  }
  if (kind) {
    const allowed = ['verb_form', 'case_ending', 'root_id', 'pos_id', 'aspect', 'word_meaning', 'find_word'];
    if (!allowed.includes(kind)) {
      return c.json({ error: `kind must be one of ${allowed.join(', ')}` }, 400);
    }
    where.push('kind = ?');
    params.push(kind);
  }

  try {
    const rows = await db.query<Record<string, unknown>>(
      `SELECT id, kind, level, word_arabic, prompt, answer, options, explanation,
              surah_id, ayah_id, root
       FROM grammar_exercise_bank
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY level ASC, id ASC
       LIMIT ?`,
      [...params, limit]
    );

    return c.json({
      data: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        level: r.level,
        word: r.word_arabic,
        prompt: r.prompt,
        answer: r.answer,
        options: JSON.parse((r.options as string) ?? '[]'),
        explanation: r.explanation,
        // Provenance travels with the item so the UI can cite it.
        source: `${r.surah_id}:${r.ayah_id}`,
        root: r.root,
      })),
      attribution: CORPUS_ATTRIBUTION,
    });
  } catch (error) {
    console.error('Exercise bank error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

