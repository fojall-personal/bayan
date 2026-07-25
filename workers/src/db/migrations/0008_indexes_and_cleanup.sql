-- spaced_repetition carried both due_date and next_review, NOT NULL and
-- redundant. The table is unused by any route; collapse it to one column so it
-- does not become two sources of truth if it is ever adopted.

CREATE TABLE spaced_repetition_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 1,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  next_review TEXT NOT NULL
);
INSERT INTO spaced_repetition_new
  (id, user_id, item_type, item_id, interval_days, ease_factor, reviews_count, next_review)
SELECT CAST(id AS TEXT), user_id, item_type, item_id, interval_days, ease_factor, reviews_count,
       COALESCE(next_review, due_date)
FROM spaced_repetition;
DROP TABLE spaced_repetition;
ALTER TABLE spaced_repetition_new RENAME TO spaced_repetition;
CREATE INDEX IF NOT EXISTS idx_spaced_repetition_due ON spaced_repetition(user_id, next_review);

-- Hot filters that had no index.
CREATE INDEX IF NOT EXISTS idx_assessment_results_user ON assessment_results(user_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id, completed_at);
