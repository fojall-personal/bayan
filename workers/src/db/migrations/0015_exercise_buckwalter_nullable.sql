-- Allow grammar_exercise_bank.word_buckwalter to be NULL.
--
-- The column was declared NOT NULL when every exercise came from the morphology
-- corpus, where each item is one segment with a Buckwalter form. Comprehension
-- items (kind = 'find_word') ask about a whole ayah, so there is no single form
-- to record, and the insert failed with
--   NOT NULL constraint failed: grammar_exercise_bank.word_buckwalter
--
-- The constraint was the wrong assumption, not the data. word_arabic stays NOT
-- NULL because there is always something to show the learner.
--
-- SQLite cannot drop a NOT NULL in place, so the table is rebuilt. Rows are
-- copied rather than regenerated: they are byte-identical either way, but a copy
-- keeps the migration self-contained.

CREATE TABLE grammar_exercise_bank_new (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  level INTEGER NOT NULL,
  word_arabic TEXT NOT NULL,
  -- Nullable: absent for whole-ayah comprehension items.
  word_buckwalter TEXT,
  prompt TEXT NOT NULL,
  answer TEXT NOT NULL,
  options TEXT NOT NULL,
  explanation TEXT NOT NULL,
  surah_id INTEGER NOT NULL,
  ayah_id INTEGER NOT NULL,
  word_index INTEGER NOT NULL,
  segment_index INTEGER NOT NULL,
  root TEXT,
  UNIQUE(kind, surah_id, ayah_id, word_index, segment_index)
);

INSERT INTO grammar_exercise_bank_new
  (id, kind, level, word_arabic, word_buckwalter, prompt, answer, options,
   explanation, surah_id, ayah_id, word_index, segment_index, root)
SELECT id, kind, level, word_arabic, word_buckwalter, prompt, answer, options,
       explanation, surah_id, ayah_id, word_index, segment_index, root
FROM grammar_exercise_bank;

DROP TABLE grammar_exercise_bank;
ALTER TABLE grammar_exercise_bank_new RENAME TO grammar_exercise_bank;

CREATE INDEX IF NOT EXISTS idx_gex_level ON grammar_exercise_bank(level, kind);
CREATE INDEX IF NOT EXISTS idx_gex_kind ON grammar_exercise_bank(kind);
CREATE INDEX IF NOT EXISTS idx_gex_root ON grammar_exercise_bank(root)
  WHERE root IS NOT NULL;
