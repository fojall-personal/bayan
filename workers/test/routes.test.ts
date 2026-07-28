/**
 * Every endpoint, dispatched for real.
 *
 * ── What this catches that unit tests cannot ────────────────────────────────
 *
 * The schema is applied from the real migration files, so SQLite parses every
 * statement the handler issues. That alone catches the largest class of bug this
 * repo has actually had: a wrong column name. SQLite raises on an unknown column
 * even when the table is empty, so `SELECT surah_id FROM quran_verses` fails here
 * exactly as it failed in production — where the real column is `surah`.
 *
 * Content tables (quran_verses, morphology, glosses, the exercise bank) are NOT
 * seeded, because an empty database is the harsher test: the handler must return an
 * empty result rather than throw, and every SQL statement still has to parse. Where
 * emptiness would make an assertion vacuous, the test seeds the minimum first.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { harness, TEST_USER, type Harness } from './helpers/harness';

let h: Harness | null = null;
afterEach(() => {
  h?.close();
  h = null;
});
const H = () => (h ??= harness());

/** GET endpoints that must answer on an empty-but-real database. */
const GETS: [path: string, note: string][] = [
  ['/health', 'public, no auth'],
  ['/api/auth/whoami', 'identity mode'],
  ['/api/auth/profile', 'the seeded user row'],
  ['/api/assessment/results', 'no attempts yet'],
  ['/api/certificate/export', 'nothing to certify yet'],
  ['/api/grammar/exercises', 'empty bank'],
  ['/api/grammar/exercises?level=1&kind=aspect', 'filtered, empty bank'],
  ['/api/grammar/mastery', 'no attempts yet'],
  ['/api/grammar/deepdive/nahw', 'a known category'],
  ['/api/grammar/root/ktb', 'a root absent from an empty corpus'],
  ['/api/learning/next', 'nothing unlocked yet'],
  ['/api/learning/flashcards', 'empty queue'],
  ['/api/memorization/surahs', 'nothing tracked'],
  ['/api/memorization/curriculum', 'empty unit table'],
  ['/api/memorization/curriculum?level=2&limit=5', 'filtered'],
  ['/api/memorization/review/today', 'nothing due'],
  ['/api/memorization/surah/1', 'nothing tracked for this surah'],
  ['/api/progress/scores', 'no assessments'],
  ['/api/progress/coverage', 'no known roots'],
  ['/api/progress/calibration', 'samples from an empty corpus'],
  ['/api/tajweed/mastery', 'rules exist from migration 0001'],
  ['/api/tajweed/verses/1', 'no verses ingested'],
  ['/api/tutor/history', 'no conversations'],
  ['/api/tutor/suggested-exercises', 'no attempts'],
];

describe('every GET answers against the real schema', () => {
  for (const [path, note] of GETS) {
    it(`${path} — ${note}`, async () => {
      const { status, body } = await H().json<Record<string, unknown>>(path);
      // A 500 here almost always means the SQL did not parse — a wrong column or
      // table name. That is the failure this whole file exists to catch.
      expect(
        status,
        `${path} returned ${status}: ${JSON.stringify(body).slice(0, 200)}`
      ).toBeLessThan(500);
    });
  }
});

describe('auth is enforced on every /api route', () => {
  for (const [path] of GETS.filter(([p]) => p.startsWith('/api/'))) {
    it(`${path} refuses an unauthenticated caller`, async () => {
      const res = await H().request(path, { auth: false });
      expect(res.status).toBe(401);
    });
  }

  it('/health stays public', async () => {
    const res = await H().request('/health', { auth: false });
    expect(res.status).toBe(200);
  });
});

/**
 * Handlers that read a JSON body.
 *
 * Each must reject a malformed body with a 4xx and a JSON error, not a bare 500.
 * All nine returned `Internal Server Error` as plain text before this suite existed,
 * because `await c.req.json()` sat outside the try block — and a non-JSON body also
 * defeats the client's apiErrorMessage, so the learner saw nothing useful.
 */
