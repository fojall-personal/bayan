-- Band spine: current_band, skip flag, band_events.
-- Backfill is the SQL form of assignBand({ source: 'backfill', ... }).

ALTER TABLE users ADD COLUMN current_band TEXT
  CHECK (current_band IN ('foundation','ajurrumiyya','qatr','alfiyya','irab'));
ALTER TABLE users ADD COLUMN band_source TEXT
  CHECK (band_source IN ('backfill','onboarding','placement','calibration','gate','manual'));
ALTER TABLE users ADD COLUMN band_entered_at TEXT;

ALTER TABLE lesson_progress ADD COLUMN skipped INTEGER NOT NULL DEFAULT 0
  CHECK (skipped IN (0, 1));

CREATE TABLE IF NOT EXISTS band_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  from_band TEXT,
  to_band TEXT NOT NULL,
  source TEXT NOT NULL,
  evidence TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_band_events_user ON band_events (user_id, created_at);

UPDATE users
   SET current_band = CASE
         WHEN current_path = 'path3' THEN 'qatr'
         WHEN current_path = 'path2' THEN 'ajurrumiyya'
         WHEN (
           SELECT COUNT(*) FROM user_known_root k WHERE k.user_id = users.id
         ) = 0 THEN 'foundation'
         ELSE 'ajurrumiyya'
       END,
       band_source = 'backfill',
       band_entered_at = datetime('now')
 WHERE current_band IS NULL;

INSERT INTO band_events (id, user_id, from_band, to_band, source, evidence)
SELECT
  'backfill-' || id,
  id,
  NULL,
  current_band,
  'backfill',
  json_object('current_path', current_path)
FROM users
WHERE current_band IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM band_events e WHERE e.user_id = users.id AND e.source = 'backfill'
  );
