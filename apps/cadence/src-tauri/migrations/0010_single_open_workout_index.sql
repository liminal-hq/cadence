-- Enforces SPEC.md 8.1's single-active-workout model atomically at the database level: at most one
-- workout may have status 'draft' or 'active' at a time. Application-level checks (get_open before
-- an insert) close the common case but leave a real race — two near-simultaneous calls, e.g. a
-- double-tap on "Start workout" before the UI reflects the first one, can both pass a
-- check-then-insert and each create their own active workout, with get_open's own LIMIT 1 then
-- hiding one of them from Today. Indexing on a constant expression rather than a real column is
-- the standard SQLite idiom for "at most one row may satisfy this WHERE clause" — every qualifying
-- row indexes to the same constant, so a second one collides with the first.
--
-- Safe against pre-existing data: 0009 already consolidates any legacy database down to at most
-- one 'active' workout (everything else becomes 'abandoned'), and nothing has ever produced a
-- 'draft' row, so this index can never find more than zero or one qualifying rows to begin with.

CREATE UNIQUE INDEX ux_workouts_single_open ON workouts ((1)) WHERE status IN ('draft', 'active');
