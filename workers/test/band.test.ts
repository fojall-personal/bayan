import { afterEach, describe, expect, it } from 'vitest';
import {
  assignBand,
  bandAfterCalibration,
  BOOK_LESSON_IDS,
  gateItems,
  gateReady,
  gradeTypedRoot,
  rollingAccuracy,
} from '../src/lib/band';
import { shouldEmitGovernor } from '../src/lib/governor';
import { normalizeArabic } from '../src/routes/learning';
import { harness, TEST_USER, type Harness } from './helpers/harness';

describe('assignBand', () => {
  it('backfills path3 to qatr, path2 to ajurrumiyya, path1+0 roots to foundation', () => {
    expect(
      assignBand({ source: 'backfill', currentPath: 'path3', rootsKnown: 0 })
    ).toBe('qatr');
    expect(
      assignBand({ source: 'backfill', currentPath: 'path2', rootsKnown: 0 })
    ).toBe('ajurrumiyya');
    expect(
      assignBand({ source: 'backfill', currentPath: 'path1', rootsKnown: 0 })
    ).toBe('foundation');
    expect(
      assignBand({ source: 'backfill', currentPath: 'path1', rootsKnown: 12 })
    ).toBe('ajurrumiyya');
  });

  it('onboarding: no → foundation, otherwise ajurrumiyya', () => {
    expect(assignBand({ source: 'onboarding', readingAbility: 'no', rootsKnown: 0 })).toBe(
      'foundation'
    );
    expect(assignBand({ source: 'onboarding', readingAbility: 'yes', rootsKnown: 0 })).toBe(
      'ajurrumiyya'
    );
  });

  it('placement uses literacy then weakest then composite', () => {
    expect(
      assignBand({
        source: 'placement',
        rootsKnown: 0,
        scores: { literacy: 50, comprehension: 80, grammar: 80, memorization: 80 },
      })
    ).toBe('foundation');
    expect(
      assignBand({
        source: 'placement',
        rootsKnown: 0,
        scores: { literacy: 80, comprehension: 30, grammar: 80, memorization: 80 },
      })
    ).toBe('ajurrumiyya');
    expect(
      assignBand({
        source: 'placement',
        rootsKnown: 0,
        scores: { literacy: 80, comprehension: 80, grammar: 80, memorization: 80 },
      })
    ).toBe('alfiyya');
    expect(
      assignBand({
        source: 'placement',
        rootsKnown: 0,
        scores: { literacy: 70, comprehension: 50, grammar: 50, memorization: 50 },
      })
    ).toBe('qatr');
  });
});

describe('bandAfterCalibration', () => {
  it('lowers qatr/alfiyya to ajurrumiyya when rootsKnown is 0 and never raises', () => {
    expect(bandAfterCalibration('qatr', 0)).toBe('ajurrumiyya');
    expect(bandAfterCalibration('alfiyya', 0)).toBe('ajurrumiyya');
    expect(bandAfterCalibration('foundation', 400)).toBe('foundation');
    expect(bandAfterCalibration('ajurrumiyya', 400)).toBe('ajurrumiyya');
    expect(bandAfterCalibration('qatr', 10)).toBe('qatr');
  });
});

describe('gateReady', () => {
  const item = (met: boolean, deferred = false) => ({
    id: 'x',
    label: 'x',
    current: met ? 1 : 0,
    target: 1,
    met,
    deferred,
  });

  it('is false when every item is deferred', () => {
    expect(gateReady([item(false, true), item(false, true)])).toBe(false);
  });

  it('is false for an empty list (irab)', () => {
    expect(gateReady([])).toBe(false);
  });

  it('is true when every blocking item is met, even if a deferred item is unmet', () => {
    expect(gateReady([item(true), item(false, true)])).toBe(true);
  });

  it('is false when a blocking item is unmet', () => {
    expect(gateReady([item(true), item(false)])).toBe(false);
  });
});

describe('rollingAccuracy', () => {
  it('is unmet when fewer than N rows exist', () => {
    expect(rollingAccuracy([{ correct: 1 }, { correct: 1 }], 20)).toEqual({
      current: 2,
      met: false,
    });
  });

  it('uses the last N rows', () => {
    const miss = Array.from({ length: 20 }, () => ({ correct: 0 }));
    const hit = Array.from({ length: 20 }, () => ({ correct: 1 }));
    expect(rollingAccuracy([...miss, ...hit], 20)).toEqual({ current: 100, met: true });
  });
});

