-- Two defects made the whole memorization module unusable:
--
--   1. The table had no `interval` or `ease_factor` column, but the insert and
--      the review update both wrote them — so POST /api/memorization/add and
--      POST /api/memorization/:id/review always 500'd with
--      "table memorization has no column named interval".
--   2. `id` was INTEGER PRIMARY KEY AUTOINCREMENT while the code inserted a
--      crypto.randomUUID(), a datatype mismatch.
--
-- NOTE: interval/ease_factor are SM-2 state. The plan (docs/APPLICATION-PLAN-v2.md
-- §7) adopts FSRS, whose state is stability/difficulty. That swap is Stage 7 and
-- gets its own migration; this one only makes the existing code correct.

CREATE TABLE memorization_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  surah_id INTEGER NOT NULL,
  ayah_from INTEGER NOT NULL,
  ayah_to INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  last_reviewed TEXT,
  next_review TEXT,
  quality INTEGER NOT NULL DEFAULT 0,
  revision_count INTEGER NOT NULL DEFAULT 0,
  interval INTEGER NOT NULL DEFAULT 0,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  UNIQUE(user_id, surah_id, ayah_from, ayah_to)
);

INSERT INTO memorization_new
  (id, user_id, surah_id, ayah_from, ayah_to, status, last_reviewed, next_review, quality, revision_count)
SELECT CAST(id AS TEXT), user_id, surah_id, ayah_from, ayah_to, status, last_reviewed, next_review, quality, revision_count
FROM memorization;

DROP TABLE memorization;
ALTER TABLE memorization_new RENAME TO memorization;

CREATE INDEX IF NOT EXISTS idx_memorization_user ON memorization(user_id);
CREATE INDEX IF NOT EXISTS idx_memorization_due ON memorization(user_id, next_review);
