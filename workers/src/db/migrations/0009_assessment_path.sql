-- assessment_results never stored the learning path it produced. The path was
-- returned once in the submit response and written to users.current_path, but
-- the results screen had nothing to read, so it re-derived a path from `level`
-- using different logic than assignLearningPath() — and displayed a path that
-- could contradict the one actually assigned.
--
-- Store what was assigned so the screen can show what was stored.

ALTER TABLE assessment_results ADD COLUMN path TEXT;
