-- Which verb forms (wazn) a learner knows.
--
-- Bayan tracks roots. Arabic is root x pattern: knowing كتب plus Form X lets you
-- decode استكتب without ever having met it, and nothing in this app could say
-- which forms a learner knows before this table existed. verb_form is already on
-- quran_word_morphology (Forms I-XII), so this is the same shape as
-- user_known_root, applied to the other half of the multiplicative pair.
--
-- Measured from this repo (0026_daily_loop... plan doc, 2026-08-08): six forms
-- cover 99% of the 19,356 verb stems in the Quran (Form I 12,347, IV 4,565,
-- II 1,615, VIII 1,161, III 497, V 466), so this is a small, high-leverage
-- curriculum, not an open-ended one.
--
-- One row per (user, verb_form). Absence means not known, same discipline as
-- user_known_root: no separate unknown state to keep in sync.

CREATE TABLE IF NOT EXISTS user_known_pattern (
  user_id    TEXT NOT NULL,
  verb_form  TEXT NOT NULL,
  -- Matching quran_word_morphology.verb_form exactly (Buckwalter-style form
  -- numerals, e.g. 'I', 'IV', 'X') -- joining on anything else silently drops rows.
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, verb_form)
);

CREATE INDEX IF NOT EXISTS idx_known_pattern_user ON user_known_pattern (user_id);
