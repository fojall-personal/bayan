-- Remember WHERE a vocabulary card came from.
--
-- F3 enrols words from the ayahs a learner is memorising, and the first attempt
-- resolved the meaning at query time with `MIN(english) ... GROUP BY arabic` over
-- the whole gloss table. That is an arbitrary pick across every occurrence of the
-- word form, and it produced exactly what you would expect:
--
--     ٱللَّهِ        → "(The) Promise of Allah"
--     ٱللَّهُ        → "(May) Allah destroy them"
--     ءَامَنُوا۟     → "(again) believed"
--
-- Each is a real gloss of that form somewhere in the Quran, and none is the gloss
-- from the ayah the learner is actually studying. The provenance was wrong the same
-- way: MIN(surah_id) reported 2:1 for a word enrolled from 112:1.
--
-- The context belongs to the enrolment, not to a guess at read time. One row, one
-- location, joined exactly.

ALTER TABLE vocabulary_mastery ADD COLUMN source_surah INTEGER;
ALTER TABLE vocabulary_mastery ADD COLUMN source_ayah INTEGER;
ALTER TABLE vocabulary_mastery ADD COLUMN source_position INTEGER;

-- The gloss lookup is by exact location, so that is the index that matters.
CREATE INDEX IF NOT EXISTS idx_vocab_mastery_source
  ON vocabulary_mastery (source_surah, source_ayah, source_position);
