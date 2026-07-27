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
import type {
  GrammarExerciseBankRow,
  GrammarMasteryRow,
  LessonsRow,
} from '../db/schema';

export const grammarRoutes = new Hono<AppEnv>();

// GET /api/grammar/deepdive/:category — Get deep-dive content for nahw/sarf/balagha
grammarRoutes.get('/deepdive/:category', async (c) => {
  const { category } = c.req.param();
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const mastery = await db.get<GrammarMasteryRow>(
      `SELECT * FROM grammar_mastery WHERE user_id = ? AND category = ?`,
      [userId, category]
    );

    const lessons = await db.query<LessonsRow>(
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
    // Which category this attempt counts toward.
    //
    // This used to be `SELECT module FROM lessons WHERE id = ?` against the EXERCISE
    // id. Bank ids look like `aspect-2-8-4-1` and lesson ids like `grammar-01`, so
    // the join returned zero rows for every attempt — measured, not assumed — the
    // `if (category)` guard then swallowed it, and grammar_mastery was never written
    // once. The kind is what the bank actually groups by, so ask the bank first.
    const fromBank = await db.get<{ kind: string }>(
      `SELECT kind FROM grammar_exercise_bank WHERE id = ?`,
      [exerciseId]
    );
    // Retained so lesson-driven attempts still record: the same endpoint is reachable
    // with a lesson id, and silently dropping those would repeat the original bug.
    const fromLesson = fromBank
      ? null
      : await db.get<{ module: string }>(`SELECT module FROM lessons WHERE id = ?`, [
          exerciseId,
        ]);
    const category = fromBank?.kind ?? fromLesson?.module ?? null;

    // Fail loudly on an id that matches nothing.
    //
    // The original bug survived because an unresolvable id was swallowed by
    // `if (category)` — the attempt row was written, the mastery row was not, and
    // nothing anywhere said so. A 400 here would have surfaced it on the first
    // request instead of never.
    if (!category) {
      return c.json(
        {
          error: `Unknown exerciseId "${exerciseId}" — matches no row in grammar_exercise_bank or lessons`,
        },
        400
      );
    }

    // Both writes happen only once the id is known good. Inserting the attempt first
    // meant a rejected id still left a row in grammar_exercises with no matching
    // mastery update — a partial write, which is how the counts would drift apart.
    await db.run(
      `INSERT INTO grammar_exercises (id, user_id, exercise_id, answer, correct, answered_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [crypto.randomUUID(), userId, exerciseId, answer, correct ? 1 : 0]
    );

    {
      await db.run(
        `INSERT INTO grammar_mastery
           (user_id, category, total_attempts, correct_attempts, mastery_level)
         VALUES (?, ?, 1, ?, 1)
         ON CONFLICT(user_id, category) DO UPDATE SET
           total_attempts   = total_attempts + 1,
           correct_attempts = correct_attempts + ?,
           -- Derived, so the column stops being a lie. It defaulted to 1 and was
           -- never updated, which meant the endpoint reported masteryLevel: 1 for
           -- everyone forever. Five attempts minimum before it can rise above 1 —
           -- three right answers out of three is not mastery of a 750-item kind.
           mastery_level    = CASE
             WHEN total_attempts + 1 < 5 THEN 1
             ELSE MIN(5, 1 + CAST(
               ((correct_attempts + ?) * 4.0) / (total_attempts + 1) AS INTEGER))
           END,
           updated_at = datetime('now')`,
        [
          userId,
          category,
          correct ? 1 : 0,
          correct ? 1 : 0,
          correct ? 1 : 0,
        ]
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
    const mastery = await db.query<GrammarMasteryRow>(
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
    const rows = await db.query<Pick<GrammarExerciseBankRow, 'id' | 'kind' | 'level' | 'word_arabic' | 'prompt' | 'answer' | 'options' | 'explanation' | 'surah_id' | 'ayah_id' | 'root'>>(
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

