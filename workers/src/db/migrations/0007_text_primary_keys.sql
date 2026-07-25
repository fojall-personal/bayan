-- Three tables declared INTEGER PRIMARY KEY AUTOINCREMENT while the code
-- inserted randomblob(16) into them — a datatype mismatch that made
-- POST /api/tutor/chat and POST /api/grammar/exercise fail. The routes are
-- changed to crypto.randomUUID(); these columns become TEXT to match.
--
-- tutor_topic_history also gains the unique constraint its INSERT OR IGNORE
-- assumed, so repeating a topic no longer accumulates duplicate rows.

CREATE TABLE tutor_conversations_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO tutor_conversations_new (id, user_id, user_message, assistant_message, created_at)
SELECT CAST(id AS TEXT), user_id, user_message, assistant_message, created_at FROM tutor_conversations;
DROP TABLE tutor_conversations;
ALTER TABLE tutor_conversations_new RENAME TO tutor_conversations;
CREATE INDEX IF NOT EXISTS idx_tutor_conv_user ON tutor_conversations(user_id, created_at);

CREATE TABLE tutor_topic_history_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  topic TEXT NOT NULL,
  discussed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, topic)
);
INSERT OR IGNORE INTO tutor_topic_history_new (id, user_id, topic, discussed_at)
SELECT CAST(id AS TEXT), user_id, topic, discussed_at FROM tutor_topic_history;
DROP TABLE tutor_topic_history;
ALTER TABLE tutor_topic_history_new RENAME TO tutor_topic_history;

CREATE TABLE grammar_exercises_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  exercise_id TEXT NOT NULL,
  answer TEXT,
  correct INTEGER NOT NULL DEFAULT 0,
  answered_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO grammar_exercises_new (id, user_id, exercise_id, answer, correct, answered_at)
SELECT CAST(id AS TEXT), user_id, exercise_id, answer, correct, answered_at FROM grammar_exercises;
DROP TABLE grammar_exercises;
ALTER TABLE grammar_exercises_new RENAME TO grammar_exercises;
CREATE INDEX IF NOT EXISTS idx_grammar_exercises_user ON grammar_exercises(user_id);
