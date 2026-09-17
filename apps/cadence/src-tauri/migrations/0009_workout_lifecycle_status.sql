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
--
-- The DROP TABLE below relies on running with foreign-key enforcement OFF: with it on, SQLite
-- treats dropping a table as deleting every row in it first, which fires `workout_exercises`/
-- `supersets`'s `ON DELETE CASCADE` and would destroy every workout's exercises and sets on any
-- populated database. `src/db/mod.rs`'s `run_migrations` is what actually guarantees this — it
-- runs the whole migrator against a connection opened with enforcement off from the start, since
-- `PRAGMA foreign_keys` can't be changed mid-transaction and sqlx's SQLite driver always runs each
-- migration inside one.

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

-- 'completed' rows pass through unchanged. Of the 'in-progress' rows, only the single
-- most-recently-updated one becomes 'active' — nothing before this migration ever enforced
-- SPEC.md 8.1's single-active-workout model, so a real install can genuinely have more than one
-- (started on different days, never finished). Migrating every one of them to 'active' would
-- carry that pre-existing inconsistency forward into a schema that now assumes at most one, where
-- `get_open`'s `LIMIT 1` would then hide every extra one from Today with no way back in and no way
-- to delete it (history deletion only ever touches completed/abandoned workouts). The others
-- become 'abandoned' instead, with completed_at_ms backfilled from their own updated_at_ms since
-- nothing recorded when they actually stopped being worked on — abandoning never discards a
-- workout's sets, so this loses nothing a user logged, only the ambiguous "still in progress" status.
-- started_at_ms is backfilled from created_at_ms since no write path has ever populated it.
INSERT INTO workouts_new (
    id, local_date, title, note, started_at_ms, completed_at_ms, status, source,
    logged_by_watch, source_routine_id, source_routine_name, hc_source_app, hc_record_id,
    hc_imported_at_ms, hc_unmapped_metrics, hc_overlaps_workout_id, hc_exported_record_id,
    hc_exported_at_ms, created_at_ms, updated_at_ms, revision
)
SELECT
    id, local_date, title, note, COALESCE(started_at_ms, created_at_ms),
    CASE
        WHEN status = 'in-progress' AND id != (
            SELECT id FROM workouts WHERE status = 'in-progress'
            ORDER BY updated_at_ms DESC, id DESC LIMIT 1
        ) THEN updated_at_ms
        ELSE completed_at_ms
    END,
    CASE
        WHEN status != 'in-progress' THEN status
        WHEN id = (
            SELECT id FROM workouts WHERE status = 'in-progress'
            ORDER BY updated_at_ms DESC, id DESC LIMIT 1
        ) THEN 'active'
        ELSE 'abandoned'
    END,
    source, logged_by_watch, source_routine_id, source_routine_name, hc_source_app,
    hc_record_id, hc_imported_at_ms, hc_unmapped_metrics, hc_overlaps_workout_id,
    hc_exported_record_id, hc_exported_at_ms, created_at_ms, updated_at_ms, revision
FROM workouts;

DROP TABLE workouts;

ALTER TABLE workouts_new RENAME TO workouts;

CREATE INDEX idx_workouts_date ON workouts (local_date);
CREATE INDEX idx_workouts_status ON workouts (status);
CREATE UNIQUE INDEX uq_workouts_hc_record ON workouts (hc_record_id) WHERE hc_record_id IS NOT NULL;