describe('BOOK_LESSON_IDS', () => {
  it('lists the five authored Qatr lessons in sheet order', () => {
    expect([...BOOK_LESSON_IDS.qatr]).toEqual([
      'grammar-04',
      'grammar-07',
      'grammar-08',
      'grammar-09',
      'grammar-10',
      'grammar-12',
    ]);
  });
});

describe('gateItems foundation deferred', () => {
  it('defers literacy and script when no rows and no assessment', () => {
    const items = gateItems('foundation', {
      completedOrSkipped: new Set(),
      literacyLessonIds: [],
      rootsKnown: 0,
      topPairKnown: 0,
      pairTarget: 0,
      accuracy: {},
      patternsKnown: new Set(),
      governorKindExists: false,
      homographKindExists: false,
      tashkilPersisted: false,
    });
    expect(items.every((i) => i.deferred)).toBe(true);
    expect(gateReady(items)).toBe(false);
  });
});

describe('gradeTypedRoot', () => {
  it('grades اله equal to space-stripped ا ل ه and keeps normalizeArabic spaced inequality', () => {
    expect(normalizeArabic('اله') === normalizeArabic('ا ل ه')).toBe(false);
    expect(gradeTypedRoot('اله', 'اله', normalizeArabic)).toBe(true);
    expect(gradeTypedRoot('ا ل ه', 'اله', normalizeArabic)).toBe(true);
  });
});

describe('shouldEmitGovernor', () => {
  it('emits Obj+verb+ACC and Subj+verb+NOM and Poss+GEN', () => {
    expect(
      shouldEmitGovernor({ rel: 'Obj', headPos: 'V', depCase: 'ACC', headImplied: 0 })
    ).toBe(true);
    expect(
      shouldEmitGovernor({ rel: 'Subj', headPos: 'V', depCase: 'NOM', headImplied: 0 })
    ).toBe(true);
    expect(
      shouldEmitGovernor({ rel: 'Poss', headPos: 'N', depCase: 'GEN', headImplied: 0 })
    ).toBe(true);
  });

  it('drops Pred even when case concurs', () => {
    expect(
      shouldEmitGovernor({ rel: 'Pred', headPos: 'N', depCase: 'NOM', headImplied: 0 })
    ).toBe(false);
  });
});

let h: Harness | null = null;
afterEach(() => {
  h?.close();
  h = null;
});
const H = () => (h ??= harness());

describe('GET /api/progress/band', () => {
  it('returns a band for the seeded user and ready=false when items are deferred', async () => {
    const { status, body } = await H().json<{
      data: { band: string; gate: { ready: boolean; items: { deferred: boolean }[] } };
    }>('/api/progress/band');
    expect(status).toBe(200);
    expect(body.data.band).toBe('foundation');
    expect(body.data.gate.ready).toBe(false);
  });

  it('lists each book\'s authored lesson ids; Qatr is grammar-04/07/08/09/10', async () => {
    const db = H().db;
    db.prepare(
      `INSERT INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes)
       VALUES
         ('grammar-02', 'Past', 'grammar', 1, '{}', '[]', '[]', 10),
         ('grammar-04', 'Present', 'grammar', 2, '{}', '[]', '["grammar-02"]', 10)`
    ).run();
    db.prepare(
      `INSERT INTO lesson_progress (user_id, lesson_id, module, completed, score)
       VALUES (?, 'grammar-02', 'grammar', 1, 80)`
    ).run(TEST_USER);

    const { status, body } = await H().json<{
      data: {
        books: Record<
          string,
          Array<{ id: string; title: string; completed: boolean; available: boolean }>
        >;
      };
    }>('/api/progress/band');
    expect(status).toBe(200);
    expect(body.data.books.qatr.map((l) => l.id)).toEqual([
      'grammar-04',
      'grammar-07',
      'grammar-08',
      'grammar-09',
      'grammar-10',
      'grammar-12',
    ]);
    expect(body.data.books.irab).toEqual([]);
    const present = body.data.books.qatr.find((l) => l.id === 'grammar-04');
    expect(present?.title).toBe('Present');
    expect(present?.available).toBe(true);
    expect(present?.completed).toBe(false);
  });
});

