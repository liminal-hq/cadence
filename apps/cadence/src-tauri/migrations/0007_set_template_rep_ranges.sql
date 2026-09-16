-- Replaces set_templates.reps with reps_min/reps_max, so a template can express a rep range (e.g. "8-12") rather than only a single fixed count — a fixed count is still representable as reps_min = reps_max. Adds the new columns and copies any existing fixed rep target into both bounds before dropping the old column, so an already-installed database's existing templates keep their rep target instead of silently going blank.

ALTER TABLE set_templates ADD COLUMN reps_min INTEGER;
ALTER TABLE set_templates ADD COLUMN reps_max INTEGER;
UPDATE set_templates SET reps_min = reps, reps_max = reps WHERE reps IS NOT NULL;
ALTER TABLE set_templates DROP COLUMN reps;
