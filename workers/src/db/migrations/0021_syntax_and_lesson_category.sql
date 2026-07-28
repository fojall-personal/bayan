-- The syntax layer, and the grammar discipline each lesson belongs to.
--
-- ── quran_syntax ───────────────────────────────────────────────────────────
--
-- What each word DOES, from the Extended Quranic Treebank (Nashir et al. 2025,
-- doi:10.1016/j.dib.2025.111940, CC BY 4.0). quran_word_morphology records what each
-- word IS; nothing recorded what it does, which is why "which word is the مبتدأ" was a
-- question this app could not ask and why Idafa practice settled for generic case drills.
--
-- Deliberately NOT a copy of the morphology. Root, lemma, POS and case stay in
-- quran_word_morphology; storing them twice would create two answers to one question,
-- which is the shape of the bug that left 40% of that table wrong.
--
-- The parser behind this layer reports 95.7% LAS, so nothing here is authoritative on its
-- own. scripts/ingest-treebank.mjs will not load it unless it still agrees with the
-- hand-verified morphology, and the generator emits an exercise only where a relation and
-- the morphological case concur. See that script's header for why.
CREATE TABLE IF NOT EXISTS quran_syntax (
  -- Sentence-scoped, because that is how the source identifies tokens: token_index
  -- restarts at 0 in every sentence and head_index points inside the same sentence.
  -- Joining these globally silently produces nonsense rather than an error.
  sentence_id    INTEGER NOT NULL,
  token_index    INTEGER NOT NULL,
  head_index     INTEGER,

  -- Quran location. word_index is 0 for a token the treebank RECONSTRUCTS (an elided
  -- subject, an omitted predicate), which is why is_implied exists as its own flag
  -- rather than being inferred from a zero somewhere.
  surah_id       INTEGER NOT NULL,
  ayah_id        INTEGER NOT NULL,
  word_index     INTEGER NOT NULL,
  segment_index  INTEGER NOT NULL,

  -- Dependency relation: Pred (خبر), Subj (فاعل), Obj (مفعول به), Poss (مضاف إليه),
  -- Adj (صفة), circ (حال), App (بدل), Spec (تمييز), cond (شرط), root, and the كان-family
  -- pairs. 129 distinct values in this release.
  rel            TEXT,
  rel_ar         TEXT,
  -- Constituency: NS (nominal sentence), VS (verbal sentence), PP, SC, S, CS.
  constituent    TEXT,
  -- Sarf, and new: ACT_PCPL (اسم فاعل), PASS_PCPL (اسم مفعول), VN (مصدر).
  derived_noun   TEXT,

  -- The Uthmani form. Stored ONLY because reconstructed tokens have no morphology row to
  -- read a form from, so without it an ellipsis could not be displayed at all.
  token          TEXT,
  is_implied     INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (sentence_id, token_index)
);

-- Drills filter by relation, then look up a location. Both directions are indexed
-- because the generator walks relations while any reader walks locations.
CREATE INDEX IF NOT EXISTS idx_syntax_rel ON quran_syntax(rel);
CREATE INDEX IF NOT EXISTS idx_syntax_loc ON quran_syntax(surah_id, ayah_id, word_index);
CREATE INDEX IF NOT EXISTS idx_syntax_derived ON quran_syntax(derived_noun);

-- ── lessons.category ───────────────────────────────────────────────────────
--
-- /grammar offers three tabs — Syntax, Morphology, Rhetoric — and the query behind them
-- was `WHERE module = 'grammar'` with the requested category never used. All three
-- returned byte-identical lists of all 418 lessons, 823 KB each, and "Rhetoric" returned
-- 418 lessons of which none concerned rhetoric.
--
-- A new column rather than repurposing `module`. `module` is load-bearing in seven
-- places — the learning path's ordering, lesson_progress, quiz_attempts, and the tutor's
-- per-module error weighting — so changing its values would split a user's progress
-- records across names that did not exist when they were written.
--
-- NULL means "not one of the three disciplines", which is the honest answer for the 408
-- generated root lessons: they teach vocabulary in root families, not grammar, and
-- serving them under a grammar heading is what made the payload 823 KB.
ALTER TABLE lessons ADD COLUMN category TEXT;

CREATE INDEX IF NOT EXISTS idx_lessons_category ON lessons(category);
