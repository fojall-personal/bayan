-- Language Builder — Database Schema
-- Cloudflare D1 (SQLite)

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  goal TEXT NOT NULL DEFAULT 'all',
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  current_path TEXT NOT NULL DEFAULT 'path1',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Assessment results
CREATE TABLE IF NOT EXISTS assessment_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  literacy_score REAL NOT NULL,
  comprehension_score REAL NOT NULL,
  grammar_score REAL NOT NULL,
  memorization_score REAL NOT NULL,
  level TEXT NOT NULL,
  details TEXT NOT NULL
);

-- Lesson progress
CREATE TABLE IF NOT EXISTS lesson_progress (
  lesson_id TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_practiced TEXT,
  next_review TEXT,
  streak INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

-- Memorization entries
CREATE TABLE IF NOT EXISTS memorization (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  surah_id INTEGER NOT NULL,
  ayah_from INTEGER NOT NULL,
  ayah_to INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  last_reviewed TEXT,
  next_review TEXT,
  quality INTEGER NOT NULL DEFAULT 0,
  revision_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, surah_id, ayah_from, ayah_to)
);

-- Spaced repetition schedule
CREATE TABLE IF NOT EXISTS spaced_repetition (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 1,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  due_date TEXT NOT NULL,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  next_review TEXT NOT NULL
);

-- Vocabulary mastery
CREATE TABLE IF NOT EXISTS vocabulary_mastery (
  word TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  meaning_known INTEGER NOT NULL DEFAULT 0,
  reading_known INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT,
  next_review TEXT,
  reviews INTEGER NOT NULL DEFAULT 0,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 1
);

-- Lessons catalog (seeded content, not user data)
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  module TEXT NOT NULL,
  level INTEGER NOT NULL,
  content TEXT NOT NULL,
  exercises TEXT NOT NULL,
  prerequisites TEXT NOT NULL DEFAULT '[]',
  estimated_minutes INTEGER NOT NULL DEFAULT 15
);

-- Quiz attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  lesson_id TEXT NOT NULL,
  module TEXT NOT NULL,
  questions_answered INTEGER NOT NULL,
  questions_correct INTEGER NOT NULL,
  time_seconds INTEGER,
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_memorization_user ON memorization(user_id);
CREATE INDEX IF NOT EXISTS idx_spaced_repetition_due ON spaced_repetition(due_date);
CREATE INDEX IF NOT EXISTS idx_vocabulary_user ON vocabulary_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module);
