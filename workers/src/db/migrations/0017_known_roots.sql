-- Which roots a learner knows.
--
-- This is the only new data the coverage model needs, and it is what turns a pile
-- of vanity metrics into true statements about a finite text.
--
-- The corpus is CLOSED: 6,236 ayahs, 77,429 words, 1,642 distinct roots, all of it
-- already parsed in quran_word_morphology. So "how much of the Quran can this
-- person read" is arithmetic rather than an estimate — which is a claim no
-- open-vocabulary language app can make. Measured from this repo:
--
--     63 roots cover 50% of every rooted word in the Quran
--    249 roots cover 80%
--    100 roots make 620 ayahs fully readable
--    400 roots make 3,046 ayahs fully readable — half the text
--
-- One row per (user, root). Absence means not known, so there is no "unknown"
-- state to keep in step with anything.

CREATE TABLE IF NOT EXISTS user_known_root (
  user_id    TEXT NOT NULL,
  root       TEXT NOT NULL,
  -- Buckwalter, matching quran_word_morphology.root exactly. Joining on anything
  -- else would silently drop rows.
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  -- SM-2 lives in the memorization tables; this records knowledge, not schedule.
  strength   INTEGER NOT NULL DEFAULT 1 CHECK (strength BETWEEN 1 AND 5),
  PRIMARY KEY (user_id, root)
);

-- Coverage is computed per user by joining every rooted segment against this
-- table, so the root column is the hot side of the join.
CREATE INDEX IF NOT EXISTS idx_known_root_user ON user_known_root (user_id);
CREATE INDEX IF NOT EXISTS idx_known_root_root ON user_known_root (root);
