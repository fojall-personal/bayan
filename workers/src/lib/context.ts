// Shared Hono environment for every route in this Worker.
//
// Bindings mirror wrangler.toml. Variables are set by the auth middleware in
// index.ts and read by handlers via c.get('userId') — never via module-level
// state, which is shared across concurrent requests in a Worker isolate.

import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

export type AppEnv = {
  Bindings: {
    DB: D1Database;
    API_TOKEN: string;
    /** Comma-separated list of origins allowed to call /api/*. */
    ALLOWED_ORIGINS?: string;
    languagebuilder_assets?: R2Bucket;
  };
  Variables: {
    userId: string;
  };
};

/**
 * The single-user id this self-hosted deployment operates as.
 *
 * Auth is a shared bearer token with no per-user identity, so every request
 * resolves to this id. It must exist in the `users` table — see
 * src/db/seed-user.sql. When real accounts arrive, this constant is the seam
 * to replace.
 */
export const SINGLE_USER_ID = 'test-user-1';
