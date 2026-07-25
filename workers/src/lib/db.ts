// D1 database wrapper
// Provides typed query methods for Cloudflare D1

import type { Context } from 'hono';
import type { D1Database, D1Result } from '@cloudflare/workers-types';
import type { AppEnv } from './context';

export class Database {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  // Generic query executor — returns array of results
  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    const result = await stmt.bind(...params).all<T>();
    return (result.results as T[]) || [];
  }

  // Get single result or undefined
  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const stmt = this.db.prepare(sql);
    const result = await stmt.bind(...params).first<T>();
    return (result as T) || undefined;
  }

  // Run statement (INSERT, UPDATE, DELETE)
  async run(sql: string, params: unknown[] = []): Promise<D1Result> {
    const stmt = this.db.prepare(sql);
    return stmt.bind(...params).run();
  }
}

/**
 * Wrap the request's D1 binding.
 *
 * Every route used to carry its own copy of this, each accepting `any` — which
 * is why `db.get<T>()` calls throughout the Worker were untyped. One typed
 * helper keeps the generics working.
 */
export function getDb(c: Context<AppEnv>): Database {
  return new Database(c.env.DB);
}
