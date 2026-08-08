-- quran_word_gloss.arabic is queried with exact-match and prefix-LIKE lookups
-- (tutor.ts's answerWord, on every tutor-chat lookup of a pasted word, and
-- learning.ts's vocabulary/start fromPlan CTE), but only (surah_id, ayah_id)
-- and english were indexed — both currently full-table-scan 77,429 rows.

CREATE INDEX IF NOT EXISTS idx_gloss_arabic ON quran_word_gloss(arabic);
