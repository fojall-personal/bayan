-- Vocabulary CONTENT, as distinct from vocabulary progress.
--
-- `vocabulary_mastery` records what a user knows: (user_id, word, reviews,
-- next_review, ease_factor …). It has no meaning column, because nothing ever
-- held the meanings. The Flashcards component compensated with a hardcoded
-- ternary over ten words and rendered the literal string "Meaning" for anything
-- else.
--
-- The ternary was in fact unreachable: nothing INSERTs into vocabulary_mastery —
-- only an UPDATE exists — so the review queue was permanently empty and the tab
-- always showed its empty state. Fixing the meanings without also giving words a
-- way in would have changed nothing.

CREATE TABLE IF NOT EXISTS vocabulary (
  word TEXT PRIMARY KEY,
  transliteration TEXT,
  meaning TEXT NOT NULL,
  root TEXT,
  part_of_speech TEXT,
  -- Lower is more common. Used to decide which words to teach first.
  frequency_rank INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_rank ON vocabulary(frequency_rank);
