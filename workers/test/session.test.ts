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
  type: 'hifz' | 'vocabulary' | 'lesson';
  label: string;
  estimatedSeconds: number;
  payload: Record<string, unknown>;
}

interface SessionPlan {
  sessionId: string;
  items: SessionItem[];
  plannedSeconds: number;
  summary: { hifz: number; vocabulary: number; lesson: number };
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

describe('GET /api/session/plan', () => {
  it('answers 200 with an empty plan when nothing is due', async () => {
    const { status, body } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
    expect(body.data.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(body.data.items).toEqual([]);
    expect(body.data.plannedSeconds).toBe(0);
    expect(body.data.summary).toEqual({ hifz: 0, vocabulary: 0, lesson: 0 });
  });

  it('does not persist an empty plan', async () => {
    await H().json<{ data: SessionPlan }>('/api/session/plan');
    const row = H().db.prepare('SELECT COUNT(*) AS n FROM user_sessions').get() as { n: number };
    expect(row.n).toBe(0);
  });

  it('includes due hifz spans when they exist', async () => {
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
         VALUES ('grammar-test-01', 'Test Lesson', 'grammar', 1, '{}', '[]', '[]', 10)`
      )
      .run();

    const { status, body } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    expect(status).toBe(200);
    if (body.data.summary.hifz === 0 && body.data.summary.vocabulary === 0) {
      expect(body.data.summary.lesson).toBe(1);
      expect(body.data.items[0].type).toBe('lesson');
      expect(body.data.items[0].payload.lessonId).toBe('grammar-test-01');
    }
  });

  it('reuses today\'s open session instead of inserting another', async () => {
    insertDueHifz();
    const first = await H().json<{ data: SessionPlan }>('/api/session/plan');
    const second = await H().json<{ data: SessionPlan }>('/api/session/plan');
    expect(second.body.data.sessionId).toBe(first.body.data.sessionId);
    const row = H().db.prepare('SELECT COUNT(*) AS n FROM user_sessions').get() as { n: number };
    expect(row.n).toBe(1);
  });

  it('respects the time budget (does not return an unbounded list)', async () => {
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
    expect(body.data.items.length).toBeLessThanOrEqual(10);
    expect(body.data.plannedSeconds).toBeLessThanOrEqual(720 + 180);
  });

  it('interleaves hifz and vocabulary rather than concatenating them', async () => {
    insertDueHifz(crypto.randomUUID(), 1);
    insertDueHifz(crypto.randomUUID(), 2);
    insertDueVocab('علم');
    insertDueVocab('كتب');

    const { body } = await H().json<{ data: SessionPlan }>('/api/session/plan');
    const types = body.data.items.map((i) => i.type);
    const firstHifz = types.indexOf('hifz');
    const firstVocab = types.indexOf('vocabulary');
    expect(firstHifz).toBeGreaterThanOrEqual(0);
    expect(firstVocab).toBeGreaterThanOrEqual(0);
    expect(Math.abs(firstHifz - firstVocab)).toBe(1);
  });
});

describe('POST /api/session/complete', () => {
  it('records results, marks the session complete, and advances FSRS', async () => {
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

  it('rejects a missing sessionId with 400', async () => {
    const { status, body } = await H().json<{ error: string }>('/api/session/complete', {
      method: 'POST',
      body: JSON.stringify({ results: [] }),
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/sessionId/i);
  });

  it('rejects results that are not an array with 400', async () => {
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
