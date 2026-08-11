-- Per-user hifz retention preference. NULL means "use the default (0.9)" --
-- explicitly nullable rather than defaulting the column itself to 0.95, so an
-- existing learner's schedule does not shift the moment this migration runs.
-- See workers/src/lib/space-repetition.ts's TRACK_RETENTION and REQUEST_RETENTION.

ALTER TABLE users ADD COLUMN hifz_retention REAL;
