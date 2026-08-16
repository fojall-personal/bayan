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
import { stripFinalHarakat } from '../lib/tashkil';
import { gradeIrabParse, loadIrabParse, pickIrabParse, sampleGovernor } from '../lib/governor';
import { sampleHomograph } from '../lib/homograph';
import type {
  GrammarExerciseBankRow,
  GrammarMasteryRow,
  LessonsRow,
  QuranVersesRow,
  QuranWordMorphologyRow,
} from '../db/schema';

export const grammarRoutes = new Hono<AppEnv>();

// GET /api/grammar/deepdive/:category — Get deep-dive content for nahw/sarf/balagha
//
// The category used to be read from the path, used for the mastery lookup, and then
// ignored by the lesson query, which asked for `module = 'grammar'`. All three tabs
// therefore returned byte-identical lists of all 418 lessons — 823 KB each, of which 408
// were generated root-vocabulary lessons — and "Rhetoric" returned 418 lessons with no
// rhetoric in them. Verified before fixing: the three responses matched exactly.
grammarRoutes.get('/deepdive/:category', async (c) => {
  const { category } = c.req.param();
  const userId = c.get('userId');
  const db = getDb(c);

  // Validated rather than interpolated hopefully. An unknown category previously returned
  // the full lesson list, so a typo in a link looked like a working page.
  const CATEGORIES = ['nahw', 'sarf', 'balagha', 'vocabulary'];
  if (!CATEGORIES.includes(category)) {
    return c.json({ error: `category must be one of ${CATEGORIES.join(', ')}` }, 400);
  }

  try {
    const mastery = await db.get<GrammarMasteryRow>(
      `SELECT * FROM grammar_mastery WHERE user_id = ? AND category = ?`,
      [userId, category]
    );

    const lessons = await db.query<LessonsRow>(
      `SELECT * FROM lessons WHERE category = ? AND level >= ? ORDER BY level ASC`,
      [category, (mastery?.mastery_level as number) || 1]
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
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400);
  }
  const { sentence } = body as { sentence?: unknown };

  if (typeof sentence !== 'string' || sentence.trim().length === 0) {
    return c.json(
      { error: "Validation failed: 'sentence' is required and must be a non-empty string" },
      400
    );
  }

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
    const category =
      fromBank?.kind ??
      fromLesson?.module ??
      (typeof exerciseId === 'string' && exerciseId.startsWith('elided:')
        ? 'elided_subject'
        : typeof exerciseId === 'string' && exerciseId.startsWith('governor:')
          ? 'governor'
          : typeof exerciseId === 'string' && exerciseId.startsWith('homograph:')
            ? 'homograph'
            : typeof exerciseId === 'string' && exerciseId.startsWith('irab_parse:case:')
              ? 'case_ending'
              : typeof exerciseId === 'string' && exerciseId.startsWith('irab_parse:governor:')
                ? 'governor'
                : typeof exerciseId === 'string' && exerciseId.startsWith('irab_parse:elision:')
                  ? 'elided_subject'
                  : null);

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

const TREEBANK_ATTRIBUTION = {
  source: 'Extended Quranic Treebank (Nashir et al., Data in Brief 62:111940, 2025)',
  url: 'https://doi.org/10.1016/j.dib.2025.111940',
  licence: 'CC BY 4.0',
};

/** Closed set the treebank actually reconstructs. Never invent a pronoun. */
const ELIDED_PRONOUNS = ['هُوَ', 'هِيَ', 'أَنْتَ', 'أَنْتُمْ', 'أنا', 'نحْنُ', 'هم'];

function bareElidedToken(token: string): string {
  return token.replace(/[()*]/g, '').trim();
}

export interface ElidedSubjectItem {
  id: string;
  kind: 'elided_subject';
  prompt: string;
  word: string;
  answer: string;
  options: string[];
  explanation: string;
  source: string;
  ayahText: string | null;
}

/**
 * One elided-subject item, live from quran_syntax.
 *
 * The answer is the treebank's own reconstructed token. Distractors are other
 * tokens that same table actually reconstructs — a closed set, not invented
 * grammar. There is no morphology row to concur with (the token was never
 * written), so this is the bound: we only ask what the treebank already states.
 */
async function sampleElidedSubject(
  db: Database,
  limit: number
): Promise<ElidedSubjectItem[]> {
  const rows = await db.query<{
    sentence_id: number;
    token_index: number;
    surah_id: number;
    ayah_id: number;
    token: string;
    head_word: number | null;
    ayah_text: string | null;
  }>(
    `SELECT e.sentence_id, e.token_index, e.surah_id, e.ayah_id, e.token,
            h.word_index AS head_word,
            q.text_uthmani AS ayah_text
       FROM quran_syntax e
       LEFT JOIN quran_syntax h
         ON h.sentence_id = e.sentence_id AND h.token_index = e.head_index
       LEFT JOIN quran_verses q ON q.surah = e.surah_id AND q.ayah = e.ayah_id
      WHERE e.is_implied = 1
        AND e.rel = 'Subj'
        AND e.token IS NOT NULL
        AND e.token NOT IN ('', '(*)')
      ORDER BY RANDOM()
      LIMIT ?`,
    [limit]
  );

  return rows.flatMap((row) => {
    const answer = bareElidedToken(row.token);
    if (!answer) return [];
    const others = ELIDED_PRONOUNS.filter((p) => p !== answer);
    const options = [answer, ...others.slice(0, 3)];
    // Deterministic-enough shuffle from the location so the same item
    // does not always put the answer first.
    const seed = row.surah_id * 1000 + row.ayah_id + row.token_index;
    for (let i = options.length - 1; i > 0; i--) {
      const j = (seed + i * 17) % (i + 1);
      [options[i], options[j]] = [options[j], options[i]];
    }
    return [
      {
        id: `elided:${row.surah_id}:${row.ayah_id}:${row.token_index}`,
        kind: 'elided_subject' as const,
        prompt:
          'This verb has an unwritten subject (فاعل محذوف). Which pronoun does the treebank reconstruct?',
        word: answer,
        answer,
        options,
        explanation: `The treebank reconstructs ${answer} as the elided فاعل at ${row.surah_id}:${row.ayah_id}. The pronoun is not on the page.`,
        source: `${row.surah_id}:${row.ayah_id}`,
        ayahText: row.ayah_text,
      },
    ];
  });
}

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
    // Everything past the first seven reads annotation the ingest had captured and the
    // generator never used — roughly 108,000 facts sitting idle. Count is stated where
    // it's checked, not here — this comment already went stale once ("Seventeen kinds"
    // sat here after the bank had grown to 25), and gen-content-manifest.mjs --check
    // now gates the kind-count claim in prose, which this comment format defeats.
    const allowed = [
      'verb_form', 'case_ending', 'root_id', 'pos_id', 'aspect', 'word_meaning',
      'find_word', 'definiteness', 'negation', 'mood', 'voice', 'subject_agreement',
      'word_role', 'relative_pronoun', 'demonstrative', 'conditional',
      'sentence_type',
      // From the treebank's syntax layer, each emitted only where a relation and the
      // hand-verified case concur — see scripts/gen-syntax-exercises.mjs.
      'mubtada_khabar', 'subject_word', 'object', 'idafa', 'derived_noun', 'fronting',
      // Paronomasia — ARDT device CA-1. From roots, so hand-verified.
      'jinas', 'simile',
      // One spelling, several jobs — the answer is the hand-verified pos tag, and the
      // distractors are roles that same spelling genuinely takes elsewhere.
      'homograph',
      // Two near-identical ayahs, one word apart — auto-detected by edit distance.
      // See scripts/find-mutashabihat.mjs and gen-mutashabihat-exercises.mjs.
      'mutashabihat',
      // Implied فاعل — generated where the treebank token concurs with the
      // head verb's hand-verified PNG. See scripts/gen-syntax-exercises.mjs.
      'elided_subject',
      // Token ʿāmil — live from quran_syntax + morphology (same emit rule as F1).
      'governor',
    ];
    if (!allowed.includes(kind)) {
      return c.json({ error: `kind must be one of ${allowed.join(', ')}` }, 400);
    }
    where.push('kind = ?');
    params.push(kind);
  }

  try {
    if (kind === 'governor') {
      const items = await sampleGovernor(db, limit);
      return c.json({
        data: items.map((item) => ({
          id: item.id,
          kind: item.kind,
          level: 1,
          word: item.word,
          prompt: item.prompt,
          answer: item.answer,
          options: item.options,
          explanation: item.explanation,
          source: item.source,
          root: null,
          ayahText: item.ayahText,
        })),
        attribution: TREEBANK_ATTRIBUTION,
      });
    }

    const rows = await db.query<Pick<GrammarExerciseBankRow, 'id' | 'kind' | 'level' | 'word_arabic' | 'prompt' | 'answer' | 'options' | 'explanation' | 'surah_id' | 'ayah_id' | 'root'>>(
      `SELECT id, kind, level, word_arabic, prompt, answer, options, explanation,
              surah_id, ayah_id, root
       FROM grammar_exercise_bank
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY ${c.req.query('random') === '1' ? 'RANDOM()' : 'level ASC, id ASC'}
       LIMIT ?`,
      [...params, limit]
    );

    if (kind === 'homograph' && rows.length === 0) {
      const items = await sampleHomograph(db, limit);
      return c.json({
        data: items.map((item) => ({
          id: item.id,
          kind: item.kind,
          level: 1,
          word: item.word,
          prompt: item.prompt,
          answer: item.answer,
          options: item.options,
          explanation: item.explanation,
          source: item.source,
          root: null,
        })),
        attribution: CORPUS_ATTRIBUTION,
      });
    }

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

// GET /api/grammar/governor — one token-ʿāmil item, live from the treebank.
grammarRoutes.get('/governor', async (c) => {
  const db = getDb(c);
  try {
    const items = await sampleGovernor(db, 1);
    if (items.length === 0) {
      return c.json({ data: null, attribution: TREEBANK_ATTRIBUTION });
    }
    return c.json({ data: items[0], attribution: TREEBANK_ATTRIBUTION });
  } catch (error) {
    console.error('Governor error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/grammar/irab-parse — one cold ayah, not mastered in ḥifẓ.
grammarRoutes.get('/irab-parse', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  try {
    const item = await pickIrabParse(db, userId);
    return c.json({ data: item, attribution: TREEBANK_ATTRIBUTION });
  } catch (error) {
    console.error('Irab-parse get error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/grammar/irab-parse — grade case + governor (+ elision) and persist.
grammarRoutes.post('/irab-parse', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  try {
    const body = (await c.req.json()) as {
      surah?: unknown;
      ayah?: unknown;
      answers?: unknown;
      elision?: unknown;
    };
    const surah = Number(body.surah);
    const ayah = Number(body.ayah);
    if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1) {
      return c.json({ error: 'Expected surah 1–114 and a positive ayah' }, 400);
    }
    const item = await loadIrabParse(db, surah, ayah);
    if (!item) {
      return c.json({ error: 'No concur-safe parse for that ayah' }, 404);
    }
    const answers = Array.isArray(body.answers)
      ? body.answers
          .filter((a): a is { wordIndex: number; caseCase?: string; governor?: string } =>
            Boolean(a && typeof a === 'object' && Number.isInteger((a as { wordIndex?: unknown }).wordIndex))
          )
          .map((a) => ({
            wordIndex: a.wordIndex,
            caseCase: typeof a.caseCase === 'string' ? a.caseCase : undefined,
            governor: typeof a.governor === 'string' ? a.governor : undefined,
          }))
      : [];
    const elision = typeof body.elision === 'string' ? body.elision : undefined;
    const result = await gradeIrabParse(db, item, { surah, ayah, answers, elision });
    for (const w of result.words) {
      if (w.caseOk !== null) {
        await db.run(
          `INSERT INTO grammar_exercises (id, user_id, exercise_id, answer, correct, answered_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          [
            crypto.randomUUID(),
            userId,
            `irab_parse:case:${surah}:${ayah}:${w.wordIndex}`,
            answers.find((a) => a.wordIndex === w.wordIndex)?.caseCase ?? '',
            w.caseOk ? 1 : 0,
          ]
        );
      }
      if (w.governorOk !== null) {
        await db.run(
          `INSERT INTO grammar_exercises (id, user_id, exercise_id, answer, correct, answered_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          [
            crypto.randomUUID(),
            userId,
            `irab_parse:governor:${surah}:${ayah}:${w.wordIndex}`,
            answers.find((a) => a.wordIndex === w.wordIndex)?.governor ?? '',
            w.governorOk ? 1 : 0,
          ]
        );
      }
    }
    if (result.elisionCorrect !== null) {
      await db.run(
        `INSERT INTO grammar_exercises (id, user_id, exercise_id, answer, correct, answered_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [
          crypto.randomUUID(),
          userId,
          `irab_parse:elision:${surah}:${ayah}`,
          elision ?? '',
          result.elisionCorrect,
        ]
      );
    }
    return c.json({ data: result, attribution: TREEBANK_ATTRIBUTION });
  } catch (error) {
    console.error('Irab-parse post error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/grammar/elided — one implied-فاعل item, live from the treebank table.
grammarRoutes.get('/elided', async (c) => {
  const db = getDb(c);
  try {
    const items = await sampleElidedSubject(db, 1);
    if (items.length === 0) {
      return c.json({ data: null, attribution: TREEBANK_ATTRIBUTION });
    }
    return c.json({ data: items[0], attribution: TREEBANK_ATTRIBUTION });
  } catch (error) {
    console.error('Elided subject error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/grammar/tashkil?surah=&ayah= — case-ending production items.
//
// The final diacritic of each word IS the answer being asked for, so it never
// rides along in this response — only the stripped prompt and the case_case
// metadata a client-side explanation can cite. Compare against gen-exercise-bank
// style endpoints above, which return `answer` directly: those are recognition
// items where the options are already visible, so the answer riding along costs
// nothing. This is a production item — handing over the answer here would let a
// learner "solve" it by reading the response instead of restoring the ending.
grammarRoutes.get('/tashkil', async (c) => {
  const surah = Number(c.req.query('surah'));
  const ayah = Number(c.req.query('ayah'));

  if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1) {
    return c.json({ error: 'Expected surah 1–114 and a positive ayah' }, 400);
  }

  const db = getDb(c);

  try {
    const verse = await db.get<Pick<QuranVersesRow, 'text_uthmani'>>(
      `SELECT text_uthmani FROM quran_verses WHERE surah = ? AND ayah = ?`,
      [surah, ayah]
    );
    if (!verse) {
      return c.json({ error: 'No verse ingested for this surah/ayah' }, 404);
    }

    const words = verse.text_uthmani.trim().split(/\s+/).filter(Boolean);

    // One case_case per word, from whichever segment carries it. A prefixed word
    // (وَ, بِ, لِ...) splits into a particle segment with no case and a stem
    // segment that has one; at most one segment per word_index is ever non-null.
    const morphRows = await db.query<Pick<QuranWordMorphologyRow, 'word_index' | 'case_case'>>(
      `SELECT word_index, case_case FROM quran_word_morphology
       WHERE surah_id = ? AND ayah_id = ? AND case_case IS NOT NULL`,
      [surah, ayah]
    );
    const caseByWord = new Map(morphRows.map((r) => [r.word_index, r.case_case]));

    return c.json({
      data: {
        surah,
        ayah,
        words: words.map((w, i) => ({
          index: i + 1,
          // The stripped form to show and complete — never the original word.
          prompt: stripFinalHarakat(w),
          // null for a word with no case ending (particles, mabni words) — the
          // UI shows the tap palette only where there is an ending to restore.
          caseCase: caseByWord.get(i + 1) ?? null,
        })),
      },
      attribution: CORPUS_ATTRIBUTION,
    });
  } catch (error) {
    console.error('Tashkil error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/grammar/tashkil — grade restored case endings against the real text.
//
// The GET endpoint above never sends the answer key, so grading has to happen
// here, server-side, against the same quran_verses row. Body:
// { surah, ayah, answers: { [wordIndex]: reconstructedWord } }. Only words the
// caller actually answered are graded — a word with no case ending was never
// offered a palette in the UI, so it is never a candidate.
grammarRoutes.post('/tashkil', async (c) => {
  const body = await c.req.json();
  const surah = Number(body.surah);
  const ayah = Number(body.ayah);
  const answers = body.answers;

  if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1) {
    return c.json({ error: 'Expected surah 1–114 and a positive ayah' }, 400);
  }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return c.json({ error: 'answers must be an object of wordIndex -> reconstructed word' }, 400);
  }

  const db = getDb(c);

  try {
    const verse = await db.get<Pick<QuranVersesRow, 'text_uthmani'>>(
      `SELECT text_uthmani FROM quran_verses WHERE surah = ? AND ayah = ?`,
      [surah, ayah]
    );
    if (!verse) {
      return c.json({ error: 'No verse ingested for this surah/ayah' }, 404);
    }

    const words = verse.text_uthmani.trim().split(/\s+/).filter(Boolean);

    const results: { index: number; correct: boolean; correctWord?: string }[] = [];
    for (const [key, given] of Object.entries(answers)) {
      const idx = Number(key);
      if (!Number.isInteger(idx) || idx < 1 || idx > words.length) continue;
      const real = words[idx - 1];
      const correct = given === real;
      // The correct form is revealed only for a miss — this is post-submission
      // feedback (the learner already committed an answer), not the prompt.
      results.push(correct ? { index: idx, correct } : { index: idx, correct, correctWord: real });
    }
    results.sort((a, b) => a.index - b.index);
    const correctCount = results.filter((r) => r.correct).length;

    const userId = c.get('userId');
    if (userId) {
      for (const r of results) {
        await db.run(
          `INSERT INTO grammar_exercises (user_id, exercise_id, answer, correct)
           VALUES (?, ?, ?, ?)`,
          [
            userId,
            `tashkil:${surah}:${ayah}:${r.index}`,
            String((answers as Record<string, unknown>)[String(r.index)] ?? ''),
            r.correct ? 1 : 0,
          ]
        );
      }
    }

    return c.json({
      data: {
        results,
        correctCount,
        total: results.length,
        accuracy: results.length === 0 ? 0 : correctCount / results.length,
      },
    });
  } catch (error) {
    console.error('Tashkil grading error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