describe('GET /api/learning/next authored split', () => {
  it('returns grammar-01, never root-Alh, when both are unlocked', async () => {
    const db = H().db;
    db.prepare(
      `INSERT INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes)
       VALUES
         ('root-Alh', 'Allah', 'grammar', 1, '{}', '[]', '[]', 10),
         ('grammar-01', 'Articles', 'grammar', 1, '{}', '[]', '[]', 10)`
    ).run();
    const { body } = await H().json<{ data: { lesson: { id: string } | null } }>(
      '/api/learning/next'
    );
    expect(body.data.lesson?.id).toBe('grammar-01');
  });

  it('after grammar-01..03 the next authored id is grammar-04 when the band allows it', async () => {
    const db = H().db;
    db.prepare(`UPDATE users SET current_band = 'qatr', band_source = 'manual' WHERE id = ?`).run(
      TEST_USER
    );
    for (const id of ['grammar-01', 'grammar-02', 'grammar-03', 'grammar-04', 'grammar-05']) {
      db.prepare(
        `INSERT INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes)
         VALUES (?, ?, 'grammar', ?, '{}', '[]', ?, 10)`
      ).run(
        id,
        id,
        id <= 'grammar-03' ? 1 : 2,
        id === 'grammar-01' ? '[]' : JSON.stringify(['grammar-01'])
      );
    }
    db.prepare(
      `INSERT INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes)
       VALUES ('root-Alh', 'Allah', 'grammar', 1, '{}', '[]', '[]', 10)`
    ).run();
    for (const id of ['grammar-01', 'grammar-02', 'grammar-03']) {
      db.prepare(
        `INSERT INTO lesson_progress (user_id, lesson_id, module, completed, score)
         VALUES (?, ?, 'grammar', 1, 80)`
      ).run(TEST_USER, id);
    }
    const { body } = await H().json<{ data: { lesson: { id: string } | null } }>(
      '/api/learning/next'
    );
    expect(body.data.lesson?.id).toBe('grammar-04');
  });

  it('returns a seeded literacy-01 ahead of grammar-01', async () => {
    const db = H().db;
    db.prepare(
      `INSERT INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes)
       VALUES
         ('literacy-01', 'Letters', 'literacy', 1, '{}', '[]', '[]', 10),
         ('grammar-01', 'Articles', 'grammar', 1, '{}', '[]', '[]', 10)`
    ).run();
    const { body } = await H().json<{ data: { lesson: { id: string } | null } }>(
      '/api/learning/next'
    );
    expect(body.data.lesson?.id).toBe('literacy-01');
  });

  it('ajurrumiyya never nexts grammar-04 or grammar-11', async () => {
    const db = H().db;
    db.prepare(
      `UPDATE users SET current_band = 'ajurrumiyya', band_source = 'manual' WHERE id = ?`
    ).run(TEST_USER);
    for (const [id, level] of [
      ['grammar-01', 1],
      ['grammar-04', 2],
      ['grammar-11', 3],
    ] as const) {
      db.prepare(
        `INSERT INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes)
         VALUES (?, ?, 'grammar', ?, '{}', '[]', '[]', 10)`
      ).run(id, id, level);
    }
    const { body } = await H().json<{ data: { lesson: { id: string } | null } }>(
      '/api/learning/next'
    );
    expect(body.data.lesson?.id).toBe('grammar-01');
    db.prepare(
      `INSERT INTO lesson_progress (user_id, lesson_id, module, completed, score)
       VALUES (?, 'grammar-01', 'grammar', 1, 80)`
    ).run(TEST_USER);
    const second = await H().json<{ data: { lesson: { id: string } | null } }>(
      '/api/learning/next'
    );
    expect(second.body.data.lesson).toBeNull();
  });
});

describe('POST /api/learning/lessons/:id/submit skipped', () => {
  it('marks completed and skipped, and a later pass clears skipped', async () => {
    H()
      .db.prepare(
        `INSERT INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes)
         VALUES ('grammar-01', 'Articles', 'grammar', 1, '{}',
           '[{"type":"multiple_choice","question":"q","options":["a","b"],"correct":0,"explanation":"Because the article is ال."}]',
           '[]', 10)`
      )
      .run();
    const skip = await H().json<{ data: { skipped: boolean; completed: boolean } }>(
      '/api/learning/lessons/grammar-01/submit',
      { method: 'POST', body: JSON.stringify({ skipped: true }) }
    );
    expect(skip.status).toBe(200);
    expect(skip.body.data.skipped).toBe(true);
    const row = H()
      .db.prepare(
        `SELECT completed, skipped, score FROM lesson_progress WHERE user_id = ? AND lesson_id = 'grammar-01'`
      )
      .get(TEST_USER) as { completed: number; skipped: number; score: number };
    expect(row.completed).toBe(1);
    expect(row.skipped).toBe(1);

    const pass = await H().json('/api/learning/lessons/grammar-01/submit', {
      method: 'POST',
      body: JSON.stringify({ answers: [0] }),
    });
    expect(pass.status).toBe(200);
    const after = H()
      .db.prepare(
        `SELECT completed, skipped, score FROM lesson_progress WHERE user_id = ? AND lesson_id = 'grammar-01'`
      )
      .get(TEST_USER) as { completed: number; skipped: number; score: number };
    expect(after.skipped).toBe(0);
    expect(after.score).toBeGreaterThanOrEqual(70);
  });
});

