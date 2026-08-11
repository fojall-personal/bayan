-- Cold-start vs warm-context review flag, per span.
--
-- Chained recall inflates apparent strength: a learner who can only recite
-- ayah 12 after reciting ayah 11 has not memorised 12 independently. Nullable
-- -- NULL means "no adjacent span exists, or this review predates the flag" --
-- 0/1 records what was actually true at review time, not a schedule input.
-- See workers/src/lib/space-repetition.ts's isWarmStart().

ALTER TABLE memorization ADD COLUMN warm_start INTEGER;
