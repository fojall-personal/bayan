-- lesson_progress had no user_id, so progress was global across all users and
-- three endpoints 500'd on "no such column: user_id"
-- (/api/progress/dashboard, /api/learning/next, /api/tutor/chat).
--
-- SQLite cannot change a primary key in place, so this is the rebuild pattern.
-- Existing rows are attributed to the single pre-Access user.
--
-- Requires that user to exist: run src/db/seed-user.sql first.

CREATE TABLE lesson_progress_new (
  user_id TEXT NOT NULL REFERENCES users(id),
  lesson_id TEXT NOT NULL REFERENCES lessons(id),
  module TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_practiced TEXT,
  next_review TEXT,
  streak INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, lesson_id)
);

INSERT INTO lesson_progress_new
  (user_id, lesson_id, module, completed, score, attempts, last_practiced, next_review, streak)
SELECT 'test-user-1', lesson_id, module, completed, score, attempts, last_practiced, next_review, streak
FROM lesson_progress;

DROP TABLE lesson_progress;
ALTER TABLE lesson_progress_new RENAME TO lesson_progress;

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_practiced ON lesson_progress(user_id, last_practiced);
