/**
 * Drive the real Worker against a real SQLite database.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * The suite had 157 cases and not one of them dispatched a request. Everything
 * tested an exported pure function — normalisation, grading, SM-2, tajweed
 * colours — which is the layer that has never broken. Meanwhile every bug found
 * in the last three rounds of work lived in the route layer:
 *
 *   • `MIN(english) ... GROUP BY arabic` picked an arbitrary gloss, so a flashcard
 *     for ٱللَّهِ read "(The) Promise of Allah".
 *   • `form` and `lemma` were handed to the client as raw Buckwalter, so /read
 *     printed "lemma Hamod".
 *   • `SELECT module FROM lessons WHERE id = ?` was given an EXERCISE id, so a
 *     join that could never match silently disabled all mastery tracking.
 *   • Four column names in quran.ts were simply wrong.
 *   • Nine POST handlers returned a bare 500 when handed a malformed body.
 *
 * Every one was found by hand, in a browser or with curl. None was catchable by a
 * unit test of a pure function, because none was in a pure function. So the gap
 * is not "more tests" — it is tests at the layer where SQL meets a request.
 *
 * ── How ─────────────────────────────────────────────────────────────────────
 *
 * `app.request()` is Hono's own dispatcher, so the middleware chain runs exactly
 * as it does in production: CORS, then auth, then the route. The only substitution
 * is the D1 binding, which is shimmed onto node:sqlite below.
 *
 * The schema comes from the REAL migration files, applied in order, rather than
 * from a copy pasted into the test. A copy is the thing that let four wrong column
 * names through — it agrees with whatever the test author believed.
 */

import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../../src/index';
import { SINGLE_USER_ID } from '../../src/lib/context';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '../../src/db/migrations');

export const TEST_TOKEN = 'test-token-not-a-real-one';
/**
 * Imported rather than retyped. The first draft hardcoded 'user-001' and the real
 * value is 'test-user-1' — a constant copied into a test is a constant that can
 * disagree with the code it is testing.
 */
export const TEST_USER = SINGLE_USER_ID;

/**
 * D1's surface, over a synchronous SQLite handle.
 *
 * Only the three methods the Database wrapper actually calls are implemented —
 * `all`, `first`, `run` behind `prepare().bind()`. Anything else the Worker starts
 * using will throw here rather than silently returning undefined, which is the
 * behaviour worth having: a shim that quietly answers every call would let a real
 * change pass unnoticed.
 */
function d1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          // node:sqlite rejects undefined and booleans; D1 coerces both.
          const bound = params.map((p) =>
            p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p
          );
          const stmt = db.prepare(sql);
          return {
            async all<T>() {
              return { results: stmt.all(...(bound as never[])) as T[], success: true };
            },
            async first<T>() {
              return (stmt.get(...(bound as never[])) as T) ?? null;
            },
            async run() {
              stmt.run(...(bound as never[]));
              return { success: true, meta: {} };
            },
          };
        },
      };
    },
  };
}

export interface Harness {
  db: DatabaseSync;
  /** Dispatch through the real middleware chain. Authorized by default. */
  request(
    path: string,
    init?: RequestInit & { auth?: boolean }
  ): Promise<Response>;
  /** Dispatch and parse JSON, returning status alongside the body. */
  json<T = unknown>(
    path: string,
    init?: RequestInit & { auth?: boolean }
  ): Promise<{ status: number; body: T }>;
  close(): void;
}

/** Every migration, in filename order — the same order wrangler applies them. */
export function applyMigrations(db: DatabaseSync): string[] {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    db.exec(readFileSync(join(MIGRATIONS, f), 'utf-8'));
  }
  return files;
}

export function harness(): Harness {
  const db = new DatabaseSync(':memory:');
  applyMigrations(db);

  // The single user row. Nothing else creates it, and every table with a foreign
  // key to users(id) fails without it — which is itself a bug this repo has had.
  db.prepare(
    `INSERT OR IGNORE INTO users (id, goal, onboarding_completed, current_path)
     VALUES (?, 'all', 1, 'path1')`
  ).run(TEST_USER);

  const env = { DB: d1(db), API_TOKEN: TEST_TOKEN };

  const request: Harness['request'] = (path, init = {}) => {
    const { auth = true, headers, ...rest } = init;
    return app.request(
      `http://localhost${path}`,
      {
        ...rest,
        headers: {
          ...(auth ? { Authorization: `Bearer ${TEST_TOKEN}` } : {}),
          ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
          ...(headers as Record<string, string>),
        },
      },
      env as never
    );
  };

  return {
    db,
    request,
    async json(path, init) {
      const res = await request(path, init);
      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        // A non-JSON body is itself a finding — the client's error handling
        // assumes JSON — so surface the raw text rather than throwing here.
        body = { __nonJson: text };
      }
      return { status: res.status, body: body as never };
    },
    close() {
      db.close();
    },
  };
}
