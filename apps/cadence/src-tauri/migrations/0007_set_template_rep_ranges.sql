-- Replaces set_templates.reps with reps_min/reps_max, so a template can express a rep range (e.g. "8-12") rather than only a single fixed count — a fixed count is still representable as reps_min = reps_max.

ALTER TABLE set_templates DROP COLUMN reps;
ALTER TABLE set_templates ADD COLUMN reps_min INTEGER;
ALTER TABLE set_templates ADD COLUMN reps_max INTEGER;
