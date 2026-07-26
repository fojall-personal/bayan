-- quran_verses was read by two routes and never created, so
-- /api/tajweed/verses/:surahId and /api/memorization/review/today always 500'd
-- with "no such table: quran_verses".
--
-- Worse, the two routes assumed different column names for the same imagined
-- table (text_uthmani/text_simple vs verse_text/verse_simple). This settles on
-- one naming; memorization.ts is corrected to match.
--
-- Populated from the pinned Tanzil Uthmani text plus cpfair/quran-tajweed
-- annotations. Populated: 6,236 verses, each with tajweed tags, and since
-- filled with the Saheeh International translation via scripts/ingest-translation.mjs.

CREATE TABLE IF NOT EXISTS quran_verses (
  surah INTEGER NOT NULL,
  ayah INTEGER NOT NULL,
  text_uthmani TEXT NOT NULL,
  text_simple TEXT,
  translation TEXT,
  tajweed_tags TEXT,
  PRIMARY KEY (surah, ayah)
);

CREATE INDEX IF NOT EXISTS idx_quran_verses_surah ON quran_verses(surah);
