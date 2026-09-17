-- Normalizes Workout.status to SPEC.md §8.1's four-state lifecycle (draft, active, completed,
-- abandoned), replacing the two ad hoc values ('in-progress', 'completed') used since 0001. This
-- unblocks completing/abandoning/reopening a workout (issue #36) — nothing could ever reach
-- 'completed' before, so Today's "Continue workout" state and Settings' delete-all (which only
-- ever matched status = 'completed') were permanently unreachable.
--
-- SQLite has no ALTER TABLE ... ALTER COLUMN, so changing a CHECK constraint means rebuilding the
-- table. Building the replacement under a temporary name and dropping the *original* `workouts`
-- (rather than renaming it out of the way first) keeps every dependent foreign key resolving
-- correctly by name throughout — renaming `workouts` first would make SQLite silently repoint
-- `workout_exercises`/`supersets`/`health_import_candidates`'s REFERENCES clauses at the
-- soon-to-be-dropped name, breaking every future insert into those tables.

CREATE TABLE workouts_new (
    id                      TEXT PRIMARY KEY,
    local_date              TEXT NOT NULL,
    title                   TEXT NOT NULL,
    note                    TEXT,
    started_at_ms           INTEGER,
    completed_at_ms         INTEGER,
    status                  TEXT NOT NULL CHECK (status IN ('draft','active','completed','abandoned')),
    source                  TEXT NOT NULL DEFAULT 'manual',
    logged_by_watch         INTEGER NOT NULL DEFAULT 0 CHECK (logged_by_watch IN (0,1)),
    source_routine_id       TEXT REFERENCES routines(id) ON DELETE SET NULL,
    source_routine_name     TEXT,
    hc_source_app           TEXT,
    hc_record_id            TEXT,
    hc_imported_at_ms       INTEGER,
    hc_unmapped_metrics     TEXT,
    hc_overlaps_workout_id  TEXT REFERENCES workouts_new(id) ON DELETE SET NULL,
    hc_exported_record_id   TEXT,
    hc_exported_at_ms       INTEGER,
    created_at_ms           INTEGER NOT NULL,
    updated_at_ms           INTEGER NOT NULL,
    revision                INTEGER NOT NULL
);

-- 'in-progress' -> 'active' is the only value remap; 'completed' rows pass through unchanged.
-- started_at_ms is backfilled from created_at_ms since no write path has ever populated it.
INSERT INTO workouts_new (
    id, local_date, title, note, started_at_ms, completed_at_ms, status, source,
    logged_by_watch, source_routine_id, source_routine_name, hc_source_app, hc_record_id,
    hc_imported_at_ms, hc_unmapped_metrics, hc_overlaps_workout_id, hc_exported_record_id,
    hc_exported_at_ms, created_at_ms, updated_at_ms, revision
)
SELECT
    id, local_date, title, note, COALESCE(started_at_ms, created_at_ms), completed_at_ms,
    CASE status WHEN 'in-progress' THEN 'active' ELSE status END,
    source, logged_by_watch, source_routine_id, source_routine_name, hc_source_app,
    hc_record_id, hc_imported_at_ms, hc_unmapped_metrics, hc_overlaps_workout_id,
    hc_exported_record_id, hc_exported_at_ms, created_at_ms, updated_at_ms, revision
FROM workouts;

DROP TABLE workouts;

ALTER TABLE workouts_new RENAME TO workouts;

CREATE INDEX idx_workouts_date ON workouts (local_date);
CREATE INDEX idx_workouts_status ON workouts (status);
CREATE UNIQUE INDEX uq_workouts_hc_record ON workouts (hc_record_id) WHERE hc_record_id IS NOT NULL;
