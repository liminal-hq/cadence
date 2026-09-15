-- Adds the optional goal SCREENS.md P-50 requires editing and rendering as a graph line (SPEC.md 8.8's "name, unit, optional goal, enabled state, and order"), which 0001's schema omitted entirely. Milli-precision, matching measurement_records.value_milli's own convention, since a definition's unit — and so its goal's scale — varies per row (kg, %, cm, ...).

ALTER TABLE measurement_definitions ADD COLUMN goal_milli INTEGER;
