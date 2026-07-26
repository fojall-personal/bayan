-- Word-level English glosses, one row per Quranic word.
--
-- The morphology corpus carries no English at all: root, lemma, POS, case — but
-- nothing about meaning. So every exercise derived from it tests LABELLING
-- (which form is this, what case is that) and none tests comprehension. That is
-- the F4 gap: 754 exercises and not one asking what a word means.
--
-- Source is the quran.com v4 word-by-word translation, fetched per surah and
-- cached under data/. 77,429 words, all glossed.
--
-- Beyond F4 this is the substrate for a word-by-word reading view, which is the
-- feature most Quran-learning apps are actually used for.

CREATE TABLE IF NOT EXISTS quran_word_gloss (
  surah_id INTEGER NOT NULL,
  ayah_id  INTEGER NOT NULL,
  -- 1-based position of the word within the ayah, matching the corpus's
  -- word_index so the two tables join.
  position INTEGER NOT NULL,

  arabic          TEXT NOT NULL,
  transliteration TEXT,
  english         TEXT NOT NULL,

  PRIMARY KEY (surah_id, ayah_id, position)
);

CREATE INDEX IF NOT EXISTS idx_gloss_ayah ON quran_word_gloss(surah_id, ayah_id);
-- Lets "which word means X" run as a lookup rather than a scan.
CREATE INDEX IF NOT EXISTS idx_gloss_english ON quran_word_gloss(english);
