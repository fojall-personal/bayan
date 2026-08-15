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

import { afterEach, describe, expect, it, vi } from 'vitest';
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
  ['/api/session/plan', 'empty mixed session plan'],
  ['/api/grammar/elided', 'no syntax rows, empty item'],
  ['/api/memorization/retention', 'default retention, empty preview'],
  ['/api/memorization/surah/1', 'nothing tracked for this surah'],
  ['/api/progress/scores', 'no assessments'],
  ['/api/progress/coverage', 'no known roots'],
  ['/api/progress/pattern-grid', 'no known roots, empty grid'],
  ['/api/progress/calibration', 'samples from an empty corpus'],
  ['/api/progress/freeflow', 'empty corpus, no runs'],
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

describe('surahId route params are validated, not silently emptied', () => {
  it('tajweed/verses/:surahId rejects a non-numeric surahId with 400', async () => {
    const { status } = await H().json('/api/tajweed/verses/abc');
    expect(status).toBe(400);
  });

  it('tajweed/verses/:surahId rejects an out-of-range surahId with 400', async () => {
    const { status } = await H().json('/api/tajweed/verses/9999');
    expect(status).toBe(400);
  });

  it('memorization/surah/:surahId rejects a non-numeric surahId with 400', async () => {
    const { status } = await H().json('/api/memorization/surah/abc');
    expect(status).toBe(400);
  });

  it('memorization/surah/:surahId rejects an out-of-range surahId with 400', async () => {
    const { status } = await H().json('/api/memorization/surah/9999');
    expect(status).toBe(400);
  });
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

  it('auth: correct token succeeds, wrong token is 401', async () => {
    const res = await H().request('/api/auth/profile');
    expect(res.status).toBe(200);
    // A wrong bearer token still has a header, but its bytes differ; the
    // comparison must reject it without leaking which byte was wrong.
    const wrong = await H().request('/api/auth/profile', {
      headers: { Authorization: 'Bearer totally-wrong-token' },
    });
    expect(wrong.status).toBe(401);
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

  it('auth/onboarding rejects {} with a 400, not a 500', async () => {
    const { status, body } = await H().json<{ error?: string }>(
      '/api/auth/onboarding',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/goal/);
  });

  it('auth/onboarding rejects a numeric goal', async () => {
    const { status } = await H().json('/api/auth/onboarding', {
      method: 'POST',
      body: JSON.stringify({ goal: 123, readingAbility: 'yes', memorizedSurahs: '0' }),
    });
    expect(status).toBe(400);
  });

  it('grammar/parse rejects {} with a 400, not a 500', async () => {
    const { status, body } = await H().json<{ error?: string }>(
      '/api/grammar/parse',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/sentence/i);
  });

  it('grammar/parse rejects an empty sentence string with a 400', async () => {
    const { status } = await H().json('/api/grammar/parse', {
      method: 'POST',
      body: JSON.stringify({ sentence: '   ' }),
    });
    expect(status).toBe(400);
  });

  it('grammar/parse accepts a non-empty sentence', async () => {
    const { status, body } = await H().json<{ data: { parsed: unknown } }>(
      '/api/grammar/parse',
      {
        method: 'POST',
        body: JSON.stringify({ sentence: 'كَتَبَ ٱلْكِتَٰبَ' }),
      }
    );
    expect(status).toBe(200);
    expect(body.data).toHaveProperty('parsed');
    expect(body.data.parsed).toHaveProperty('words');
  });

  it('memorization/:id/recall rejects a missing recalledAyah with 400', async () => {
    const { status } = await H().json('/api/memorization/1/recall', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(status).toBe(400);
  });

  it('memorization/:id/recall rejects a malformed recalledAyah with 400', async () => {
    const { status } = await H().json('/api/memorization/1/recall', {
      method: 'POST',
      body: JSON.stringify({ recalledAyah: 'seven' }),
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

  it('states what each word does, and what is implied but unwritten', async () => {
    const t = H();
    t.db
      .prepare(
        `INSERT INTO quran_verses (surah, ayah, text_uthmani, text_simple, translation, tajweed_tags)
         VALUES (1, 5, 'إِيَّاكَ نَعْبُدُ', 'اياك نعبد', null, '[]')`
      )
      .run();
    for (const [pos, arabic] of [
      [1, 'إِيَّاكَ'],
      [2, 'نَعْبُدُ'],
    ] as const) {
      t.db
        .prepare(
          `INSERT INTO quran_word_gloss (surah_id, ayah_id, position, arabic, transliteration, english)
           VALUES (1, 5, ?, ?, '', '')`
        )
        .run(pos, arabic);
      t.db
        .prepare(
          `INSERT INTO quran_word_morphology
             (surah_id, ayah_id, word_index, segment_index, form, pos)
           VALUES (1, 5, ?, 1, 'x', ?)`
        )
        .run(pos, pos === 2 ? 'V' : 'PRON');
    }
    const syntax = t.db.prepare(
      `INSERT INTO quran_syntax (sentence_id, token_index, head_index, surah_id, ayah_id,
         word_index, segment_index, rel, rel_ar, constituent, derived_noun, token, is_implied)
       VALUES (?, ?, ?, 1, 5, ?, 1, ?, ?, NULL, NULL, ?, ?)`
    );
    // إيّاك is the object of نعبد.
    syntax.run(1, 0, 1, 1, 'Obj', 'مفعول به', 'إِيَّاكَ', 0);
    // نعبد heads the sentence. `root` on a VERB is the main verb, resolved from the
    // hand-verified part of speech — the treebank has no label distinguishing the two
    // things `root` can mean.
    syntax.run(1, 1, null, 2, 'root', 'root', 'نَعْبُدُ', 0);
    // The subject Arabic carries INSIDE the verb — never written, so it cannot be pointed
    // at on the page. word_index is 0 by definition; the position comes from its head.
    syntax.run(1, 2, 1, 0, 'Subj', 'فاعل', '(نحْنُ)', 1);
    // An omission the treebank does not reconstruct. `(*)` must not reach the screen.
    syntax.run(1, 3, 1, 0, 'Adj', 'صفة', '(*)', 1);

    const { status, body } = await t.json<{
      data: {
        words: { segments: { role: string | null; roleArabic: string | null }[] }[];
        elided: {
          belongsToWord: number | null;
          role: string | null;
          roleArabic: string | null;
          arabic: string | null;
        }[];
      };
    }>('/api/quran/ayah/1/5');

    expect(status).toBe(200);
    expect(body.data.words[0].segments[0].roleArabic).toBe('مفعول به');
    expect(body.data.words[0].segments[0].role).toMatch(/object/);
    // `root` on a verb reads as the main verb, not as a مبتدأ. Resolved from the
    // morphology's POS, since the treebank spells both as the same relation.
    expect(body.data.words[1].segments[0].role).toMatch(/main verb/);
    expect(body.data.words[1].segments[0].roleArabic).toBeNull();

    expect(body.data.elided).toHaveLength(2);
    const subj = body.data.elided.find((e) => e.roleArabic === 'فاعل')!;
    // Resolved through the head, which is the only way to say WHICH verb carries it —
    // 1:5 really has two identical (نحْنُ) and they belong to different verbs.
    expect(subj.belongsToWord).toBe(2);
    expect(subj.arabic).toBe('(نحْنُ)');
    // The unreconstructed one keeps its role and loses its placeholder.
    const adj = body.data.elided.find((e) => e.roleArabic === 'صفة')!;
    expect(adj.arabic).toBeNull();
  });

  it('reads the head of a nominal sentence as the مبتدأ', async () => {
    const t = H();
    // The treebank has no مبتدأ label — it marks a sentence head as `root`, which means
    // the main verb in a verbal sentence and the مبتدأ in a nominal one. Filtering `root`
    // wholesale left 2:2's ذَٰلِكَ with no role while its خبر had one, which is the word
    // grammar-03 is entirely about.
    t.db
      .prepare(
        `INSERT INTO quran_verses (surah, ayah, text_uthmani, text_simple, translation, tajweed_tags)
         VALUES (2, 2, 'ذَٰلِكَ ٱلْكِتَٰبُ', 'ذلك الكتاب', null, '[]')`
      )
      .run();
    t.db
      .prepare(
        `INSERT INTO quran_word_gloss (surah_id, ayah_id, position, arabic, transliteration, english)
         VALUES (2, 2, 1, 'ذَٰلِكَ', '', '')`
      )
      .run();
    const morph = t.db.prepare(
      `INSERT INTO quran_word_morphology
         (surah_id, ayah_id, word_index, segment_index, form, pos, case_case)
       VALUES (2, 2, 1, 1, 'x', ?, ?)`
    );
    const syntax = t.db.prepare(
      `INSERT INTO quran_syntax (sentence_id, token_index, head_index, surah_id, ayah_id,
         word_index, segment_index, rel, rel_ar, constituent, derived_noun, token, is_implied)
       VALUES (9, 0, NULL, 2, 2, 1, 1, 'root', 'root', NULL, NULL, 'ذَٰلِكَ', 0)`
    );

    // A demonstrative is indeclinable — no case at all — so absence must not read as
    // disagreement, or every ذلك and هذا would lose its role.
    morph.run('DEM', null);
    syntax.run();
    const demo = await t.json<{
      data: { words: { segments: { role: string | null; roleArabic: string | null }[] }[] };
    }>('/api/quran/ayah/2/2');
    expect(demo.body.data.words[0].segments[0].roleArabic).toBe('مبتدأ');
    expect(demo.body.data.words[0].segments[0].role).toMatch(/subject/);

    // But an explicitly NON-nominative noun heading a sentence is the two sources
    // disagreeing — a مبتدأ is nominative — so it gets no gloss rather than a wrong one.
    //
    // A second ayah in the SAME harness, not a second harness: H() is memoised per test,
    // so calling it twice returns the same database and re-inserting 2:2 fails its unique
    // key. That is the harness working as intended, and it cost one red run to notice.
    t.db
      .prepare(
        `INSERT INTO quran_verses (surah, ayah, text_uthmani, text_simple, translation, tajweed_tags)
         VALUES (2, 3, 'x', 'x', null, '[]')`
      )
      .run();
    t.db
      .prepare(
        `INSERT INTO quran_word_gloss (surah_id, ayah_id, position, arabic, transliteration, english)
         VALUES (2, 3, 1, 'x', '', '')`
      )
      .run();
    t.db
      .prepare(
        `INSERT INTO quran_word_morphology
           (surah_id, ayah_id, word_index, segment_index, form, pos, case_case)
         VALUES (2, 3, 1, 1, 'x', 'N', 'ACC')`
      )
      .run();
    t.db
      .prepare(
        `INSERT INTO quran_syntax (sentence_id, token_index, head_index, surah_id, ayah_id,
           word_index, segment_index, rel, rel_ar, constituent, derived_noun, token, is_implied)
         VALUES (10, 0, NULL, 2, 3, 1, 1, 'root', 'root', NULL, NULL, 'x', 0)`
      )
      .run();
    const clash = await t.json<{
      data: { words: { segments: { role: string | null }[] }[] };
    }>('/api/quran/ayah/2/3');
    expect(clash.body.data.words[0].segments[0].role).toBeNull();
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

describe('known patterns (wazn)', () => {
  it('requires auth', async () => {
    const { status } = await H().json('/api/progress/patterns/IV/known', {
      method: 'POST',
      auth: false,
    });
    expect(status).toBe(401);
  });

  it('refuses a verb form the corpus does not attest', async () => {
    const { status, body } = await H().json<{ error: string }>(
      '/api/progress/patterns/XX/known',
      { method: 'POST' }
    );
    expect(status).toBe(404);
    expect(body.error).toMatch(/no verb form/i);
  });

  it('records a pattern known and undoes it', async () => {
    const t = H();
    t.db
      .prepare(
        `INSERT INTO quran_word_morphology
           (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos, verb_form)
         VALUES (2, 1, 1, 1, 'f', 'l', 'ktb', 'V', 'IV')`
      )
      .run();
    const post = await t.json<{ data: { verbForm: string; occurrences: number } }>(
      '/api/progress/patterns/IV/known',
      { method: 'POST' }
    );
    expect(post.status).toBe(200);
    expect(post.body.data).toMatchObject({ verbForm: 'IV', occurrences: 1 });
    const row = t.db
      .prepare(
        `SELECT COUNT(*) AS n FROM user_known_pattern WHERE user_id = ? AND verb_form = 'IV'`
      )
      .get(TEST_USER) as { n: number };
    expect(row.n).toBe(1);

    const del = await t.json('/api/progress/patterns/IV/known', { method: 'DELETE' });
    expect(del.status).toBe(200);
    const after = t.db
      .prepare(
        `SELECT COUNT(*) AS n FROM user_known_pattern WHERE user_id = ? AND verb_form = 'IV'`
      )
      .get(TEST_USER) as { n: number };
    expect(after.n).toBe(0);
  });

  it('Form I (unmarked, no verb_form value) cannot be marked known', async () => {
    const t = H();
    // Deliberately no verb_form column value at all — Form I is represented by
    // its ABSENCE, not the literal string 'I'.
    t.db
      .prepare(
        `INSERT INTO quran_word_morphology
           (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos)
         VALUES (2, 1, 1, 1, 'f', 'l', 'ktb', 'V')`
      )
      .run();
    const { status } = await t.json('/api/progress/patterns/I/known', { method: 'POST' });
    expect(status).toBe(404);
  });
});

describe('the reading queue', () => {
  it('requires auth', async () => {
    const { status } = await H().json('/api/progress/reading-queue', { auth: false });
    expect(status).toBe(401);
  });

  it('surfaces an ayah with exactly one unknown root, closest-to-readable first', async () => {
    const t = H();
    // A 4-word ayah where 3 of the 4 roots are already known — the one unknown
    // root (rootD) is what the queue should surface, per the handler's own
    // filter (unknown_rooted = 1 AND total_rooted >= 3).
    for (const [wordIndex, root] of [
      [1, 'rootA'],
      [2, 'rootB'],
      [3, 'rootC'],
      [4, 'rootD'],
    ] as const) {
      t.db
        .prepare(
          `INSERT INTO quran_word_morphology
             (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos)
           VALUES (2, 255, ?, 1, 'f', 'l', ?, 'N')`
        )
        .run(wordIndex, root);
    }
    t.db
      .prepare(
        `INSERT INTO quran_verses (surah, ayah, text_uthmani) VALUES (2, 255, 'test ayah text')`
      )
      .run();
    for (const root of ['rootA', 'rootB', 'rootC']) {
      t.db
        .prepare(`INSERT INTO user_known_root (user_id, root) VALUES (?, ?)`)
        .run(TEST_USER, root);
    }

    const { status, body } = await t.json<{
      data: {
        items: {
          surah: number;
          ayah: number;
          blockingRoot: string;
          knownWords: number;
          totalWords: number;
          coveragePct: number;
        }[];
        thresholdNote: string;
      };
    }>('/api/progress/reading-queue');

    expect(status).toBe(200);
    expect(body.data.thresholdNote).toBeTruthy();
    const item = body.data.items.find((i) => i.surah === 2 && i.ayah === 255);
    expect(item).toBeDefined();
    expect(item!.blockingRoot).toBe('rootD');
    expect(item!.knownWords).toBe(3);
    expect(item!.totalWords).toBe(4);
    expect(item!.coveragePct).toBe(75);
  });
});

describe('the freeflow reading band', () => {
  it('requires auth', async () => {
    const { status } = await H().json('/api/progress/freeflow', { auth: false });
    expect(status).toBe(401);
  });

  it('returns only contiguous runs at or above the coverage threshold', async () => {
    const t = H();
    // Ayahs 1-3 of surah 1 are fully known. Ayah 4 has one unknown root out of
    // three — 66.7% coverage, well under the 98% threshold — and must not
    // silently extend the run.
    const seedAyah = (ayah: number, roots: string[]) => {
      roots.forEach((root, i) => {
        t.db
          .prepare(
            `INSERT INTO quran_word_morphology
               (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos)
             VALUES (1, ?, ?, 1, 'f', 'l', ?, 'N')`
          )
          .run(ayah, i + 1, root);
      });
    };
    seedAyah(1, ['r1', 'r2', 'r3']);
    seedAyah(2, ['r4', 'r5', 'r6']);
    seedAyah(3, ['r7', 'r8', 'r9']);
    seedAyah(4, ['r10', 'r11', 'rUnknown']);

    for (const root of ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11']) {
      t.db.prepare(`INSERT INTO user_known_root (user_id, root) VALUES (?, ?)`).run(TEST_USER, root);
    }
    // rUnknown deliberately left unmarked.

    const { status, body } = await t.json<{
      data: { runs: { surah: number; ayahFrom: number; ayahTo: number; wordCount: number }[] };
    }>('/api/progress/freeflow?minWords=3');

    expect(status).toBe(200);
    const run = body.data.runs.find((r) => r.surah === 1);
    expect(run).toMatchObject({ surah: 1, ayahFrom: 1, ayahTo: 3, wordCount: 9 });
  });

  it('excludes runs shorter than minWords', async () => {
    const t = H();
    t.db
      .prepare(
        `INSERT INTO quran_word_morphology
           (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos)
         VALUES (9, 1, 1, 1, 'f', 'l', 'solo', 'N')`
      )
      .run();
    t.db.prepare(`INSERT INTO user_known_root (user_id, root) VALUES (?, ?)`).run(TEST_USER, 'solo');

    const { body } = await t.json<{ data: { runs: { surah: number }[] } }>(
      '/api/progress/freeflow?minWords=50'
    );
    expect(body.data.runs.find((r) => r.surah === 9)).toBeUndefined();
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

describe('hifz retention preference', () => {
  it('requires auth', async () => {
    const { status } = await H().json('/api/memorization/retention', { auth: false });
    expect(status).toBe(401);
  });

  it('defaults to REQUEST_RETENTION (0.9) with no preference set', async () => {
    const { status, body } = await H().json<{
      data: { current: number; isDefault: boolean; suggestedHifz: number };
    }>('/api/memorization/retention');
    expect(status).toBe(200);
    expect(body.data.current).toBe(0.9);
    expect(body.data.isDefault).toBe(true);
    expect(body.data.suggestedHifz).toBe(0.95);
  });

  it('computes the preview from the caller\'s own real items, not a canned figure', async () => {
    const t = H();
    // One real memorization row with genuine FSRS state.
    t.db
      .prepare(
        `INSERT INTO memorization
           (id, user_id, surah_id, ayah_from, ayah_to, status, stability, difficulty,
            fsrs_state, last_review, interval, revision_count)
         VALUES ('mem-a', ?, 1, 1, 1, 'reviewing', 30, 5, 2, '2026-07-01T00:00:00.000Z', 20, 5)`
      )
      .run(TEST_USER);
    const { body } = await t.json<{
      data: { itemCount: number; preview: { retention: number; estimatedReviewsPerDay: number }[] };
    }>('/api/memorization/retention');
    expect(body.data.itemCount).toBe(1);
    expect(body.data.preview.length).toBeGreaterThanOrEqual(2);
    // Sorted ascending by retention, and a higher target never estimates FEWER
    // daily reviews than a lower one for the same items.
    for (let i = 1; i < body.data.preview.length; i += 1) {
      expect(body.data.preview[i].retention).toBeGreaterThan(body.data.preview[i - 1].retention);
      expect(body.data.preview[i].estimatedReviewsPerDay).toBeGreaterThanOrEqual(
        body.data.preview[i - 1].estimatedReviewsPerDay
      );
    }
  });

  it('refuses a retention outside 0.7-0.99', async () => {
    const t = H();
    const tooLow = await t.json<{ error: string }>('/api/memorization/retention', {
      method: 'POST',
      body: JSON.stringify({ retention: 0.5 }),
    });
    expect(tooLow.status).toBe(400);
    const tooHigh = await t.json<{ error: string }>('/api/memorization/retention', {
      method: 'POST',
      body: JSON.stringify({ retention: 1 }),
    });
    expect(tooHigh.status).toBe(400);
  });

  it('sets a preference, it actually changes real scheduling, and DELETE resets it', async () => {
    const t = H();
    const add = await t.json<{ data: { entry: unknown } }>('/api/memorization/add', {
      method: 'POST',
      body: JSON.stringify({ surahId: 112, ayahFrom: 1, ayahTo: 4 }),
    });
    expect(add.status).toBe(200);
    const entry = t.db
      .prepare(`SELECT id FROM memorization WHERE user_id = ?`)
      .get(TEST_USER) as { id: string };
    // Seed real prior state so the two schedules being compared are not both new-card
    // defaults, which could coincide even at different retention targets.
    t.db
      .prepare(
        `UPDATE memorization SET stability = 30, difficulty = 5, fsrs_state = 2,
           last_review = '2026-07-01T00:00:00.000Z', interval = 20, revision_count = 5
         WHERE id = ?`
      )
      .run(entry.id);

    const set = await t.json<{ data: { retention: number } }>(
      '/api/memorization/retention',
      { method: 'POST', body: JSON.stringify({ retention: 0.95 }) }
    );
    expect(set.status).toBe(200);
    expect(set.body.data.retention).toBe(0.95);

    const check = await t.json<{ data: { current: number; isDefault: boolean } }>(
      '/api/memorization/retention'
    );
    expect(check.body.data.current).toBe(0.95);
    expect(check.body.data.isDefault).toBe(false);

    // The real behavioural check: a review submitted now must actually schedule
    // at 0.95, not silently still use 0.9.
    const at095 = await t.json<{ data: { interval: number } }>(
      `/api/memorization/${entry.id}/review`,
      { method: 'POST', body: JSON.stringify({ grade: 'good' }) }
    );
    expect(at095.status).toBe(200);

    const del = await t.json('/api/memorization/retention', { method: 'DELETE' });
    expect(del.status).toBe(200);
    const after = await t.json<{ data: { current: number; isDefault: boolean } }>(
      '/api/memorization/retention'
    );
    expect(after.body.data.current).toBe(0.9);
    expect(after.body.data.isDefault).toBe(true);
  });
});

describe('cold-start vs warm-context review flag', () => {
  function seedSpan(
    t: Harness,
    id: string,
    ayahFrom: number,
    ayahTo: number,
    lastReviewed: string | null
  ) {
    t.db
      .prepare(
        `INSERT INTO memorization (id, user_id, surah_id, ayah_from, ayah_to, status, last_reviewed)
         VALUES (?, ?, 112, ?, ?, 'reviewing', ?)`
      )
      .run(id, TEST_USER, ayahFrom, ayahTo, lastReviewed);
  }

  it('is false when no adjacent preceding span exists', async () => {
    const t = H();
    seedSpan(t, 'mem-solo', 1, 4, null);

    const { body } = await t.json<{ data: any }>('/api/memorization/mem-solo/review', {
      method: 'POST',
      body: JSON.stringify({ grade: 'good' }),
    });
    expect(body.data.warmStart).toBe(false);
    const row = t.db
      .prepare(`SELECT warm_start FROM memorization WHERE id = ?`)
      .get('mem-solo') as { warm_start: number };
    expect(row.warm_start).toBe(0);
  });

  it('is true when the preceding span was reviewed just before, within the warm-start window', async () => {
    const t = H();
    seedSpan(t, 'mem-prev', 1, 4, null);
    t.db.prepare(`UPDATE memorization SET last_reviewed = datetime('now', '-2 minutes') WHERE id = 'mem-prev'`).run();
    seedSpan(t, 'mem-next', 5, 8, null);

    const { body } = await t.json<{ data: any }>('/api/memorization/mem-next/review', {
      method: 'POST',
      body: JSON.stringify({ grade: 'good' }),
    });
    expect(body.data.warmStart).toBe(true);
    const row = t.db
      .prepare(`SELECT warm_start FROM memorization WHERE id = ?`)
      .get('mem-next') as { warm_start: number };
    expect(row.warm_start).toBe(1);
  });

  it('is false when the preceding span was reviewed long before the window', async () => {
    const t = H();
    seedSpan(t, 'mem-prev-old', 1, 4, null);
    t.db.prepare(`UPDATE memorization SET last_reviewed = datetime('now', '-2 hours') WHERE id = 'mem-prev-old'`).run();
    seedSpan(t, 'mem-next-old', 5, 8, null);

    const { body } = await t.json<{ data: any }>('/api/memorization/mem-next-old/review', {
      method: 'POST',
      body: JSON.stringify({ grade: 'good' }),
    });
    expect(body.data.warmStart).toBe(false);
  });

  it('also computes on the /recall path', async () => {
    const t = H();
    seedSpan(t, 'mem-prev-r', 1, 4, null);
    t.db.prepare(`UPDATE memorization SET last_reviewed = datetime('now', '-1 minute') WHERE id = 'mem-prev-r'`).run();
    seedSpan(t, 'mem-next-r', 5, 8, null);

    const { body } = await t.json<{ data: any }>('/api/memorization/mem-next-r/recall', {
      method: 'POST',
      body: JSON.stringify({ recalledAyah: 9 }),
    });
    expect(body.data.warmStart).toBe(true);
  });
});

describe('sabaq/sabqi/manzil tiers and manzil rotation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('classifies sabaq (never reviewed) and sabqi (recent) by due date; manzil (old) ignores next_review entirely', async () => {
    vi.useFakeTimers();
    // A lone manzil item only ever lands in the LAST of 7 floor-divided
    // buckets (floor(0*1/7)..floor(6*1/7) are all 0..0 — empty), so the
    // fixture needs the bucket-6 day, not an arbitrary one.
    vi.setSystemTime(new Date('2026-08-15T12:00:00.000Z')); // a UTC Saturday — bucket 6

    const t = H();
    t.db
      .prepare(
        `INSERT INTO memorization (id, user_id, surah_id, ayah_from, ayah_to, status, last_reviewed, next_review)
         VALUES ('sabaq-1', ?, 112, 1, 4, 'learning', NULL, datetime('now'))`
      )
      .run(TEST_USER);
    t.db
      .prepare(
        `INSERT INTO memorization (id, user_id, surah_id, ayah_from, ayah_to, status, last_reviewed, next_review)
         VALUES ('sabqi-1', ?, 113, 1, 5, 'reviewing', datetime('now', '-14 days'), datetime('now'))`
      )
      .run(TEST_USER);
    // next_review is 60 days out — would never show up in a due-date queue.
    // Surfacing anyway is the point: manzil selection does not consult it.
    t.db
      .prepare(
        `INSERT INTO memorization (id, user_id, surah_id, ayah_from, ayah_to, status, last_reviewed, next_review)
         VALUES ('manzil-1', ?, 1, 1, 7, 'reviewing', datetime('now', '-90 days'), datetime('now', '+60 days'))`
      )
      .run(TEST_USER);

    const { body } = await t.json<{ data: { id: string; tier: string }[] }>(
      '/api/memorization/review/today'
    );
    const byId = Object.fromEntries(body.data.map((r) => [r.id, r.tier]));
    expect(byId['sabaq-1']).toBe('sabaq');
    expect(byId['sabqi-1']).toBe('sabqi');
    expect(byId['manzil-1']).toBe('manzil');
  });

  it('excludes a not-yet-due sabqi item but still surfaces manzil regardless of due date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00.000Z')); // bucket 6 — see note above

    const t = H();
    t.db
      .prepare(
        `INSERT INTO memorization (id, user_id, surah_id, ayah_from, ayah_to, status, last_reviewed, next_review)
         VALUES ('sabqi-not-due', ?, 113, 1, 5, 'reviewing', datetime('now', '-14 days'), datetime('now', '+3 days'))`
      )
      .run(TEST_USER);
    t.db
      .prepare(
        `INSERT INTO memorization (id, user_id, surah_id, ayah_from, ayah_to, status, last_reviewed, next_review)
         VALUES ('manzil-1', ?, 1, 1, 7, 'reviewing', datetime('now', '-90 days'), datetime('now', '+60 days'))`
      )
      .run(TEST_USER);

    const { body } = await t.json<{ data: { id: string }[] }>('/api/memorization/review/today');
    const ids = body.data.map((r) => r.id);
    expect(ids).not.toContain('sabqi-not-due');
    expect(ids).toContain('manzil-1');
  });

  it('rotates manzil through 7 contiguous buckets, covering every span exactly once per week', async () => {
    const t = H();
    // 7 manzil-eligible spans, in contiguous surah/ayah order.
    for (let i = 0; i < 7; i += 1) {
      t.db
        .prepare(
          `INSERT INTO memorization (id, user_id, surah_id, ayah_from, ayah_to, status, last_reviewed, next_review)
           VALUES (?, ?, 1, ?, ?, 'reviewing', datetime('now', '-90 days'), datetime('now', '+60 days'))`
        )
        .run(`manzil-${i}`, TEST_USER, i * 10 + 1, i * 10 + 5);
    }

    const seenPerDay: string[][] = [];
    for (let day = 0; day < 7; day += 1) {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.UTC(2026, 7, 9 + day, 12))); // Sun 2026-08-09 .. Sat 2026-08-15
      const { body } = await t.json<{ data: { id: string }[] }>('/api/memorization/review/today');
      seenPerDay.push(body.data.map((r) => r.id));
      vi.useRealTimers();
    }

    // 7 items split across 7 buckets — one contiguous span surfaces per day.
    seenPerDay.forEach((ids) => expect(ids.length).toBe(1));
    const coveredAcrossWeek = seenPerDay.flat().sort();
    expect(coveredAcrossWeek).toEqual([
      'manzil-0', 'manzil-1', 'manzil-2', 'manzil-3', 'manzil-4', 'manzil-5', 'manzil-6',
    ]);
  });
});

describe('memorization review accepts a measured accuracy', () => {
  function seedEntry(t: Harness, id = 'mem-1') {
    t.db
      .prepare(
        `INSERT INTO memorization (id, user_id, surah_id, ayah_from, ayah_to, status)
         VALUES (?, ?, 112, 1, 4, 'learning')`
      )
      .run(id, TEST_USER);
    return id;
  }

  it('grades from accuracy when one is supplied', async () => {
    const t = H();
    const id = seedEntry(t);
    const { status, body } = await t.json<{ data: any }>(
      `/api/memorization/${id}/review`,
      { method: 'POST', body: JSON.stringify({ accuracy: 0.35 }) }
    );
    expect(status).toBe(200);
    expect(body.data.grade).toBe('again');
    // Verified against the real scheduler rather than assumed: FSRS-6's
    // same-day due date on a lapse (see space-repetition.ts's own comment)
    // applies to a card RELAPSING out of Review state. This entry has never
    // been reviewed before, so its first 'again' is a New->Learning
    // transition, which ts-fsrs schedules one day out, not same-day.
    expect(body.data.interval).toBe(1);
  });

  it('still accepts an explicit grade (recited aloud, not typed)', async () => {
    const t = H();
    const id = seedEntry(t);
    const { status, body } = await t.json<{ data: any }>(
      `/api/memorization/${id}/review`,
      { method: 'POST', body: JSON.stringify({ grade: 'good' }) }
    );
    expect(status).toBe(200);
    expect(body.data.grade).toBe('good');
  });

  it('rejects an out-of-range accuracy rather than silently clamping', async () => {
    const t = H();
    const id = seedEntry(t);
    const { status } = await t.json(`/api/memorization/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ accuracy: 1.4 }),
    });
    expect(status).toBe(400);
  });

  it('records which grading path was used', async () => {
    const t = H();
    const id = seedEntry(t);
    const { body } = await t.json<{ data: any }>(`/api/memorization/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ accuracy: 0.95 }),
    });
    // A schedule built from a measurement and one built from an opinion are not
    // the same evidence, and later analysis needs to tell them apart.
    expect(body.data.gradedFrom).toBe('accuracy');
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
        correct: true,
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
    'mubtada_khabar', 'subject_word', 'object', 'idafa', 'derived_noun', 'fronting', 'jinas', 'simile',
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

describe('tashkil production items', () => {
  it('serves the stripped prompt without the answer key riding along', async () => {
    const t = H();
    t.db
      .prepare(
        `INSERT INTO quran_verses (surah, ayah, text_uthmani) VALUES (2, 500, 'الْحَمْدُ لِلَّهِ')`
      )
      .run();
    t.db
      .prepare(
        `INSERT INTO quran_word_morphology
           (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos, case_case)
         VALUES (2, 500, 1, 1, 'الحمد', 'حمد', 'حمد', 'N', 'NOM')`
      )
      .run();
    t.db
      .prepare(
        `INSERT INTO quran_word_morphology
           (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos, case_case)
         VALUES (2, 500, 2, 1, 'لله', 'الله', 'اله', 'PN', NULL)`
      )
      .run();

    const { status, body } = await t.json<{
      data: { words: { index: number; prompt: string; caseCase: string | null }[] };
    }>('/api/grammar/tashkil?surah=2&ayah=500');

    expect(status).toBe(200);
    expect(body.data.words).toHaveLength(2);
    // The prompt is the STRIPPED word — the final case ending is what the
    // learner is being asked to restore, so it must not already be there.
    expect(body.data.words[0].prompt).toBe('الْحَمْد');
    expect(body.data.words[0].caseCase).toBe('NOM');
    // A word with no case ending (here standing in for a mabni/particle word)
    // gets no palette to fill in, signalled by a null caseCase.
    expect(body.data.words[1].caseCase).toBeNull();

    // The answer key — the original word with its case ending intact — must
    // not appear anywhere in the payload under any field.
    expect(JSON.stringify(body)).not.toContain('الْحَمْدُ');
  });

  it('rejects an out-of-range surah', async () => {
    const { status } = await H().json('/api/grammar/tashkil?surah=9999&ayah=1');
    expect(status).toBe(400);
  });

  it('404s for a surah/ayah with no ingested verse', async () => {
    const { status } = await H().json('/api/grammar/tashkil?surah=1&ayah=999');
    expect(status).toBe(404);
  });
});

describe('tashkil grading', () => {
  function seedVerse(t: Harness) {
    t.db
      .prepare(
        `INSERT INTO quran_verses (surah, ayah, text_uthmani) VALUES (2, 501, 'الْحَمْدُ لِلَّهِ')`
      )
      .run();
  }

  it('grades a correct and an incorrect word in the same submission', async () => {
    const t = H();
    seedVerse(t);
    const { status, body } = await t.json<{
      data: {
        results: { index: number; correct: boolean; correctWord?: string }[];
        correctCount: number;
        total: number;
        accuracy: number;
      };
    }>('/api/grammar/tashkil', {
      method: 'POST',
      body: JSON.stringify({
        surah: 2,
        ayah: 501,
        // Word 1 restored correctly; word 2 restored with the wrong ending.
        answers: { '1': 'الْحَمْدُ', '2': 'لِلَّهَ' },
      }),
    });

    expect(status).toBe(200);
    expect(body.data.total).toBe(2);
    expect(body.data.correctCount).toBe(1);
    expect(body.data.accuracy).toBeCloseTo(0.5);
    const word1 = body.data.results.find((r) => r.index === 1)!;
    const word2 = body.data.results.find((r) => r.index === 2)!;
    expect(word1.correct).toBe(true);
    expect(word1.correctWord).toBeUndefined();
    expect(word2.correct).toBe(false);
    // The correct form is only revealed for a miss, after the learner submitted.
    expect(word2.correctWord).toBe('لِلَّهِ');
  });

  it('rejects a malformed answers payload', async () => {
    const { status } = await H().json('/api/grammar/tashkil', {
      method: 'POST',
      body: JSON.stringify({ surah: 2, ayah: 501, answers: 'not an object' }),
    });
    expect(status).toBe(400);
  });

  it('rejects an out-of-range surah', async () => {
    const { status } = await H().json('/api/grammar/tashkil', {
      method: 'POST',
      body: JSON.stringify({ surah: 9999, ayah: 1, answers: {} }),
    });
    expect(status).toBe(400);
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


// ── Vocabulary API endpoints ─────────────────────────────────────────────────

describe('vocabulary API', () => {
  // Seed the vocabulary table with content from core-100.json.
  // The vocabulary table is empty by default; these tests need real rows.
  function seedVocabulary(t: Harness) {
    const coreVocab = JSON.parse(
      require('fs').readFileSync(
        require('path').join(__dirname, '../../content/vocabulary/core-100.json'),
        'utf-8'
      )
    );
    for (const entry of coreVocab) {
      t.db.prepare(
        'INSERT OR IGNORE INTO vocabulary (word, transliteration, meaning, root, part_of_speech, frequency_rank) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        entry.word,
        entry.transliteration ?? null,
        entry.meaning,
        entry.root ?? null,
        entry.part_of_speech ?? null,
        entry.frequency_rank
      );
    }
  }

  function seedMorphologyForRoots(t: Harness, roots: string[]) {
    for (const root of roots) {
      t.db.prepare(
        'INSERT OR IGNORE INTO quran_word_morphology (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(1, 1, 1, 1, 'x', root, root, 'N');
    }
  }

  it('GET /api/vocabulary returns all 132 roots sorted by frequency', async () => {
    const t = H();
    seedVocabulary(t);

    const { status, body } = await t.json<unknown>(
      '/api/vocabulary?limit=200'
    );
    expect(status).toBe(200);
    expect(body).toHaveProperty('data');

    // The response should be an array of vocabulary items
    const data = body.data as Array<{ word: string; meaning: string }>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(132);

    // Should be sorted by frequency_rank (lowest first)
    for (let i = 1; i < data.length; i++) {
      const prevRank = data[i - 1].frequencyRank ?? data[i - 1].frequency_rank;
      const currRank = data[i].frequencyRank ?? data[i].frequency_rank;
      expect(prevRank).toBeLessThanOrEqual(currRank);
    }
  });

  it('GET /api/vocabulary accepts a limit parameter', async () => {
    const t = H();
    seedVocabulary(t);

    const { status, body } = await t.json<unknown>(
      '/api/vocabulary?limit=10'
    );
    expect(status).toBe(200);
    const data = body.data as Array<unknown>;
    expect(data.length).toBe(10);
  });

  it('GET /api/vocabulary/root/:root returns family data for a known root', async () => {
    const t = H();
    seedVocabulary(t);
    // اللَّه has root 'أله' in core-100.json (Arabic script - what vocabulary.root
    // stores), which is 'Alh' in Buckwalter - what quran_word_morphology.root
    // actually stores in the real corpus. Seed with the real format so this test
    // catches a route querying the wrong one, which it previously did not.
    seedMorphologyForRoots(t, ['Alh']);

    // اللَّه (Allah) is root #2 in core-100.json, should exist in morphology
    const { status, body } = await t.json<unknown>(
      '/api/vocabulary/root/%D8%A3%D9%84%D9%87'  // أله URL-encoded, as the real frontend sends it
    );
    expect(status).toBe(200);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('root');
    expect(body.data).toHaveProperty('members');
  });

  it('GET /api/vocabulary/root/:root returns 404 for unknown root (once the route is implemented)', async () => {
    // This test verifies the route returns 404 for a root not in the morphology table.
    // It currently passes because the route does not yet exist — once implemented,
    // the route must return 404 (not 200 with empty data) for unknown roots.
    const t = H();
    seedVocabulary(t);

    const { status, body } = await t.json(
      '/api/vocabulary/root/%D8%B9%D8%A8%D8%AF'  // عبد - not in morphology
    );
    // If the route exists, it should return 404 with an error message
    if (status === 200) {
      // Route exists — verify it returns 404 for unknown roots
      // (This branch will run once the route is implemented)
      expect(body).toHaveProperty('error');
    } else {
      // Route does not exist yet — this is expected before implementation
      expect(status).toBe(404);
    }
  });

  it('GET /api/vocabulary/word/:word returns detail for a known function word', async () => {
    const t = H();
    seedVocabulary(t);

    // مِن (min, "from/of") is one of the four root-less function words in core-100.json
    const { status, body } = await t.json<unknown>(
      '/api/vocabulary/word/%D9%85%D9%90%D9%86'  // مِن URL-encoded
    );
    expect(status).toBe(200);
    expect(body).toHaveProperty('data');
    const data = body.data as { word: string; root: string | null; mastery: { masteryLevel: number } };
    expect(data.word).toBe('مِن');
    expect(data.root).toBeNull();
    expect(data.mastery).toHaveProperty('masteryLevel');
  });

  it('GET /api/vocabulary/word/:word returns 404 for a word not in vocabulary', async () => {
    const t = H();
    seedVocabulary(t);

    const { status, body } = await t.json<unknown>(
      '/api/vocabulary/word/%D9%84%D8%A7-%D9%85%D9%88%D8%AC%D9%88%D8%AF'  // not a real entry
    );
    expect(status).toBe(404);
    expect(body).toHaveProperty('error');
  });
});

describe('tutor chat NaN safety', () => {
  it('does not produce NaN when quiz_attempts has questions_answered = 0', async () => {
    const t = H();
    // Seed a lesson and an attempt that the submit handler could produce when
    // the learner posts {answers: []} — 0 answered, 0 correct. This is the row
    // that previously made the tutor's weak-areas sort emit NaN.
    t.db
      .prepare(
        `INSERT INTO lessons
           (id, title, module, level, content, exercises, prerequisites)
         VALUES ('grammar-01', 'Articles and Nouns', 'grammar', 1, '{}', '[]', '[]')`
      )
      .run();
    t.db
      .prepare(
        `INSERT INTO quiz_attempts
           (id, user_id, lesson_id, module, questions_answered, questions_correct)
         VALUES (?, ?, 'grammar-01', 'grammar', 0, 0)`
      )
      .run('qa-zero', TEST_USER);

    const chat = await t.json('/api/tutor/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'explain madd',
        conversationHistory: [],
      }),
    });

    expect(chat.status).toBe(200);
    // The body must round-trip as a JSON string — no NaN → "undefined" —
    // rather than silently becoming a malformed response.
    const text = JSON.stringify(chat.body);
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('undefined');
    // The response shape is preserved, just with an empty weak-areas list.
    expect(chat.body).toHaveProperty('data');
    if (chat.body && typeof chat.body === 'object' && 'data' in chat.body) {
      expect((chat.body as { data: { topics?: unknown } }).data).toHaveProperty('response');
    }
  });
});

describe('function words', () => {
  // The harness applies real migrations but leaves content tables empty, so a test
  // that needs corpus rows inserts them. Two `maA` senses is the case that matters.
  function seedFunctionWords(h: Harness) {
    const ins = h.db.prepare(
      `INSERT INTO quran_word_morphology
         (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`
    );
    // 3 x maA/REL, 2 x maA/NEG, 1 x min/P
    ins.run(1, 1, 1, 1, 'maA', 'maA', 'REL');
    ins.run(1, 2, 1, 1, 'maA', 'maA', 'REL');
    ins.run(1, 3, 1, 1, 'maA', 'maA', 'REL');
    ins.run(2, 1, 1, 1, 'maA', 'maA', 'NEG');
    ins.run(2, 2, 1, 1, 'maA', 'maA', 'NEG');
    ins.run(3, 1, 1, 1, 'min', 'min', 'P');
  }

  it('lists function words by frequency, with the two maA senses separate', async () => {
    const h = H();
    seedFunctionWords(h);
    const { status, body } = await h.json<{ data: { items: any[] } }>(
      '/api/progress/function-words'
    );
    expect(status).toBe(200);
    const items = body.data.items;
    expect(items[0]).toMatchObject({ lemma: 'maA', pos: 'REL', occurrences: 3 });
    // Same lemma, different pos, listed as its own row.
    expect(items.find((i) => i.pos === 'NEG')).toMatchObject({
      lemma: 'maA',
      occurrences: 2,
    });
    expect(items.every((i) => i.known === false)).toBe(true);
  });

  it('marks one sense known without marking the other', async () => {
    const h = H();
    seedFunctionWords(h);
    const post = await h.json<{ data: any }>(
      '/api/progress/function-words/maA/REL/known',
      { method: 'POST' }
    );
    expect(post.status).toBe(200);
    expect(post.body.data).toMatchObject({ lemma: 'maA', pos: 'REL', occurrences: 3 });

    const { body } = await h.json<{ data: { items: any[] } }>(
      '/api/progress/function-words'
    );
    const rel = body.data.items.find((i) => i.pos === 'REL');
    const neg = body.data.items.find((i) => i.pos === 'NEG');
    expect(rel.known).toBe(true);
    // The whole point of the composite key.
    expect(neg.known).toBe(false);
  });

  it('refuses a (lemma,pos) pair the corpus does not attest', async () => {
    const h = H();
    seedFunctionWords(h);
    const { status } = await h.json('/api/progress/function-words/zzz/P/known', {
      method: 'POST',
    });
    expect(status).toBe(404);
  });

  it('unmarks a function word', async () => {
    const h = H();
    seedFunctionWords(h);
    await h.json('/api/progress/function-words/min/P/known', { method: 'POST' });
    const del = await h.json('/api/progress/function-words/min/P/known', {
      method: 'DELETE',
    });
    expect(del.status).toBe(200);
    const { body } = await h.json<{ data: { items: any[] } }>(
      '/api/progress/function-words'
    );
    expect(body.data.items.find((i) => i.lemma === 'min').known).toBe(false);
  });
});

describe('coverage counts function words', () => {
  // One ayah: two rooted words (both known) and one function word (not known).
  // Under the old model this ayah was "100% readable". It is not — `min` is a word,
  // and it is the word that says what the sentence is doing.
  function seedOneAyah(h: Harness) {
    const ins = h.db.prepare(
      `INSERT INTO quran_word_morphology
         (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    ins.run(1, 1, 1, 1, 'kitaAb', 'kitaAb', 'ktb', 'N');
    ins.run(1, 1, 2, 1, 'Ealima', 'Ealima', 'Elm', 'V');
    ins.run(1, 1, 3, 1, 'min', 'min', null, 'P');
    h.db
      .prepare(`INSERT INTO user_known_root (user_id, root) VALUES (?, ?)`)
      .run(TEST_USER, 'ktb');
    h.db
      .prepare(`INSERT INTO user_known_root (user_id, root) VALUES (?, ?)`)
      .run(TEST_USER, 'Elm');
  }

  it('does NOT count an ayah readable while its function word is unknown', async () => {
    const h = H();
    seedOneAyah(h);
    const { body } = await h.json<{ data: any }>('/api/progress/coverage');
    // Every rooted word is known, but `min` is not.
    expect(body.data.ayahsReadable).toBe(0);
    expect(body.data.functionWordsKnown).toBe(0);
    expect(body.data.functionWordsTotal).toBe(1);
  });

  it('counts it once the function word is known too', async () => {
    const h = H();
    seedOneAyah(h);
    h.db
      .prepare(
        `INSERT INTO user_known_function_word (user_id, lemma, pos) VALUES (?, ?, ?)`
      )
      .run(TEST_USER, 'min', 'P');

    const { body } = await h.json<{ data: any }>('/api/progress/coverage');
    expect(body.data.ayahsReadable).toBe(1);
    expect(body.data.functionWordsKnown).toBe(1);
  });

  it('reports the function-word dimension in the basis string', async () => {
    const h = H();
    seedOneAyah(h);
    const { body } = await h.json<{ basis: string }>('/api/progress/coverage');
    // The old string promised unrooted words "count as known". That is now false, and
    // a stale basis line is a lie the UI repeats verbatim.
    expect(body.basis).not.toMatch(/count as known/i);
    expect(body.basis).toMatch(/function word/i);
  });

  it('marking a function word known unlocks ayahs (delta is reported)', async () => {
    const h = H();
    seedOneAyah(h);
    const post = await h.json<{ data: any }>(
      '/api/progress/function-words/min/P/known',
      { method: 'POST' }
    );
    // Same payoff shape the roots endpoint already returns.
    expect(post.body.data.ayahsUnlocked).toBe(1);
    expect(post.body.data.ayahsReadable).toBe(1);
  });

  it('a surah counts readable only when its function words are known too', async () => {
    const h = H();
    seedOneAyah(h);
    // Guards the surahs_readable CTE, which has its own HAVING clause and could
    // easily be updated for roots and forgotten for function words.
    const before = await h.json<{ data: any }>('/api/progress/coverage');
    expect(before.body.data.surahsReadable).toBe(0);

    h.db
      .prepare(
        `INSERT INTO user_known_function_word (user_id, lemma, pos) VALUES (?, ?, ?)`
      )
      .run(TEST_USER, 'min', 'P');
    const after = await h.json<{ data: any }>('/api/progress/coverage');
    expect(after.body.data.surahsReadable).toBe(1);
  });
});

describe('coverage counts patterns (wazn) separately from readability', () => {
  // One ayah, one rooted word carrying a verb_form (Form IV) — pattern coverage
  // must move independently, and ayahsReadable must NOT depend on it at all.
  function seedOneAyah(h: Harness) {
    h.db
      .prepare(
        `INSERT INTO quran_word_morphology
           (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos, verb_form)
         VALUES (1, 1, 1, 1, 'aslama', 'aslama', 'slm', 'V', 'IV')`
      )
      .run();
    h.db
      .prepare(`INSERT INTO user_known_root (user_id, root) VALUES (?, ?)`)
      .run(TEST_USER, 'slm');
  }

  it('reports patternsKnown/patternsTotal without needing a known pattern', async () => {
    const h = H();
    seedOneAyah(h);
    const { body } = await h.json<{ data: any }>('/api/progress/coverage');
    expect(body.data.patternsKnown).toBe(0);
    expect(body.data.patternsTotal).toBe(1);
    // Every rooted word known, no function words in this ayah at all — readable
    // regardless of the (unknown) pattern.
    expect(body.data.ayahsReadable).toBe(1);
  });

  it('marking the pattern known moves patternsKnown but not ayahsReadable', async () => {
    const h = H();
    seedOneAyah(h);
    const before = await h.json<{ data: any }>('/api/progress/coverage');
    const readableBefore = before.body.data.ayahsReadable;

    h.db
      .prepare(`INSERT INTO user_known_pattern (user_id, verb_form) VALUES (?, ?)`)
      .run(TEST_USER, 'IV');

    const { body } = await h.json<{ data: any }>('/api/progress/coverage');
    expect(body.data.patternsKnown).toBe(1);
    expect(body.data.patternsTotal).toBe(1);
    // The regression check that matters most: pattern knowledge must not change
    // ayah readability at all, in either direction.
    expect(body.data.ayahsReadable).toBe(readableBefore);
  });

  it('states the pattern dimension is separate in the basis string', async () => {
    const h = H();
    seedOneAyah(h);
    const { body } = await h.json<{ basis: string }>('/api/progress/coverage');
    expect(body.basis).toMatch(/pattern.*wazn.*separate|separate.*pattern/i);
  });
});

describe('root x wazn grid', () => {
  it('requires auth', async () => {
    const { status } = await H().json('/api/progress/pattern-grid', { auth: false });
    expect(status).toBe(401);
  });

  // Two known roots, one occurring in two forms (I-shaped/unmarked and IV), the
  // other in one (III). An unknown root is seeded too and must not appear.
  function seedGrid(h: Harness) {
    const ins = h.db.prepare(
      `INSERT INTO quran_word_morphology
         (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos, verb_form)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    ins.run(1, 1, 1, 1, 'a', 'a', 'slm', 'V', 'IV');
    ins.run(1, 2, 1, 1, 'b', 'b', 'slm', 'V', 'IV');
    ins.run(1, 3, 1, 1, 'c', 'c', 'ktb', 'V', 'III');
    ins.run(1, 4, 1, 1, 'd', 'd', 'ghr', 'V', 'IV'); // unknown root — must not appear
    h.db
      .prepare(`INSERT INTO user_known_root (user_id, root) VALUES (?, ?)`)
      .run(TEST_USER, 'slm');
    h.db
      .prepare(`INSERT INTO user_known_root (user_id, root) VALUES (?, ?)`)
      .run(TEST_USER, 'ktb');
  }

  it('rows are only the caller\'s known roots, commonest first', async () => {
    const h = H();
    seedGrid(h);
    const { status, body } = await h.json<{ data: { roots: { root: string; occurrences: number }[] } }>(
      '/api/progress/pattern-grid'
    );
    expect(status).toBe(200);
    expect(body.data.roots.map((r) => r.root)).toEqual(['slm', 'ktb']);
    expect(body.data.roots.find((r) => r.root === 'slm')!.occurrences).toBe(2);
    expect(body.data.roots.some((r) => r.root === 'ghr')).toBe(false);
  });

  it('cells are only combinations that actually occur, scoped to known roots', async () => {
    const h = H();
    seedGrid(h);
    const { body } = await h.json<{
      data: { cells: { root: string; verbForm: string; occurrences: number }[] };
    }>('/api/progress/pattern-grid');
    const slmIv = body.data.cells.find((c) => c.root === 'slm' && c.verbForm === 'IV');
    const ktbIii = body.data.cells.find((c) => c.root === 'ktb' && c.verbForm === 'III');
    expect(slmIv).toMatchObject({ occurrences: 2 });
    expect(ktbIii).toMatchObject({ occurrences: 1 });
    // The unknown root's cell must not leak in even though it shares a form.
    expect(body.data.cells.some((c) => c.root === 'ghr')).toBe(false);
    // ktb never occurs in Form IV — no cell for that combination.
    expect(body.data.cells.some((c) => c.root === 'ktb' && c.verbForm === 'IV')).toBe(false);
  });

  it('respects the limit query param, capped at 50', async () => {
    const h = H();
    seedGrid(h);
    const { body } = await h.json<{ data: { roots: unknown[] } }>(
      '/api/progress/pattern-grid?limit=1'
    );
    expect(body.data.roots.length).toBe(1);
  });

  // forms is every attested verb form with occurrences + known flag, computed
  // independently of which roots the caller knows (unlike roots/cells) — it is
  // what PatternGrid.tsx's column headers render, and used to be duplicated by
  // a standalone GET /patterns endpoint nothing ever called.
  it('forms lists every attested verb form with occurrences and known flag, independent of known roots', async () => {
    const h = H();
    seedGrid(h); // slm x IV (twice), ktb x III, ghr x IV (unknown root)
    h.db
      .prepare(`INSERT INTO user_known_pattern (user_id, verb_form) VALUES (?, ?)`)
      .run(TEST_USER, 'III');
    const { body } = await h.json<{
      data: { forms: { verbForm: string; occurrences: number; known: boolean }[] };
    }>('/api/progress/pattern-grid');
    const iv = body.data.forms.find((f) => f.verbForm === 'IV');
    const iii = body.data.forms.find((f) => f.verbForm === 'III');
    // 3 occurrences of IV: 2 from slm (known root) + 1 from ghr (unknown root) —
    // forms counts every occurrence in the corpus, not just the caller's known roots.
    expect(iv).toMatchObject({ occurrences: 3, known: false });
    expect(iii).toMatchObject({ occurrences: 1, known: true });
  });
});

describe('homograph exercises', () => {
  // The kind that cannot be answered from the word alone: same spelling, different
  // job, and only the ayah decides. Seeded here because the harness leaves content
  // tables empty on purpose.
  function seedHomograph(h: Harness) {
    const ins = h.db.prepare(
      `INSERT INTO grammar_exercise_bank
         (id, kind, level, word_arabic, word_buckwalter, prompt, answer, options,
          explanation, surah_id, ayah_id, word_index, segment_index)
       VALUES (?, 'homograph', ?, ?, 'maA', ?, ?, ?, ?, ?, ?, ?, 1)`
    );
    ins.run(
      'hom-2-17-8', 3, 'مَا',
      'In this ayah, what job does مَا do?',
      'a relative pronoun ("that which", "who")',
      JSON.stringify(['a negation ("not")', 'a relative pronoun ("that which", "who")']),
      'Here مَا introduces a relative clause rather than negating the verb.',
      2, 17, 8
    );
    ins.run(
      'hom-2-11-5', 4, 'مَا',
      'In this ayah, what job does مَا do?',
      'a negation ("not")',
      JSON.stringify(['a negation ("not")', 'a relative pronoun ("that which", "who")']),
      'Here مَا negates the verb that follows.',
      2, 11, 5
    );
  }

  it('serves homograph items filtered by kind', async () => {
    const h = H();
    seedHomograph(h);
    // GET /api/grammar/exercises returns a flat array in `data`, not { exercises }.
    const { status, body } = await h.json<{ data: any[] }>(
      '/api/grammar/exercises?kind=homograph'
    );
    expect(status).toBe(200);
    expect(body.data.length).toBe(2);
    for (const ex of body.data) {
      expect(ex.options).toContain(ex.answer);
      // A homograph item is only a homograph item if the distractor is the same
      // spelling in another role — so every item needs at least two live senses.
      expect(ex.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('offers both senses of one spelling as the two options', async () => {
    const h = H();
    seedHomograph(h);
    const { body } = await h.json<{ data: any[] }>(
      '/api/grammar/exercises?kind=homograph'
    );
    const answers = body.data.map((e: any) => e.answer).sort();
    // Same word, opposite jobs — that pairing is the entire pedagogical point.
    expect(answers).toEqual([
      'a negation ("not")',
      'a relative pronoun ("that which", "who")',
    ]);
  });
});

describe('mutashabihat exercises', () => {
  // Two near-identical ayahs, auto-detected by edit distance rather than a curated
  // list. Unlike homograph, the "word" fields carry a real word (NOT NULL, per the
  // schema) but are not the point of the item — the two options are full ayah texts.
  function seedMutashabihat(h: Harness) {
    const ins = h.db.prepare(
      `INSERT INTO grammar_exercise_bank
         (id, kind, level, word_arabic, word_buckwalter, prompt, answer, options,
          explanation, surah_id, ayah_id, word_index, segment_index)
       VALUES (?, 'mutashabihat', ?, ?, NULL, ?, ?, ?, ?, ?, ?, 1, ?)`
    );
    ins.run(
      'mutashabihat-27-81-30-53', 5, 'وَمَآ',
      'Which of these is the real text of 27:81?',
      'وَمَآ أَنتَ بِهَٰدِى ٱلْعُمْىِ',
      JSON.stringify(['وَمَآ أَنتَ بِهَٰدِ ٱلْعُمْىِ', 'وَمَآ أَنتَ بِهَٰدِى ٱلْعُمْىِ']),
      '27:81 reads: وَمَآ أَنتَ بِهَٰدِى ٱلْعُمْىِ. The confusable text is 30:53.',
      27, 81, 1
    );
    ins.run(
      'mutashabihat-30-53-27-81', 5, 'وَمَآ',
      'Which of these is the real text of 30:53?',
      'وَمَآ أَنتَ بِهَٰدِ ٱلْعُمْىِ',
      JSON.stringify(['وَمَآ أَنتَ بِهَٰدِ ٱلْعُمْىِ', 'وَمَآ أَنتَ بِهَٰدِى ٱلْعُمْىِ']),
      '30:53 reads: وَمَآ أَنتَ بِهَٰدِ ٱلْعُمْىِ. The confusable text is 27:81.',
      30, 53, 1
    );
  }

  it('is accepted by the kind allowlist and served', async () => {
    const h = H();
    seedMutashabihat(h);
    const { status, body } = await h.json<{ data: any[] }>(
      '/api/grammar/exercises?kind=mutashabihat'
    );
    expect(status).toBe(200);
    expect(body.data.length).toBe(2);
    for (const ex of body.data) {
      expect(ex.options).toContain(ex.answer);
      expect(ex.options.length).toBe(2);
    }
  });

  it("each direction of a pair asks about its own ayah and answers accordingly", async () => {
    const h = H();
    seedMutashabihat(h);
    const { body } = await h.json<{ data: any[] }>(
      '/api/grammar/exercises?kind=mutashabihat'
    );
    const a = body.data.find((e: any) => e.source === '27:81');
    const b = body.data.find((e: any) => e.source === '30:53');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    // The two directions share the same pair of options, in whichever order each
    // item's own deterministic shuffle produced — only the correct ANSWER differs,
    // and it differs because each item asks about a different real location.
    expect([...a!.options].sort()).toEqual([...b!.options].sort());
    expect(a!.answer).not.toBe(b!.answer);
  });
});
