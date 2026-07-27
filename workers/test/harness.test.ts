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
});
