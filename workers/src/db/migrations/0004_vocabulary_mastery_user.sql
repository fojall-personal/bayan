-- vocabulary_mastery keyed on word alone, so two users could never know the
-- same word. Rebuild with a composite key.

CREATE TABLE vocabulary_mastery_new (
  user_id TEXT NOT NULL REFERENCES users(id),
  word TEXT NOT NULL,
  meaning_known INTEGER NOT NULL DEFAULT 0,
  reading_known INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT,
  next_review TEXT,
  reviews INTEGER NOT NULL DEFAULT 0,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, word)
);

INSERT INTO vocabulary_mastery_new
  (user_id, word, meaning_known, reading_known, last_seen, next_review, reviews, ease_factor, interval_days)
SELECT user_id, word, meaning_known, reading_known, last_seen, next_review, reviews, ease_factor, interval_days
FROM vocabulary_mastery;

DROP TABLE vocabulary_mastery;
ALTER TABLE vocabulary_mastery_new RENAME TO vocabulary_mastery;

CREATE INDEX IF NOT EXISTS idx_vocabulary_user ON vocabulary_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_due ON vocabulary_mastery(user_id, next_review);
