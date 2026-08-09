-- Which function words a learner knows.
--
-- Coverage counted an ayah readable when every ROOTED word in it had a known root,
-- and treated everything else as free. Measured against this corpus, that is 27,462
-- of 77,429 word tokens — 35.5% — assumed known: prepositions (9,886), conjunctions
-- (4,090), relative pronouns (2,202), negations (1,258), demonstratives (773).
-- Those are the words that carry the syntax, so the old number was not a small
-- overstatement of reading ability; it was an overstatement of exactly the part that
-- decides what a sentence means.
--
-- The good news is the shape of the distribution. There are only 175 distinct
-- function lemmas -- 215 (lemma,pos) pairs -- in the whole Quran, and:
--     top 20 lemmas = 77.3% of all function-word segments
--     top 50 lemmas = 94.0%
--     top 100       = 98.9%
-- So 50 items, four a day for a fortnight, closes almost the entire hole.
--
-- KEY IS (user_id, lemma, pos), NOT (user_id, lemma).
-- `maA` is a relative pronoun 1,476 times and a negation 705 times. `<in` is
-- conditional; `<in~` is the accusative particle. These are different words that
-- happen to share a spelling, they are learned separately, and telling them apart in
-- context IS the advanced skill. A key on lemma alone silently merges them.
--
-- Buckwalter throughout, matching quran_word_morphology.lemma / .pos exactly.
-- Joining on anything else would silently drop rows.

CREATE TABLE IF NOT EXISTS user_known_function_word (
  user_id    TEXT NOT NULL,
  lemma      TEXT NOT NULL,
  pos        TEXT NOT NULL,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  strength   INTEGER NOT NULL DEFAULT 1 CHECK (strength BETWEEN 1 AND 5),
  PRIMARY KEY (user_id, lemma, pos)
);

-- Coverage joins every unrooted segment against this table per user.
CREATE INDEX IF NOT EXISTS idx_known_fw_user ON user_known_function_word (user_id);
CREATE INDEX IF NOT EXISTS idx_known_fw_lemma ON user_known_function_word (lemma, pos);