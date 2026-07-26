-- Rebuild quran_word_morphology to hold one row per SEGMENT, not per word.
--
-- The corpus annotates segments: 128,219 of them across 77,429 words. The old
-- table keyed UNIQUE(surah_id, ayah_id, word_index) and the ingest used
-- INSERT OR IGNORE, so for each of the 42,093 multi-segment words every segment
-- after the first was silently dropped. The survivor was the first — which for a
-- prefixed word is the al-/wa-/bi- particle, carrying no lemma and no root.
--
-- Consequence, measured in production: 54:1 ("the Hour drew near and the moon
-- split") held only {qotarabati, {l, wa, {lo. The stems sāʿah, inshaqqa and
-- qamar were absent, and root 'qmr' appeared nowhere in the table at all,
-- despite Surah 54 being named Al-Qamar.
--
-- The old rows are not migrated. They cannot be repaired — the dropped segments
-- were never stored — so the table is rebuilt empty and re-ingested from source
-- by scripts/ingest-morphology.mjs.
--
-- Nothing read this table at the time of writing (no references in workers/src or
-- src/app), so widening it breaks no caller.

DROP TABLE IF EXISTS quran_word_morphology;

CREATE TABLE quran_word_morphology (
  surah_id      INTEGER NOT NULL,
  ayah_id       INTEGER NOT NULL,
  word_index    INTEGER NOT NULL,
  -- 1-based position within the word. Up to 5 in this corpus.
  segment_index INTEGER NOT NULL,

  form  TEXT,           -- Buckwalter surface form of the segment
  tag   TEXT,           -- corpus tag: N, V, PRON, DET, P, CONJ …
  lemma TEXT,
  root  TEXT,
  pos   TEXT,

  -- Derived verb form I–XII. This is what F9 pattern drills are built from, and
  -- the previous ingest never captured it: 8,977 verbs carry one.
  verb_form TEXT,

  aspect  TEXT,         -- PERF / IMPF / IMPV
  voice   TEXT,         -- ACT / PASS
  mood    TEXT,         -- SUBJ / JUS / IND
  person  TEXT,         -- 1 / 2 / 3
  gender  TEXT,         -- M / F
  number  TEXT,         -- S (singular) / D (dual) / P (plural)
  case_case TEXT,       -- NOM / ACC / GEN
  state   TEXT,         -- DEF / INDEF

  -- Composite PRIMARY KEY rather than a surrogate id plus a UNIQUE index. It is
  -- a non-partial index, so ON CONFLICT can target it — the partial index on
  -- users(email) is what broke every API request when Access went live.
  PRIMARY KEY (surah_id, ayah_id, word_index, segment_index)
);

-- Root and lemma lookups drive the pattern drills and the grounded i'rab view.
CREATE INDEX IF NOT EXISTS idx_morph_root ON quran_word_morphology(root)
  WHERE root IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_morph_lemma ON quran_word_morphology(lemma)
  WHERE lemma IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_morph_ayah ON quran_word_morphology(surah_id, ayah_id);
CREATE INDEX IF NOT EXISTS idx_morph_verb_form ON quran_word_morphology(verb_form)
  WHERE verb_form IS NOT NULL;
