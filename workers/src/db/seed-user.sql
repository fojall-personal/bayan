-- Provision the single user this self-hosted deployment operates as.
--
-- Auth is a shared bearer token with no per-user identity, so every request
-- resolves to one id (SINGLE_USER_ID in src/lib/context.ts). That row has to
-- exist: without it `GET /api/auth/profile` returns 404 and every insert that
-- references users(id) fails its foreign key.
--
-- No other code path creates it. Run this once per database, after schema.sql:
--
--   # local
--   npx wrangler d1 execute languagebuilder --local --file=src/db/schema.sql
--   npx wrangler d1 execute languagebuilder --local --file=src/db/seed-user.sql
--
--   # remote
--   npx wrangler d1 execute languagebuilder --remote --file=src/db/seed-user.sql
--
-- Safe to re-run.

INSERT OR IGNORE INTO users (id, goal, onboarding_completed, current_path)
VALUES ('test-user-1', 'all', 0, 'path1');
