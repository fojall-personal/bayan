// D1 database wrapper
// Provides typed query methods for Cloudflare D1

import type { D1Database, D1Result } from '@cloudflare/workers-types';

export class Database {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  // Generic query executor — returns array of results
  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    const result = await stmt.bind(...params).all<T>();
    return result.results || [];
  }

  // Get single result or undefined
  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const stmt = this.db.prepare(sql);
    const result = await stmt.bind(...params).first<T>();
    return result || undefined;
  }

  // Run statement (INSERT, UPDATE, DELETE)
  async run(sql: string, params: unknown[] = []): Promise<D1Result> {
    const stmt = this.db.prepare(sql);
    return stmt.bind(...params).run();
  }
}
