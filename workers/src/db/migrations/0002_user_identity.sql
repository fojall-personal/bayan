-- Identity fields for Cloudflare Access.
--
-- email is the identity carried by the Access JWT; id stays an opaque internal
-- key so that a changed address does not orphan a user's progress. name is read
-- by the certificate route today and did not exist, so certificates were always
-- issued to "Student".
--
-- The unique index is partial so pre-Access rows with a NULL email coexist.

ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN name TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users(email) WHERE email IS NOT NULL;