const BODY_POSTS: string[] = [
  '/api/assessment/submit',
  '/api/auth/onboarding',
  '/api/grammar/parse',
  '/api/grammar/exercise',
  '/api/learning/lessons/grammar-01/submit',
  '/api/learning/flashcards/review',
  '/api/memorization/1/review',
  '/api/memorization/1/recall',
  '/api/memorization/add',
  '/api/progress/calibration',
  '/api/tutor/chat',
  '/api/learning/vocabulary/start',
];

describe('malformed bodies are rejected, not crashed on', () => {
  for (const path of BODY_POSTS) {
    it(`POST ${path} rejects invalid JSON with 4xx JSON`, async () => {
      const { status, body } = await H().json<Record<string, unknown>>(path, {
        method: 'POST',
        body: 'not json at all',
      });
      expect(
        status,
        `expected 4xx, got ${status} — the body parse is probably outside the try`
      ).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
      // Plain-text "Internal Server Error" is what an unhandled throw produces.
      expect(body.__nonJson, 'response was not JSON').toBeUndefined();
    });
  }
});

describe('POSTs validate their inputs', () => {
  it('memorization/add rejects a missing surah', async () => {
    const { status } = await H().json('/api/memorization/add', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
  });

  it('memorization/add rejects an out-of-range ayah', async () => {
    const { status } = await H().json('/api/memorization/add', {
      method: 'POST',
      body: JSON.stringify({ surahId: 1, ayahFrom: 1, ayahTo: 999 }),
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
  });

  it('grammar/exercise rejects an id that matches nothing', async () => {
    const { status, body } = await H().json<{ error?: string }>(
      '/api/grammar/exercise',
      {
        method: 'POST',
        body: JSON.stringify({ exerciseId: 'no-such-id', answer: 'x', correct: true }),
      }
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/unknown exerciseid/i);
  });

  it('vocabulary/start rejects a non-integer count', async () => {
    const { status } = await H().json('/api/learning/vocabulary/start', {
      method: 'POST',
      body: JSON.stringify({ count: 2.5 }),
    });
    expect(status).toBe(400);
  });
});

describe('the ayah endpoint', () => {
  it('404s for an ayah that is not ingested', async () => {
    const { status } = await H().json('/api/quran/ayah/1/1');
    expect(status).toBe(404);
  });

  it('rejects a surah outside 1–114', async () => {
    const { status } = await H().json('/api/quran/ayah/999/1');
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
  });

  it('returns text, words and parse for a seeded ayah', async () => {
    const t = H();
    t.db
      .prepare(
        `INSERT INTO quran_verses (surah, ayah, text_uthmani, text_simple, translation, tajweed_tags)
         VALUES (1, 2, 'ٱلْحَمْدُ لِلَّهِ', 'الحمد لله', 'All praise…', '[]')`
      )
      .run();
    t.db
      .prepare(
        `INSERT INTO quran_word_gloss (surah_id, ayah_id, position, arabic, transliteration, english)
         VALUES (1, 2, 1, 'ٱلْحَمْدُ', 'al-hamdu', 'All praise')`
      )
      .run();
    // `form` and `lemma` are stored in Buckwalter, which is the whole point of the
    // assertion below.
    t.db
      .prepare(
        `INSERT INTO quran_word_morphology
           (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos)
         VALUES (1, 2, 1, 2, 'Hamodu', 'Hamod', 'Hmd', 'N')`
      )
      .run();

    const { status, body } = await t.json<{
      data: {
        textUthmani: string;
        words: { arabic: string; segments: { arabic: string; lemma: string; root: string }[] }[];
      };
    }>('/api/quran/ayah/1/2');

    expect(status).toBe(200);
    expect(body.data.textUthmani).toContain('ٱلْحَمْدُ');
    const seg = body.data.words[0].segments[0];
    // Buckwalter must never reach the client on these two fields: /read prints the
    // lemma, and it read "lemma Hamod" in production.
    expect(seg.lemma).toBe('حَمْد');
    expect(seg.arabic).toBe('حَمْدُ');
    expect(seg.lemma).not.toMatch(/[A-Za-z{}~`]/);
    expect(seg.arabic).not.toMatch(/[A-Za-z{}~`]/);
  });
});

describe('grammar mastery records what the learner answered', () => {
  it('groups by exercise kind and derives accuracy', async () => {
    const t = H();
    for (let i = 1; i <= 6; i += 1) {
      t.db
        .prepare(
          `INSERT INTO grammar_exercise_bank
             (id, kind, level, word_arabic, prompt, answer, options, explanation,
              surah_id, ayah_id, word_index, segment_index)
           VALUES (?, 'aspect', 1, 'x', 'p', 'a', '[]', 'e', 1, 1, ?, 1)`
        )
        // The bank is unique on (kind, surah, ayah, word_index, segment_index), so
        // the location has to vary as well as the id.
        .run(`aspect-${i}`, i);
    }
    for (let i = 1; i <= 6; i += 1) {
      const { status } = await t.json('/api/grammar/exercise', {
        method: 'POST',
        body: JSON.stringify({ exerciseId: `aspect-${i}`, answer: 'a', correct: i <= 4 }),
      });
      expect(status).toBe(200);
    }

    const { body } = await t.json<{
      data: { category: string; totalAttempts: number; correctAttempts: number; percentage: number; masteryLevel: number }[];
    }>('/api/grammar/mastery');

    const aspect = body.data.find((m) => m.category === 'aspect');
    expect(aspect).toBeDefined();
    expect(aspect!.totalAttempts).toBe(6);
    expect(aspect!.correctAttempts).toBe(4);
    expect(aspect!.percentage).toBe(67);
    // Derived, not the hardcoded default of 1 the column used to keep forever.
    expect(aspect!.masteryLevel).toBeGreaterThan(1);
  });

  it('writes nothing at all when the exercise id is unknown', async () => {
    const t = H();
    await t.json('/api/grammar/exercise', {
      method: 'POST',
      body: JSON.stringify({ exerciseId: 'nope', answer: 'a', correct: true }),
    });
    const attempts = t.db
      .prepare(`SELECT COUNT(*) AS n FROM grammar_exercises WHERE user_id = ?`)
      .get(TEST_USER) as { n: number };
    // The attempt insert used to happen before the id was validated, leaving a row
    // with no matching mastery update.
    expect(attempts.n).toBe(0);
  });
});

describe('vocabulary is scoped to the hifz plan', () => {
  it('prefers content words from memorised ayahs over global frequency', async () => {
    const t = H();
    t.db
      .prepare(
        `INSERT INTO memorization (user_id, surah_id, ayah_from, ayah_to, status)
         VALUES (?, 112, 1, 1, 'learning')`
      )
      .run(TEST_USER);
    // Two words in the plan: one a content word (PN), one a particle (NEG).
    for (const [pos, arabic, english, position] of [
      ['PN', 'ٱللَّهُ', 'Allah', 1],
      ['NEG', 'وَلَا', 'and not', 2],
    ] as const) {
      t.db
        .prepare(
          `INSERT INTO quran_word_gloss (surah_id, ayah_id, position, arabic, transliteration, english)
           VALUES (112, 1, ?, ?, 't', ?)`
        )
        .run(position, arabic, english);
      t.db
        .prepare(
          `INSERT INTO quran_word_morphology
             (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos)
           VALUES (112, 1, ?, 1, 'f', 'l', 'r', ?)`
        )
        .run(position, pos);
    }

    const { status, body } = await t.json<{
      data: {
        added: number;
        fromHifzPlan: number;
        sources: { word: string; source: string }[];
      };
    }>('/api/learning/vocabulary/start', {
      method: 'POST',
      body: JSON.stringify({ count: 5 }),
    });

    expect(status).toBe(200);
    expect(body.data.fromHifzPlan).toBe(1);
    expect(body.data.sources[0].word).toBe('ٱللَّهُ');
    expect(body.data.sources[0].source).toBe('112:1');
    // The particle must not be enrolled: a flashcard for "and not" teaches nothing.
    expect(body.data.sources.map((s) => s.word)).not.toContain('وَلَا');
  });

  it('carries the source location onto the card, with the gloss from that ayah', async () => {
    const t = H();
    t.db
      .prepare(
        `INSERT INTO memorization (user_id, surah_id, ayah_from, ayah_to, status)
         VALUES (?, 1, 1, 1, 'learning')`
      )
      .run(TEST_USER);
    t.db
      .prepare(
        `INSERT INTO quran_word_gloss (surah_id, ayah_id, position, arabic, transliteration, english)
         VALUES (1, 1, 1, 'ٱللَّهِ', 'allahi', '(of) Allah')`
      )
      .run();
    // The same form elsewhere with a different gloss. Aggregating by word instead of
    // joining on location is what produced "(The) Promise of Allah".
    t.db
      .prepare(
        `INSERT INTO quran_word_gloss (surah_id, ayah_id, position, arabic, transliteration, english)
         VALUES (9, 111, 3, 'ٱللَّهِ', 'allahi', '(The) Promise of Allah')`
      )
      .run();
    t.db
      .prepare(
        `INSERT INTO quran_word_morphology
           (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos)
         VALUES (1, 1, 1, 1, 'f', 'l', 'Alh', 'PN')`
      )
      .run();

    await t.json('/api/learning/vocabulary/start', {
      method: 'POST',
      body: JSON.stringify({ count: 5 }),
    });

    const { body } = await t.json<{
      data: { word: string; meaning: string; source: string; root: string }[];
    }>('/api/learning/flashcards');

    const card = body.data.find((c) => c.word === 'ٱللَّهِ');
    expect(card).toBeDefined();
    expect(card!.source).toBe('1:1');
    expect(card!.meaning).toBe('(of) Allah');
    expect(card!.root).toBe('Alh');
  });
});

describe('known roots and coverage', () => {
  it('refuses a root the corpus does not attest', async () => {
    // Not a test-setup problem — the handler deliberately rejects roots with no
    // corpus occurrence, because a typo would inflate the count with something that
    // can never make an ayah readable.
    const { status, body } = await H().json<{ error: string }>(
      '/api/progress/roots/zzz/known',
      { method: 'POST' }
    );
    expect(status).toBe(404);
    expect(body.error).toMatch(/no root/i);
  });

  it('records a root, reports the delta, and undoes it', async () => {
    const t = H();
    t.db
      .prepare(
        `INSERT INTO quran_word_morphology
           (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos)
         VALUES (2, 1, 1, 1, 'f', 'l', 'ktb', 'N')`
      )
      .run();
    const post = await t.json<{ data: { ayahsUnlocked: number } }>(
      '/api/progress/roots/ktb/known',
      { method: 'POST' }
    );
    expect(post.status).toBe(200);
    const row = t.db
      .prepare(`SELECT COUNT(*) AS n FROM user_known_root WHERE user_id = ? AND root = 'ktb'`)
      .get(TEST_USER) as { n: number };
    expect(row.n).toBe(1);

    const del = await t.json('/api/progress/roots/ktb/known', { method: 'DELETE' });
    expect(del.status).toBe(200);
    const after = t.db
      .prepare(`SELECT COUNT(*) AS n FROM user_known_root WHERE user_id = ? AND root = 'ktb'`)
      .get(TEST_USER) as { n: number };
    expect(after.n).toBe(0);
  });
});

describe('the tutor', () => {
  it('stores each exchange and returns it as history', async () => {
    const t = H();
    const chat = await t.json('/api/tutor/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'explain madd', conversationHistory: [] }),
    });
    expect(chat.status).toBe(200);

    const { body } = await t.json<{ data: { userMessage: string }[] }>(
      '/api/tutor/history'
    );
    expect(body.data.length).toBe(1);
    expect(body.data[0].userMessage).toBe('explain madd');
  });

  it('ranks weak lessons by accuracy, not by attempt count', async () => {
    const t = H();
    t.db
      .prepare(
        `INSERT INTO lessons (id, title, module, level, content, exercises, prerequisites)
         VALUES ('grammar-01', 'Articles and Nouns', 'grammar', 1, '{}', '[]', '[]')`
      )
      .run();
    // 2 of 8 correct: genuinely weak.
    // Two attempts, 1 of 4 each — 2 of 8 overall. Indexed ids because both rows are
    // otherwise identical and the primary key would collide.
    [
      [4, 1],
      [4, 1],
    ].forEach(([answered, correct], i) => {
      t.db
        .prepare(
          `INSERT INTO quiz_attempts
             (id, user_id, lesson_id, module, questions_answered, questions_correct)
           VALUES (?, ?, 'grammar-01', 'grammar', ?, ?)`
        )
        .run(`qa-${i}`, TEST_USER, answered, correct);
    });

    const { body } = await t.json<{
      data: { recommendations: { title: string; reason: string; accuracy: number; priority: string }[] };
    }>('/api/tutor/suggested-exercises');

    const rec = body.data.recommendations[0];
    expect(rec.title).toBe('Articles and Nouns');
    expect(rec.accuracy).toBeCloseTo(0.25, 2);
    expect(rec.priority).toBe('high');
    // The old query said "3 errors in this area" and meant three attempts.
    expect(rec.reason).toBe('2 of 8 correct across 2 attempts');
  });
});

/**
 * One envelope, everywhere.
 *
 * Success responses used to come back under seven different keys — `data` on 28
 * handlers, then `success`, `surahId`, `surahs`, `due`, `added`, `lesson`,
 * `message`. The client has to special-case each, and when it guesses wrong nothing
 * fails loudly: it reads `undefined`, falls back to an empty default, and renders a
 * plausible screen with no data in it.
 *
 * That is not hypothetical. Today.tsx asked for `{ data: DueItem[] }` from
 * /api/memorization/review/today, which returned `{ due }`, and wrote
 * `setDue(res.data ?? [])` — so the landing screen reported nothing due no matter
 * how many reviews were waiting.
 */
describe('every success response uses the {data} envelope', () => {
  for (const [path, note] of GETS.filter(([p]) => p.startsWith('/api/'))) {
    it(`${path} — ${note}`, async () => {
      const { status, body } = await H().json<Record<string, unknown>>(path);
      if (status >= 400) return; // errors carry {error}, checked elsewhere
      expect(
        Object.prototype.hasOwnProperty.call(body, 'data'),
        `${path} returned keys [${Object.keys(body).join(', ')}] instead of {data}`
      ).toBe(true);
    });
  }

  it('POST /api/memorization/add answers with {data}', async () => {
    const { status, body } = await H().json<Record<string, unknown>>(
      '/api/memorization/add',
      { method: 'POST', body: JSON.stringify({ surahId: 112, ayahFrom: 1, ayahTo: 4 }) }
    );
    expect(status).toBe(200);
    expect(Object.keys(body)).toEqual(['data']);
  });

  it('POST /api/learning/vocabulary/start answers with {data}', async () => {
    const { status, body } = await H().json<Record<string, unknown>>(
      '/api/learning/vocabulary/start',
      { method: 'POST', body: JSON.stringify({ count: 3 }) }
    );
    expect(status).toBe(200);
    expect(Object.keys(body)).toEqual(['data']);
  });
});

describe('FSRS scheduling through the API', () => {
  it('records memory state on a hifz review and rejects the old numeric scale', async () => {
    const t = H();
    const add = await t.json<{ data: { entry: unknown } }>('/api/memorization/add', {
      method: 'POST',
      body: JSON.stringify({ surahId: 112, ayahFrom: 1, ayahTo: 4 }),
    });
    expect(add.status).toBe(200);
    const row = t.db
      .prepare(`SELECT id FROM memorization WHERE user_id = ?`)
      .get(TEST_USER) as { id: string };

    // The scale that used to be accepted must now be refused, not silently coerced:
    // treating an unknown grade as "good" would corrupt the schedule invisibly.
    const numeric = await t.json<{ error: string }>(
      `/api/memorization/${row.id}/review`,
      { method: 'POST', body: JSON.stringify({ quality: 5 }) }
    );
    expect(numeric.status).toBe(400);
    expect(numeric.body.error).toMatch(/grade must be one of/);

    const good = await t.json<{ data: { interval: number; status: string } }>(
      `/api/memorization/${row.id}/review`,
      { method: 'POST', body: JSON.stringify({ grade: 'good' }) }
    );
    expect(good.status).toBe(200);
    expect(good.body.data.interval).toBeGreaterThan(0);

    const after = t.db
      .prepare(`SELECT stability, difficulty, fsrs_state, last_review, interval FROM memorization WHERE id = ?`)
      .get(row.id) as {
        stability: number | null;
        difficulty: number | null;
        fsrs_state: number | null;
        last_review: string | null;
        interval: number;
      };
    // The whole point of the migration: memory state is persisted, not just a date.
    expect(after.stability).toBeGreaterThan(0);
    expect(after.difficulty).toBeGreaterThan(0);
    expect(after.last_review).toBeTruthy();
    expect(after.interval).toBe(good.body.data.interval);
  });

  it('schedules a flashcard by grade and marks meaning known only on a clean pass', async () => {
    const t = H();
    t.db
      .prepare(
        `INSERT INTO vocabulary_mastery (user_id, word, meaning_known, reading_known, next_review, reviews, ease_factor, interval_days)
         VALUES (?, 'قُلْ', 0, 0, datetime('now'), 0, 2.5, 1)`
      )
      .run(TEST_USER);

    const hard = await t.json('/api/learning/flashcards/review', {
      method: 'POST',
      body: JSON.stringify({ word: 'قُلْ', grade: 'hard' }),
    });
    expect(hard.status).toBe(200);
    let row = t.db
      .prepare(`SELECT meaning_known, reading_known, stability FROM vocabulary_mastery WHERE word = 'قُلْ'`)
      .get() as { meaning_known: number; reading_known: number; stability: number | null };
    // "Dragged it up with difficulty" is not the same as knowing the meaning.
    expect(row.meaning_known).toBe(0);
    expect(row.reading_known).toBe(1);
    expect(row.stability).toBeGreaterThan(0);

    await t.json('/api/learning/flashcards/review', {
      method: 'POST',
      body: JSON.stringify({ word: 'قُلْ', grade: 'good' }),
    });
    row = t.db
      .prepare(`SELECT meaning_known FROM vocabulary_mastery WHERE word = 'قُلْ'`)
      .get() as { meaning_known: number };
    expect(row.meaning_known).toBe(1);
  });
});

describe('lesson results explain the mistakes', () => {
  it('returns the authored explanation for every exercise, including match', async () => {
    const t = H();
    // The real grammar-02 shape: a match plus a multiple choice, both with explanations.
    const exercises = [
      {
        type: 'match',
        question: 'Match the conjugation of كَتَبَ with the correct subject',
        pairs: [
          { item: 'كَتَبُوا', answer: 'they (men) wrote' },
          { item: 'كَتَبْنَا', answer: 'we wrote' },
        ],
        explanation: 'Each ending marks a different subject, and the stem كَتَب never changes.',
      },
      {
        type: 'multiple_choice',
        question: 'Which form means "they (men) wrote"?',
        options: ['كَتَبْنَ', 'كَتَبُوا'],
        correct: 1,
        explanation: 'The masculine plural past suffix is ـُوا.',
      },
    ];
    t.db
      .prepare(
        `INSERT INTO lessons (id, title, module, level, content, exercises, prerequisites)
         VALUES ('grammar-02', 'Past Tense', 'grammar', 1, '{}', ?, '[]')`
      )
      .run(JSON.stringify(exercises));

    const { status, body } = await t.json<{
      data: {
        correct: number;
        total: number;
        review: {
          type: string;
          correct: boolean;
          given: string | null;
          expected: string | null;
          explanation: string | null;
        }[];
      };
    }>('/api/learning/lessons/grammar-02/submit', {
      method: 'POST',
      // Match answered wrong, multiple choice right.
      body: JSON.stringify({ answers: [JSON.stringify(['we wrote', 'they (men) wrote']), 1] }),
    });

    expect(status).toBe(200);
    expect(body.data.total).toBe(2);
    expect(body.data.correct).toBe(1);

    const match = body.data.review.find((r) => r.type === 'match')!;
    expect(match.correct).toBe(false);
    // The whole point of the review screen: a wrong answer comes with the reason.
    // grammar-02's match shipped without one, so the learner saw a bare ✗.
    expect(match.explanation).toContain('never changes');
    expect(match.expected).toContain('كَتَبُوا');
    expect(match.given).toBe('we wrote, they (men) wrote');

    // Every exercise carries an explanation, not just the ones that happen to be wrong.
    for (const item of body.data.review) {
      expect(item.explanation, `${item.type} has no explanation`).toBeTruthy();
    }
  });
});

describe('the exercise bank exposes all twenty-three kinds', () => {
  const KINDS = [
    'verb_form', 'case_ending', 'root_id', 'pos_id', 'aspect', 'word_meaning',
    'find_word', 'definiteness', 'negation', 'mood', 'voice', 'subject_agreement',
    'word_role', 'relative_pronoun', 'demonstrative', 'conditional', 'sentence_type',
    // From the treebank's syntax layer.
    'mubtada_khabar', 'subject_word', 'object', 'idafa', 'derived_noun', 'fronting',
  ];

  it('accepts every kind the generator emits', async () => {
    const t = H();
    for (const kind of KINDS) {
      const { status, body } = await t.json<{ data: unknown[] }>(
        `/api/grammar/exercises?kind=${kind}&limit=1`
      );
      // The bank is empty in the harness, so an empty list is the expected answer. What
      // matters is that the kind is not REJECTED — the allowlist in grammar.ts and the
      // generator's kinds drifted apart once already, and a rejected kind means a filter
      // the UI offers and the API refuses.
      expect(status, `${kind} was rejected`).toBe(200);
      expect(Array.isArray(body.data)).toBe(true);
    }
  });

  it('still rejects a kind that does not exist', async () => {
    const { status, body } = await H().json<{ error: string }>(
      '/api/grammar/exercises?kind=definitness' // a plausible typo
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/kind must be one of/);
  });

  it('grades the new kinds under their own names', async () => {
    const t = H();
    // subject_agreement, so mastery is recorded against the kind the learner drilled.
    t.db
      .prepare(
        `INSERT INTO grammar_exercise_bank
           (id, kind, level, word_arabic, prompt, answer, options, explanation,
            surah_id, ayah_id, word_index, segment_index)
         VALUES ('sa-1', 'subject_agreement', 1, 'يَقُولُ', 'Who is the subject?', 'he',
                 '["he","she","we","they"]', 'Tagged 3MS.', 2, 8, 1, 1)`
      )
      .run();
    const { status } = await t.json('/api/grammar/exercise', {
      method: 'POST',
      body: JSON.stringify({ exerciseId: 'sa-1', answer: 'he', correct: true }),
    });
    expect(status).toBe(200);
    const row = t.db
      .prepare(`SELECT category, correct_attempts FROM grammar_mastery WHERE user_id = ?`)
      .get(TEST_USER) as { category: string; correct_attempts: number };
    expect(row.category).toBe('subject_agreement');
    expect(row.correct_attempts).toBe(1);
  });

  it('serves sentence_type with an empty display word', async () => {
    const t = H();
    // sentence_type is the only kind with nothing to show above the prompt: its four
    // whole ayat ARE the options. So word_arabic is '' by design, and the runner hides
    // the element when it is empty. An empty string is exactly the sort of value that
    // gets coerced to null on the way through a query layer, and the difference is not
    // cosmetic — a null would render as "null" in a 5xl heading over every question.
    t.db
      .prepare(
        `INSERT INTO grammar_exercise_bank
           (id, kind, level, word_arabic, prompt, answer, options, explanation,
            surah_id, ayah_id, word_index, segment_index)
         VALUES ('st-1', 'sentence_type', 1, '', 'Which of these opens with a noun?',
                 'هُوَ يُحْىِۦ وَيُمِيتُ',
                 '["هُوَ يُحْىِۦ وَيُمِيتُ","قَالَ رَبِّ","قُلْ هُوَ ٱللَّهُ","خَتَمَ ٱللَّهُ"]',
                 'Tagged POS:PRON.', 10, 56, 1, 1)`
      )
      .run();
    const { status, body } = await t.json<{
      data: { kind: string; word: string; options: string[] }[];
    }>('/api/grammar/exercises?kind=sentence_type&limit=1');
    expect(status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].word).toBe('');
    expect(body.data[0].options).toHaveLength(4);
  });

  it('grades a treebank-derived kind against its own category', async () => {
    const t = H();
    // mubtada_khabar is the kind that exists only because a second corpus supplied the
    // syntax. Mastery must record under its own name, not fold into case_ending, or
    // /progress would report predication practice as case practice.
    t.db
      .prepare(
        `INSERT INTO grammar_exercise_bank
           (id, kind, level, word_arabic, prompt, answer, options, explanation,
            surah_id, ayah_id, word_index, segment_index)
         VALUES ('mk-1', 'mubtada_khabar', 1,
                 'ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ فِيهِ هُدًى لِّلْمُتَّقِينَ',
                 'Which word is the predicate (خبر) in 2:2?', 'هُدًى',
                 '["هُدًى","ذَٰلِكَ","رَيْبَ","فِيهِ"]',
                 'Marked Pred and nominative.', 2, 2, 6, 1)`
      )
      .run();
    const { status } = await t.json('/api/grammar/exercise', {
      method: 'POST',
      body: JSON.stringify({ exerciseId: 'mk-1', answer: 'هُدًى', correct: true }),
    });
    expect(status).toBe(200);
    const row = t.db
      .prepare(`SELECT category FROM grammar_mastery WHERE user_id = ?`)
      .get(TEST_USER) as { category: string };
    expect(row.category).toBe('mubtada_khabar');
  });
});

describe('the deep-dive categories are three different things', () => {
  // Before lessons.category existed, the endpoint took a category, used it for the
  // mastery lookup, and queried `module = 'grammar'` — so all three tabs returned every
  // lesson, 823 KB each, and Rhetoric returned 418 lessons containing no rhetoric.
  const seed = (t: ReturnType<typeof H>) => {
    for (const [id, category] of [
      ['grammar-01', 'nahw'],
      ['grammar-02', 'sarf'],
      ['root-ktb', null],
    ] as const) {
      t.db
        .prepare(
          `INSERT INTO lessons (id, title, module, level, content, exercises,
             prerequisites, estimated_minutes, category)
           VALUES (?, ?, 'grammar', 1, '{}', '[]', '[]', 15, ?)`
        )
        .run(id, id, category);
    }
  };

  it('returns only the lessons belonging to the requested discipline', async () => {
    const t = H();
    seed(t);
    const nahw = await t.json<{ data: { lessons: { id: string }[] } }>(
      '/api/grammar/deepdive/nahw'
    );
    const sarf = await t.json<{ data: { lessons: { id: string }[] } }>(
      '/api/grammar/deepdive/sarf'
    );
    const balagha = await t.json<{ data: { lessons: { id: string }[] } }>(
      '/api/grammar/deepdive/balagha'
    );
    expect(nahw.body.data.lessons.map((l) => l.id)).toEqual(['grammar-01']);
    expect(sarf.body.data.lessons.map((l) => l.id)).toEqual(['grammar-02']);
    // Honestly empty rather than quietly full. The UI states why.
    expect(balagha.body.data.lessons).toEqual([]);
    // And the uncategorised root lesson appears under none of them.
    for (const r of [nahw, sarf, balagha]) {
      expect(r.body.data.lessons.map((l) => l.id)).not.toContain('root-ktb');
    }
  });

  it('rejects a category that is not one of the three', async () => {
    // Previously returned 200 with every lesson, so a typo in a link looked like a
    // working page.
    const { status, body } = await H().json<{ error: string }>(
      '/api/grammar/deepdive/rhetoric'
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/category must be one of/);
  });
});
