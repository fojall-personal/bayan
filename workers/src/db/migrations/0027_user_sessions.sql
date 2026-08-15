-- Mixed daily sessions: one planned, time-boxed sitting of interleaved items.
--
-- The plan is JSON so the mixer can grow new item kinds without another
-- migration. Results stay null until POST /api/session/complete, which also
-- applies FSRS grades to the underlying hifz / vocabulary rows.

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  planned_items TEXT NOT NULL,
  results TEXT,
  planned_seconds INTEGER NOT NULL DEFAULT 720,
  actual_seconds INTEGER,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_open
  ON user_sessions(user_id, started_at) WHERE completed_at IS NULL;
