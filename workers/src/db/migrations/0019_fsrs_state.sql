-- FSRS memory state, alongside the SM-2 columns rather than instead of them.
--
-- SM-2 tracks an ease factor and an interval. FSRS-6 tracks stability (how long the
-- memory lasts) and difficulty (how hard this item is for this learner), and derives
-- the interval from them against a retention target. Those are different quantities,
-- so they need their own columns.
--
-- The old columns stay, for two reasons. A row scheduled under SM-2 has to keep its
-- place in the queue — nobody's hifz schedule resets because the scheduler changed —
-- so `interval` seeds the initial stability on that row's first FSRS review. And
-- `ease_factor` remains the only record of how SM-2 had been treating an item, which
-- is worth keeping until FSRS has enough reviews to stand on its own.
--
-- `last_review` is new and load-bearing: FSRS needs the elapsed time since the last
-- review to compute retrievability, and `last_reviewed` on memorization is a date
-- string while vocabulary_mastery had no equivalent at all.

ALTER TABLE memorization ADD COLUMN stability REAL;
ALTER TABLE memorization ADD COLUMN difficulty REAL;
ALTER TABLE memorization ADD COLUMN last_review TEXT;
-- FSRS distinguishes New / Learning / Review / Relearning, which is not the same
-- vocabulary as the app's learning / reviewing / mastered. Stored separately so the
-- scheduler's state and the learner-facing label cannot drift into each other.
ALTER TABLE memorization ADD COLUMN fsrs_state INTEGER;

ALTER TABLE vocabulary_mastery ADD COLUMN stability REAL;
ALTER TABLE vocabulary_mastery ADD COLUMN difficulty REAL;
ALTER TABLE vocabulary_mastery ADD COLUMN last_review TEXT;
ALTER TABLE vocabulary_mastery ADD COLUMN fsrs_state INTEGER;
