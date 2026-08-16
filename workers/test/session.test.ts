/**
 * Mixed session planner and recorder.
 *
 * Hits the real Worker + real migrations (including 0027_user_sessions).
 * The load-bearing cases are: plan reuse, empty plans not persisted, and
 * complete actually moving FSRS state — a journal-only complete would leave
 * tomorrow's queue unchanged.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { harness, TEST_USER, type Harness } from './helpers/harness';

let h: Harness | null = null;
afterEach(() => {
  h?.close();
  h = null;
});
const H = () => (h ??= harness());

interface SessionItem {
  id: string;
  type:
    | 'hifz'
    | 'vocabulary'
    | 'lesson'
    | 'function_word'
    | 'intensive'
    | 'production'
    | 'elided'
    | 'freeflow'
    | 'root_lesson'
    | 'root_type'
    | 'governor'
    | 'irab_parse'
    | 'mutashabihat';
  label: string;
  estimatedSeconds: number;
  payload: Record<string, unknown>;
}

interface SessionPlan {
  sessionId: string;
  items: SessionItem[];
  plannedSeconds: number;
  summary: {
    hifz: number;
    vocabulary: number;
    lesson: number;
    function_word: number;
    intensive: number;
    production: number;
    elided: number;
    freeflow: number;
  };
}

function insertDueHifz(id = crypto.randomUUID(), ayah = 1) {
  H()
    .db.prepare(
      `INSERT INTO memorization (
         id, user_id, surah_id, ayah_from, ayah_to, status,
         next_review, quality, revision_count
       ) VALUES (?, ?, 1, ?, ?, 'learning', datetime('now', '-1 day'), 0, 0)`
    )
    .run(id, TEST_USER, ayah, ayah);
  return id;
}

function insertDueVocab(word = 'كتب') {
  H()
    .db.prepare(
      `INSERT INTO vocabulary_mastery (word, user_id, meaning_known, reading_known, next_review, reviews)
       VALUES (?, ?, 0, 0, datetime('now', '-1 day'), 0)`
    )
    .run(word, TEST_USER);
  return word;
}

function setBand(band: string) {
  H()
    .db.prepare(`UPDATE users SET current_band = ?, band_source = 'manual' WHERE id = ?`)
    .run(band, TEST_USER);
}

describe('GET /api/session/plan', () => {
  it('answers 200 with the daily loop when nothing is due', async () => {
    setBand('alfiyya');
    const { status, body } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
    expect(body.data.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(body.data.summary.hifz).toBe(0);
    expect(body.data.summary.vocabulary).toBe(0);
    expect(body.data.summary.production).toBe(1);
    expect(body.data.summary.freeflow).toBe(1);
    expect(body.data.items.length).toBeGreaterThan(0);
  });

  it('omits hifz, elided, and production from a foundation loop', async () => {
    setBand('foundation');
    insertDueHifz();
    const { body } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    const types = body.data.items.map((i) => i.type);
    expect(types).not.toContain('hifz');
    expect(types).not.toContain('elided');
    expect(types).not.toContain('production');
    expect(types).not.toContain('root_lesson');
    expect(types).not.toContain('governor');
    expect(types).not.toContain('irab_parse');
    expect(types).not.toContain('mutashabihat');
  });

  it('includes mutashabihat when the bank has a pair, except in Foundation', async () => {
    H()
      .db.prepare(
        `INSERT INTO grammar_exercise_bank
           (id, kind, level, word_arabic, prompt, answer, options, explanation,
            surah_id, ayah_id, word_index, segment_index)
         VALUES ('mutashabihat-27-81-30-53', 'mutashabihat', 5, 'وَمَآ',
                 'Which of these is the real text of 27:81?',
                 'وَمَآ أَنتَ بِهَٰدِى ٱلْعُمْىِ',
                 '["a","b"]', 'e', 27, 81, 1, 1)`
      )
      .run();

    setBand('foundation');
    const foundation = await H().json<{ data: SessionPlan }>('/api/session/plan');
    expect(foundation.body.data.items.map((i) => i.type)).not.toContain('mutashabihat');

    H().db.prepare(`DELETE FROM user_sessions`).run();
    setBand('alfiyya');
    const alfiyya = await H().json<{ data: SessionPlan }>('/api/session/plan');
    expect(alfiyya.body.data.items.filter((i) => i.type === 'mutashabihat')).toHaveLength(1);
  });

  it('includes one root_lesson in ajurrumiyya when a next-root lesson exists', async () => {
    setBand('ajurrumiyya');
    H()
      .db.prepare(
        `INSERT INTO quran_word_morphology
           (surah_id, ayah_id, word_index, segment_index, form, tag, pos, root)
         VALUES (1, 1, 1, 1, 'qAla', 'V', 'V', 'qwl')`
      )
      .run();
    H()
      .db.prepare(
        `INSERT INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes)
         VALUES ('root-qwl', 'The root qwl', 'grammar', 1, '{}', '[]', '[]', 10)`
      )
      .run();
    const { body } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    expect(body.data.items.filter((i) => i.type === 'root_lesson')).toHaveLength(1);
    expect(body.data.items.some((i) => i.type === 'lesson')).toBe(false);
  });

  it('leads a Qaṭr sitting with the book dars, then the particle, then the root', async () => {
    setBand('qatr');
    const db = H().db;
    db.prepare(
      `INSERT INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes)
       VALUES ('grammar-04', 'Present', 'grammar', 2, '{}', '[]', '[]', 10)`
    ).run();
    db.prepare(
      `INSERT INTO quran_word_morphology
         (surah_id, ayah_id, word_index, segment_index, form, tag, pos, lemma, root)
       VALUES (1, 1, 1, 1, 'min', 'P', 'P', 'min', NULL)`
    ).run();
    db.prepare(
      `INSERT INTO quran_word_morphology
         (surah_id, ayah_id, word_index, segment_index, form, tag, pos, root)
       VALUES (1, 2, 1, 1, 'qAla', 'V', 'V', 'qwl')`
    ).run();
    db.prepare(
      `INSERT INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes)
       VALUES ('root-qwl', 'The root qwl', 'grammar', 1, '{}', '[]', '[]', 10)`
    ).run();
    const { body } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    const types = body.data.items.map((i) => i.type);
    expect(types.indexOf('lesson')).toBeGreaterThanOrEqual(0);
    expect(types.indexOf('function_word')).toBeGreaterThan(types.indexOf('lesson'));
    expect(types.indexOf('root_lesson')).toBeGreaterThan(types.indexOf('function_word'));
    expect(body.data.items.find((i) => i.type === 'lesson')?.payload.lessonId).toBe(
      'grammar-04'
    );
  });

  it('persists a loop-only plan so complete can find it', async () => {
    setBand('alfiyya');
    await H().json<{ data: SessionPlan }>('/api/session/plan');
    const row = H().db.prepare('SELECT COUNT(*) AS n FROM user_sessions').get() as { n: number };
    expect(row.n).toBe(1);
  });

  it('includes due hifz spans when they exist', async () => {
    setBand('alfiyya');
    insertDueHifz();

    const { status, body } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    expect(status).toBe(200);
    expect(body.data.summary.hifz).toBeGreaterThanOrEqual(1);
    const hifz = body.data.items.filter((i) => i.type === 'hifz');
    expect(hifz.length).toBeGreaterThanOrEqual(1);
    expect(hifz[0].payload).toMatchObject({
      surahId: 1,
      ayahFrom: 1,
      ayahTo: 1,
    });
    expect(hifz[0].estimatedSeconds).toBeGreaterThan(0);
  });

  it('includes due vocabulary with a meaning field when it exists', async () => {
    insertDueVocab('كتب');
    H()
      .db.prepare(
        `INSERT INTO vocabulary (word, transliteration, meaning, root, frequency_rank)
         VALUES ('كتب', 'kutub', 'books', 'ktb', 1)`
      )
      .run();

    const { status, body } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    expect(status).toBe(200);
    expect(body.data.summary.vocabulary).toBeGreaterThanOrEqual(1);
    const vocab = body.data.items.filter((i) => i.type === 'vocabulary');
    const card = vocab.find((v) => v.payload.word === 'كتب');
    expect(card).toBeTruthy();
    expect(card?.payload.meaning).toBe('books');
  });

  it('includes the next incomplete lesson when lessons exist', async () => {
    H()
      .db.prepare(
        `INSERT INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes)
         VALUES ('grammar-01', 'Articles', 'grammar', 1, '{}', '[]', '[]', 10)`
      )
      .run();

    const { status, body } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    expect(status).toBe(200);
    expect(body.data.summary.lesson).toBe(1);
    const lesson = body.data.items.find((i) => i.type === 'lesson');
    expect(lesson?.payload.lessonId).toBe('grammar-01');
  });

  it('reuses today\'s open session instead of inserting another', async () => {
    setBand('alfiyya');
    insertDueHifz();
    const first = await H().json<{ data: SessionPlan }>('/api/session/plan');
    const second = await H().json<{ data: SessionPlan }>('/api/session/plan');
    expect(second.body.data.sessionId).toBe(first.body.data.sessionId);
    const row = H().db.prepare('SELECT COUNT(*) AS n FROM user_sessions').get() as { n: number };
    expect(row.n).toBe(1);
  });

  it('respects the time budget (does not return an unbounded list)', async () => {
    setBand('alfiyya');
    const db = H().db;
    for (let i = 1; i <= 12; i++) {
      db.prepare(
        `INSERT INTO memorization (
           id, user_id, surah_id, ayah_from, ayah_to, status,
           next_review, quality, revision_count
         ) VALUES (?, ?, 2, ?, ?, 'learning', datetime('now', '-1 day'), 0, 0)`
      ).run(crypto.randomUUID(), TEST_USER, i, i);
    }

    const { body } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    expect(body.data.items.length).toBeLessThanOrEqual(16);
    expect(body.data.plannedSeconds).toBeLessThanOrEqual(1500 + 180);
  });

  it('puts due hifz before the daily loop', async () => {
    setBand('alfiyya');
    insertDueHifz();
    const { body } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    const types = body.data.items.map((i) => i.type);
    expect(types[0]).toBe('hifz');
    expect(types).toContain('function_word');
    expect(types).toContain('production');
  });

  it('reorders toward particles after that reflection', async () => {
    setBand('alfiyya');
    insertDueHifz();
    const first = await H().json<{ data: SessionPlan }>('/api/session/plan');
    await H().json('/api/session/complete', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: first.body.data.sessionId,
        results: [],
        reflection: 'particles',
      }),
    });
    const second = await H().json<{ data: SessionPlan }>('/api/session/plan');
    const rest = second.body.data.items.filter((i) => i.type !== 'hifz');
    expect(second.body.data.items[0].type).toBe('hifz');
    expect(rest[0].type).toBe('function_word');
  });
});

describe('POST /api/session/complete', () => {
  it('records results, marks the session complete, and advances FSRS', async () => {
    setBand('alfiyya');
    const memId = insertDueHifz();
    const { body: planBody } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    const sessionId = planBody.data.sessionId;
    const hifzItem = planBody.data.items.find((i) => i.type === 'hifz');
    expect(hifzItem).toBeTruthy();

    const before = H()
      .db.prepare('SELECT revision_count, next_review FROM memorization WHERE id = ?')
      .get(memId) as { revision_count: number; next_review: string };

    const { status, body } = await H().json<{
      data: { success: boolean; sessionId: string; applied: { hifz: number } };
    }>('/api/session/complete', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        results: [{ itemId: hifzItem!.id, grade: 'good', seconds: 60 }],
        actualSeconds: 90,
      }),
    });

    expect(status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.sessionId).toBe(sessionId);
    expect(body.data.applied.hifz).toBe(1);

    const row = H()
      .db.prepare(
        'SELECT results, actual_seconds, completed_at FROM user_sessions WHERE id = ?'
      )
      .get(sessionId) as {
        results: string;
        actual_seconds: number | null;
        completed_at: string | null;
      };

    expect(row.completed_at).toBeTruthy();
    expect(row.actual_seconds).toBe(90);

    const after = H()
      .db.prepare('SELECT revision_count, next_review FROM memorization WHERE id = ?')
      .get(memId) as { revision_count: number; next_review: string };
    expect(after.revision_count).toBe(before.revision_count + 1);
    expect(after.next_review).not.toBe(before.next_review);
  });

  it('advances vocabulary FSRS on a graded card', async () => {
    insertDueVocab('كتب');
    const { body: planBody } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    const vocabItem = planBody.data.items.find((i) => i.type === 'vocabulary');
    expect(vocabItem).toBeTruthy();

    const before = H()
      .db.prepare('SELECT reviews FROM vocabulary_mastery WHERE word = ? AND user_id = ?')
      .get('كتب', TEST_USER) as { reviews: number };

    const { status, body } = await H().json<{
      data: { applied: { vocabulary: number } };
    }>('/api/session/complete', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: planBody.data.sessionId,
        results: [{ itemId: vocabItem!.id, grade: 'good', seconds: 40 }],
      }),
    });

    expect(status).toBe(200);
    expect(body.data.applied.vocabulary).toBe(1);
    const after = H()
      .db.prepare('SELECT reviews FROM vocabulary_mastery WHERE word = ? AND user_id = ?')
      .get('كتب', TEST_USER) as { reviews: number };
    expect(after.reviews).toBe(before.reviews + 1);
  });

  it('does not schedule a skipped item (seconds = 0)', async () => {
    setBand('alfiyya');
    const memId = insertDueHifz();
    const { body: planBody } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    const hifzItem = planBody.data.items.find((i) => i.type === 'hifz');

    const { body } = await H().json<{ data: { applied: { hifz: number } } }>(
      '/api/session/complete',
      {
        method: 'POST',
        body: JSON.stringify({
          sessionId: planBody.data.sessionId,
          results: [{ itemId: hifzItem!.id, seconds: 0 }],
        }),
      }
    );

    expect(body.data.applied.hifz).toBe(0);
    const after = H()
      .db.prepare('SELECT revision_count FROM memorization WHERE id = ?')
      .get(memId) as { revision_count: number };
    expect(after.revision_count).toBe(0);
  });

  it('does not re-apply FSRS when ReviewSession already scheduled the item', async () => {
    setBand('alfiyya');
    const memId = insertDueHifz();
    const { body: planBody } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    const hifzItem = planBody.data.items.find((i) => i.type === 'hifz');

    const { body } = await H().json<{ data: { applied: { hifz: number } } }>(
      '/api/session/complete',
      {
        method: 'POST',
        body: JSON.stringify({
          sessionId: planBody.data.sessionId,
          results: [{ itemId: hifzItem!.id, grade: 'good', seconds: 60, scheduled: true }],
        }),
      }
    );
    expect(body.data.applied.hifz).toBe(0);
    const after = H()
      .db.prepare('SELECT revision_count FROM memorization WHERE id = ?')
      .get(memId) as { revision_count: number };
    expect(after.revision_count).toBe(0);
  });

  it('rejects a missing sessionId with 400', async () => {
    const { status, body } = await H().json<{ error: string }>('/api/session/complete', {
      method: 'POST',
      body: JSON.stringify({ results: [] }),
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/sessionId/i);
  });

  it('rejects results that are not an array with 400', async () => {
    setBand('alfiyya');
    insertDueHifz();
    const { body: planBody } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    const { status } = await H().json('/api/session/complete', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: planBody.data.sessionId,
        results: 'not-an-array',
      }),
    });
    expect(status).toBe(400);
  });

  it('returns 404 for an unknown session', async () => {
    const { status } = await H().json('/api/session/complete', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: '00000000-0000-0000-0000-000000000000',
        results: [],
      }),
    });
    expect(status).toBe(404);
  });

  it('returns 409 when the session is already completed', async () => {
    setBand('alfiyya');
    insertDueHifz();
    const { body: planBody } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    const sessionId = planBody.data.sessionId;

    await H().json('/api/session/complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId, results: [] }),
    });

    const { status } = await H().json('/api/session/complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId, results: [] }),
    });
    expect(status).toBe(409);
  });
});

describe('GET /api/grammar/elided', () => {
  it('returns null when the syntax table has no implied subjects', async () => {
    const { status, body } = await H().json<{ data: null }>('/api/grammar/elided');
    expect(status).toBe(200);
    expect(body.data).toBeNull();
  });

  it('returns a treebank token as the answer, not an invented pronoun', async () => {
    const db = H().db;
    db.prepare(
      `INSERT INTO quran_verses (surah, ayah, text_uthmani, text_simple, translation, tajweed_tags)
       VALUES (1, 5, 'إِيَّاكَ نَعْبُدُ', 'اياك نعبد', null, '[]')`
    ).run();
    db.prepare(
      `INSERT INTO quran_syntax (sentence_id, token_index, head_index, surah_id, ayah_id,
         word_index, segment_index, rel, rel_ar, constituent, derived_noun, token, is_implied)
       VALUES (1, 1, NULL, 1, 5, 2, 1, 'root', 'root', NULL, NULL, 'نَعْبُدُ', 0)`
    ).run();
    db.prepare(
      `INSERT INTO quran_syntax (sentence_id, token_index, head_index, surah_id, ayah_id,
         word_index, segment_index, rel, rel_ar, constituent, derived_noun, token, is_implied)
       VALUES (1, 2, 1, 1, 5, 0, 1, 'Subj', 'فاعل', NULL, NULL, '(نحْنُ)', 1)`
    ).run();

    const { status, body } = await H().json<{
      data: { answer: string; options: string[]; id: string };
    }>('/api/grammar/elided');
    expect(status).toBe(200);
    expect(body.data.answer).toBe('نحْنُ');
    expect(body.data.options).toContain('نحْنُ');
    expect(body.data.id).toMatch(/^elided:1:5:/);

    const posted = await H().json('/api/grammar/exercise', {
      method: 'POST',
      body: JSON.stringify({
        exerciseId: body.data.id,
        answer: 'نحْنُ',
        correct: true,
      }),
    });
    expect(posted.status).toBe(200);
  });
});

function seedGovernorFixture() {
  const db = H().db;
  db.prepare(
    `INSERT INTO quran_verses (surah, ayah, text_uthmani, text_simple, translation, tajweed_tags)
     VALUES (1, 2, 'يَعْبُدُ رَبَّهُ يَوْمَئِذٍ كِتَابٌ', 'x', null, '[]')`
  ).run();
  const morph = db.prepare(
    `INSERT INTO quran_word_morphology
       (surah_id, ayah_id, word_index, segment_index, form, pos, case_case)
     VALUES (1, 2, ?, 1, 'x', ?, ?)`
  );
  morph.run(1, 'V', null);
  morph.run(2, 'N', 'ACC');
  morph.run(3, 'N', null);
  morph.run(4, 'N', null);
  const syn = db.prepare(
    `INSERT INTO quran_syntax (sentence_id, token_index, head_index, surah_id, ayah_id,
       word_index, segment_index, rel, rel_ar, constituent, derived_noun, token, is_implied)
     VALUES (20, ?, ?, 1, 2, ?, 1, ?, NULL, NULL, NULL, ?, 0)`
  );
  syn.run(0, null, 1, 'root', 'يَعْبُدُ');
  syn.run(1, 0, 2, 'Obj', 'رَبَّهُ');
}

describe('GET /api/grammar/governor', () => {
  it('returns null when no concur-safe ʿāmil exists', async () => {
    const { status, body } = await H().json<{ data: null }>('/api/grammar/governor');
    expect(status).toBe(200);
    expect(body.data).toBeNull();
  });

  it('names the verb as ʿāmil of an accusative object', async () => {
    seedGovernorFixture();
    const { status, body } = await H().json<{
      data: { answer: string; options: string[]; id: string; prompt: string };
    }>('/api/grammar/governor');
    expect(status).toBe(200);
    expect(body.data.answer).toBe('يَعْبُدُ');
    expect(body.data.options).toContain('يَعْبُدُ');
    expect(body.data.id).toBe('governor:1:2:2');

    const posted = await H().json('/api/grammar/exercise', {
      method: 'POST',
      body: JSON.stringify({
        exerciseId: body.data.id,
        answer: 'يَعْبُدُ',
        correct: true,
      }),
    });
    expect(posted.status).toBe(200);
  });
});

describe('GET/POST /api/grammar/irab-parse', () => {
  it('returns null when no unread ayah has a concur-safe ʿāmil', async () => {
    const { status, body } = await H().json<{ data: null }>('/api/grammar/irab-parse');
    expect(status).toBe(200);
    expect(body.data).toBeNull();
  });

  it('grades case and governor on a cold ayah', async () => {
    seedGovernorFixture();
    const got = await H().json<{
      data: {
        surah: number;
        ayah: number;
        words: { wordIndex: number; caseCase: string; governor: string }[];
      };
    }>('/api/grammar/irab-parse');
    expect(got.status).toBe(200);
    expect(got.body.data.surah).toBe(1);
    expect(got.body.data.ayah).toBe(2);
    const word = got.body.data.words.find((w) => w.wordIndex === 2);
    expect(word?.caseCase).toBe('ACC');
    expect(word?.governor).toBe('يَعْبُدُ');

    const graded = await H().json<{
      data: { caseCorrect: number; governorCorrect: number };
    }>('/api/grammar/irab-parse', {
      method: 'POST',
      body: JSON.stringify({
        surah: 1,
        ayah: 2,
        answers: [{ wordIndex: 2, caseCase: 'ACC', governor: 'يَعْبُدُ' }],
      }),
    });
    expect(graded.status).toBe(200);
    expect(graded.body.data.caseCorrect).toBe(1);
    expect(graded.body.data.governorCorrect).toBe(1);
  });
});
