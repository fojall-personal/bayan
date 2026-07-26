-- Two banks of DERIVED content: grammar exercises and a memorization curriculum.
--
-- Derived, not authored, on purpose. The five hand-written grammar lessons
-- shipped with five factual errors between them — including three "sun letter"
-- examples that all began with moon letters. Authoring hundreds more by hand
-- would reproduce that at scale and invisibly.
--
-- Everything here is generated from data that can be checked:
--   grammar_exercise_bank  <- the morphology corpus (128,219 annotated segments)
--   memorization_units     <- the pinned Tanzil text (6,236 verses)
--
-- Each exercise carries its source location, so any item can be traced back to
-- the corpus row that produced it and disproved if wrong. That is the property
-- authored content does not have.

CREATE TABLE IF NOT EXISTS grammar_exercise_bank (
  id TEXT PRIMARY KEY,

  -- verb_form | case_ending | root_id | pos_id | aspect
  kind TEXT NOT NULL,
  -- 1 (commonest words, plainest features) .. 5
  level INTEGER NOT NULL,

  -- The word being asked about, in Arabic. Converted out of the corpus's
  -- Buckwalter, which is unreadable to a learner.
  word_arabic TEXT NOT NULL,
  word_buckwalter TEXT NOT NULL,

  prompt TEXT NOT NULL,
  answer TEXT NOT NULL,
  -- JSON array of strings, answer included, already shuffled deterministically.
  options TEXT NOT NULL,
  explanation TEXT NOT NULL,

  -- Provenance. Every item points at the corpus row it came from.
  surah_id INTEGER NOT NULL,
  ayah_id INTEGER NOT NULL,
  word_index INTEGER NOT NULL,
  segment_index INTEGER NOT NULL,
  root TEXT,

  UNIQUE(kind, surah_id, ayah_id, word_index, segment_index)
);

CREATE INDEX IF NOT EXISTS idx_gex_level ON grammar_exercise_bank(level, kind);
CREATE INDEX IF NOT EXISTS idx_gex_kind ON grammar_exercise_bank(kind);
CREATE INDEX IF NOT EXISTS idx_gex_root ON grammar_exercise_bank(root)
  WHERE root IS NOT NULL;

-- Ordered memorization units.
--
-- The tracker already worked but a learner had to invent their own plan: pick a
-- surah, pick a range, guess how much is sensible. This is the plan, derived
-- from the actual verse counts rather than guessed.
CREATE TABLE IF NOT EXISTS memorization_units (
  id TEXT PRIMARY KEY,
  -- Global teaching order, 1..n.
  sequence INTEGER NOT NULL,
  -- 1 (a few short ayahs) .. 6 (long passages)
  level INTEGER NOT NULL,

  surah_id INTEGER NOT NULL,
  ayah_from INTEGER NOT NULL,
  ayah_to INTEGER NOT NULL,
  ayah_count INTEGER NOT NULL,

  surah_name TEXT NOT NULL,
  -- Why this unit sits here, so the ordering is inspectable rather than magic.
  rationale TEXT NOT NULL,

  UNIQUE(surah_id, ayah_from, ayah_to)
);

CREATE INDEX IF NOT EXISTS idx_munits_seq ON memorization_units(sequence);
CREATE INDEX IF NOT EXISTS idx_munits_level ON memorization_units(level);
CREATE INDEX IF NOT EXISTS idx_munits_surah ON memorization_units(surah_id);
