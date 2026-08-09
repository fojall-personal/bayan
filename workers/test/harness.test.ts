import { afterEach, describe, expect, it } from 'vitest';
import { applyMigrations, harness, TEST_USER } from './helpers/harness';
import { DatabaseSync } from 'node:sqlite';

let h: ReturnType<typeof harness> | null = null;
afterEach(() => { h?.close(); h = null; });

describe('harness', () => {
  it('applies every real migration', () => {
    const db = new DatabaseSync(':memory:');
    const files = applyMigrations(db);
    expect(files.length).toBeGreaterThanOrEqual(18);
    db.close();
  });

  it('dispatches through the real middleware chain', async () => {
    h = harness();
    const { status, body } = await h.json<{ data: { userId: string } }>('/api/auth/whoami');
    expect(status).toBe(200);
    expect(body.data.userId).toBe(TEST_USER);
  });

  it('refuses an unauthorized request', async () => {
    h = harness();
    const res = await h.request('/api/auth/whoami', { auth: false });
    expect(res.status).toBe(401);
  });

  it('has the function-word knowledge table with a (user, lemma, pos) key', () => {
    h = harness();
    // Same shape as user_known_root, plus pos — because `maA` is REL 1,476 times
    // and NEG 705 times, and they are different words to learn.
    h.db.prepare(
      `INSERT INTO user_known_function_word (user_id, lemma, pos) VALUES (?, ?, ?)`
    ).run(TEST_USER, 'maA', 'REL');
    h.db.prepare(
      `INSERT INTO user_known_function_word (user_id, lemma, pos) VALUES (?, ?, ?)`
    ).run(TEST_USER, 'maA', 'NEG');

    const n = h.db
      .prepare(`SELECT COUNT(*) AS n FROM user_known_function_word WHERE user_id = ?`)
      .get(TEST_USER) as { n: number };
    // Two rows, not one: the PK must include pos.
    expect(n.n).toBe(2);
  });
});