describe('GET /api/progress/band/skip-quiz', () => {
  it('puts the three nawāsikh items on the Qaṭr check', async () => {
    H().db.prepare(`UPDATE users SET current_band = 'qatr', band_source = 'manual' WHERE id = ?`).run(
      TEST_USER
    );
    const { status, body } = await H().json<{
      data: { band: string; items: { id: string }[] };
    }>('/api/progress/band/skip-quiz');
    expect(status).toBe(200);
    const ids = body.data.items.map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining(['nawasikh-kana', 'nawasikh-inna', 'nawasikh-innama'])
    );
  });
});

describe('POST /api/progress/band/advance skip-quiz Qaṭr nawāsikh', () => {
  it('advances Qaṭr at 3/3 nawāsikh and refuses at 2/3', async () => {
    H().db.prepare(`UPDATE users SET current_band = 'qatr', band_source = 'manual' WHERE id = ?`).run(
      TEST_USER
    );
    const miss = await H().json('/api/progress/band/advance', {
      method: 'POST',
      body: JSON.stringify({
        evidence: 'skip-quiz',
        answers: [
          { id: 'nawasikh-kana', given: 0 },
          { id: 'nawasikh-inna', given: 0 },
          { id: 'nawasikh-innama', given: 1 },
        ],
      }),
    });
    expect(miss.status).toBe(409);

    const ok = await H().json<{ data: { band: string } }>('/api/progress/band/advance', {
      method: 'POST',
      body: JSON.stringify({
        evidence: 'skip-quiz',
        answers: [
          { id: 'nawasikh-kana', given: 0 },
          { id: 'nawasikh-inna', given: 0 },
          { id: 'nawasikh-innama', given: 0 },
        ],
      }),
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.band).toBe('alfiyya');
  });
});

describe('POST /api/progress/band/advance skip-quiz', () => {
  it('advances foundation at 70% and refuses at 65%', async () => {
    const failAnswers = [
      { id: 'script-1', given: 0 },
      { id: 'script-2', given: 0 },
      { id: 'script-3', given: 1 },
      { id: 'script-4', given: 1 },
      { id: 'script-5', given: 2 },
      { id: 'script-6', given: 0 },
      { id: 'script-7', given: 1 },
      { id: 'script-8', given: 0 },
    ];
    const miss = await H().json('/api/progress/band/advance', {
      method: 'POST',
      body: JSON.stringify({ evidence: 'skip-quiz', answers: failAnswers }),
    });
    expect(miss.status).toBe(409);

    const passAnswers = [
      { id: 'script-1', given: 0 },
      { id: 'script-2', given: 0 },
      { id: 'script-3', given: 1 },
      { id: 'script-4', given: 1 },
      { id: 'script-5', given: 2 },
      { id: 'script-6', given: 2 },
      { id: 'script-7', given: 0 },
      { id: 'script-8', given: 1 },
    ];
    const ok = await H().json<{ data: { band: string; evidence: string } }>(
      '/api/progress/band/advance',
      { method: 'POST', body: JSON.stringify({ evidence: 'skip-quiz', answers: passAnswers }) }
    );
    expect(ok.status).toBe(200);
    expect(ok.body.data.band).toBe('ajurrumiyya');
    expect(ok.body.data.evidence).toBe('skip-quiz');
  });
});

describe('POST /api/progress/patterns/I/known', () => {
  it('returns 200 when Form I verbs exist and 404 when they do not', async () => {
    const empty = await H().json('/api/progress/patterns/I/known', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(empty.status).toBe(404);

    H()
      .db.prepare(
        `INSERT INTO quran_word_morphology
           (surah_id, ayah_id, word_index, segment_index, form, tag, pos)
         VALUES (1, 1, 1, 1, 'kataba', 'V', 'V')`
      )
      .run();
    H()
      .db.prepare(`UPDATE users SET current_band = 'ajurrumiyya', band_source = 'manual' WHERE id = ?`)
      .run(TEST_USER);
    const ok = await H().json('/api/progress/patterns/I/known', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(ok.status).toBe(200);
  });
});
