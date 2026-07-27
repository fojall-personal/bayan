-- Word-level recitation timings, so the reader can highlight what is being recited.
--
-- The app already plays per-ayah MP3s from everyayah.com. What it could not do is say
-- WHICH word is sounding, because that needs an alignment between audio and text that
-- no amount of client-side cleverness can derive.
--
-- cpfair/quran-align publishes exactly that, CC-BY 4.0, for twelve reciters — two of
-- which match this app's reciter paths byte for byte (Alafasy_128kbps, the default,
-- and Minshawy_Murattal_128kbps). Static data, no model call, no per-request cost.
--
-- Keyed by reciter because timings belong to a recording, not to the text. The third
-- reciter the app offers, Husary_128kbps, is deliberately absent: quran-align covers
-- Husary at 64kbps, and a different encode is a different file whose timings have not
-- been verified against ours. Highlighting the wrong word is worse than not
-- highlighting at all, so that reciter simply has no timings and the UI falls back to
-- plain playback.

CREATE TABLE IF NOT EXISTS quran_word_timing (
  -- Matches Reciter.path in src/app/lib/ayah-audio.ts, so the client can ask for
  -- timings using the same identifier it already uses to build the audio URL.
  reciter   TEXT    NOT NULL,
  surah_id  INTEGER NOT NULL,
  ayah_id   INTEGER NOT NULL,
  -- 1-based, matching quran_word_gloss.position. The source file is 0-based and the
  -- ingest converts, because every other word reference in this schema is 1-based and
  -- one off-by-one here would silently highlight the neighbouring word.
  word_index INTEGER NOT NULL,
  start_ms  INTEGER NOT NULL,
  end_ms    INTEGER NOT NULL,
  PRIMARY KEY (reciter, surah_id, ayah_id, word_index)
);

-- The read pattern is "every word of this ayah for this reciter", in order.
CREATE INDEX IF NOT EXISTS idx_word_timing_ayah
  ON quran_word_timing (reciter, surah_id, ayah_id, word_index);
