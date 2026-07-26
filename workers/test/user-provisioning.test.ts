/**
 * Just-in-time user provisioning against the REAL users schema.
 *
 * The bug this pins down took the entire app offline the moment Cloudflare Access
 * was enabled. `resolveUser` ran `INSERT ... ON CONFLICT(email) DO NOTHING`, but
 * the unique index on that column is partial:
 *
 *   CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL
 *
 * SQLite refuses a partial index as an ON CONFLICT target and raises
 * "ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint".
 * Because provisioning happens in the auth middleware, that exception surfaced as
 * a bare 500 on EVERY /api/* request.
 *
 * It had never fired before. Access mode had never actually been active — the
 * Access application carried a bypass-everyone policy — so no request had ever
 * reached that line. A test suite of 78 cases said nothing, because nothing here
 * touched the database.
 *
 * These tests run the real DDL and the real statements through node:sqlite, so
 * the conflict-target rule is exercised rather than assumed.
 */

import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';

/** Copied from migrations 0001 + 0002 as they exist in production. */
const SCHEMA = `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  goal TEXT NOT NULL DEFAULT 'all',
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  current_path TEXT NOT NULL DEFAULT 'path1',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  email TEXT,
  name TEXT
);
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
`;

/** The statement resolveUser actually issues. */
const PROVISION =
  `INSERT OR IGNORE INTO users (id, email, goal, onboarding_completed, current_path)
   VALUES (?, ?, 'all', 0, 'path1')`;

/** What it used to issue. Kept so the failure mode stays demonstrable. */
const PROVISION_BROKEN =
  `INSERT INTO users (id, email, goal, onboarding_completed, current_path)
   VALUES (?, ?, 'all', 0, 'path1')
   ON CONFLICT(email) DO NOTHING`;

let db: DatabaseSync;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  // The single-user seed row, which has a NULL email — the reason the index is
  // partial in the first place.
  db.exec(`INSERT INTO users (id, goal, current_path) VALUES ('test-user-1', 'all', 'path1')`);
});

const provision = (id: string, email: string) => db.prepare(PROVISION).run(id, email);
const emailCount = (email: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM users WHERE email = ?`).get(email) as { n: number }).n;

describe('the schema this has to work against', () => {
  it('has a PARTIAL unique index on email', () => {
    const row = db
      .prepare(`SELECT sql FROM sqlite_master WHERE name = 'idx_users_email'`)
      .get() as { sql: string };
    expect(row.sql).toContain('WHERE email IS NOT NULL');
  });

  it('rejects ON CONFLICT(email) — this is the outage, reproduced', () => {
    expect(() => db.prepare(PROVISION_BROKEN).run('u1', 'a@example.com')).toThrow(
      /ON CONFLICT clause does not match/
    );
  });
});

describe('resolveUser provisioning', () => {
  it('creates a user on first sight', () => {
    provision('u1', 'friend@example.com');
    expect(emailCount('friend@example.com')).toBe(1);
  });

  it('is idempotent — a second login must not throw or duplicate', () => {
    provision('u1', 'friend@example.com');
    expect(() => provision('u2', 'friend@example.com')).not.toThrow();
    expect(emailCount('friend@example.com')).toBe(1);
  });

  it('keeps the original id when the address is already present', () => {
    provision('first-id', 'friend@example.com');
    provision('second-id', 'friend@example.com');
    const row = db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .get('friend@example.com') as { id: string };
    expect(row.id).toBe('first-id');
  });

  it('provisions different people separately', () => {
    provision('u1', 'one@example.com');
    provision('u2', 'two@example.com');
    expect(emailCount('one@example.com')).toBe(1);
    expect(emailCount('two@example.com')).toBe(1);
  });

  it('coexists with the NULL-email seed row', () => {
    // Several NULL emails must remain legal, which is what the partial index was
    // protecting. SQLite treats NULLs as distinct in a unique index anyway.
    db.exec(`INSERT INTO users (id, goal, current_path) VALUES ('another', 'all', 'path1')`);
    provision('u1', 'friend@example.com');
    const total = (db.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number }).n;
    expect(total).toBe(3);
  });

  it('re-reads after insert, so a lost race still resolves to a user', () => {
    // resolveUser does not trust the insert; it selects afterwards. Simulate the
    // loser of a concurrent first request: its insert is ignored, but the
    // subsequent read must still find the winner's row.
    provision('winner', 'friend@example.com');
    provision('loser', 'friend@example.com');
    const row = db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .get('friend@example.com') as { id: string } | undefined;
    expect(row?.id).toBe('winner');
  });
});
