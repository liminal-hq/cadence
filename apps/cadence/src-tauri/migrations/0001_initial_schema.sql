-- Cadence's full domain schema (SPEC.md section 10), covering both the entities the shipped
-- frontend already models and entities for features with no UI yet (routines, goals,
-- measurements, Health Connect staging, analysis favourites) so later feature work is pure
-- application code, never a schema migration. See the backend design plan for full rationale.
--
-- Conventions used throughout: TEXT UUIDv4 ids (never AUTOINCREMENT — SPEC.md's stable-id
-- requirement for backup/sync); INTEGER epoch-milliseconds for instants (_ms suffix); TEXT
-- 'YYYY-MM-DD' for local dates, always stored separately from instants; INTEGER 0/1 booleans;
-- canonical units as integers (grams, metres, seconds) to keep arithmetic exact. Enum-shaped
-- columns are CHECK-constrained only when the set of values is closed (status machines); columns
-- expected to grow (metric_profile, workouts.source, set_label, ...) are plain Rust-validated
-- TEXT, so adding a new value is a Rust match arm, not a migration.

-- ============ sync primitives ============
-- Not consumed by any Rust module yet (no watch app exists) — built in now because retrofitting
-- revision stamping across every mutation path later is the expensive version of this.

CREATE TABLE sync_state (
    id       INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL DEFAULT 0
);
INSERT INTO sync_state (id, revision) VALUES (1, 0);

CREATE TABLE tombstones (
    entity_type   TEXT NOT NULL,
    entity_id     TEXT NOT NULL,
    revision      INTEGER NOT NULL,
    deleted_at_ms INTEGER NOT NULL,
    PRIMARY KEY (entity_type, entity_id)
);
CREATE INDEX idx_tombstones_revision ON tombstones (revision);

CREATE TABLE device_mutations (
    id              TEXT PRIMARY KEY,
    source_device   TEXT NOT NULL,
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    entity_revision INTEGER NOT NULL,
    mutated_at_ms   INTEGER NOT NULL,
    ack_state       TEXT NOT NULL DEFAULT 'pending',
    payload         TEXT
);
CREATE INDEX idx_device_mutations_ack ON device_mutations (ack_state);
CREATE INDEX idx_device_mutations_entity ON device_mutations (entity_type, entity_id);

-- ============ taxonomy ============

CREATE TABLE categories (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    -- three tonal roles, matching apps/cadence/src/data/categoryColours.ts's CategoryColour shape
    colour_background TEXT NOT NULL,
    colour_text       TEXT NOT NULL,
    colour_dot        TEXT NOT NULL,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    archived          INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
    created_at_ms     INTEGER NOT NULL,
    updated_at_ms     INTEGER NOT NULL,
    revision          INTEGER NOT NULL
);

CREATE TABLE exercises (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    category_id           TEXT NOT NULL REFERENCES categories(id),
    metric_profile        TEXT NOT NULL,
    notes                 TEXT,
    url                   TEXT,
    favourite             INTEGER NOT NULL DEFAULT 0 CHECK (favourite IN (0,1)),
    archived              INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
    weight_increment_g    INTEGER,
    reps_increment        INTEGER,
    distance_increment_m  INTEGER,
    duration_increment_s  INTEGER,
    default_rest_ms       INTEGER,
    graph_defaults        TEXT,
    created_at_ms         INTEGER NOT NULL,
    updated_at_ms         INTEGER NOT NULL,
    revision              INTEGER NOT NULL
);
CREATE INDEX idx_exercises_category ON exercises (category_id);

-- ============ routines (no frontend UI yet — schema only, ready for a future feature PR) ============

CREATE TABLE routines (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    note          TEXT,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    archived      INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    revision      INTEGER NOT NULL
);

CREATE TABLE routine_sections (
    id            TEXT PRIMARY KEY,
    routine_id    TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    name          TEXT,
    sort_order    INTEGER NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    revision      INTEGER NOT NULL
);
CREATE INDEX idx_routine_sections_routine ON routine_sections (routine_id, sort_order);

-- A routine-authored superset template; materialization copies rows into workout-level
-- `supersets` below, matching how `set_templates` materialize into `sets`.
CREATE TABLE routine_supersets (
    id                  TEXT PRIMARY KEY,
    routine_section_id  TEXT NOT NULL REFERENCES routine_sections(id) ON DELETE CASCADE,
    colour              TEXT,
    auto_advance        INTEGER NOT NULL DEFAULT 1 CHECK (auto_advance IN (0,1)),
    rest_ms             INTEGER,
    created_at_ms       INTEGER NOT NULL,
    updated_at_ms       INTEGER NOT NULL,
    revision            INTEGER NOT NULL
);

CREATE TABLE routine_exercises (
    id                  TEXT PRIMARY KEY,
    routine_section_id  TEXT NOT NULL REFERENCES routine_sections(id) ON DELETE CASCADE,
    exercise_id         TEXT NOT NULL REFERENCES exercises(id),
    sort_order          INTEGER NOT NULL,
    routine_superset_id TEXT REFERENCES routine_supersets(id) ON DELETE SET NULL,
    superset_position   INTEGER,
    rest_ms             INTEGER,
    note                TEXT,
    created_at_ms       INTEGER NOT NULL,
    updated_at_ms       INTEGER NOT NULL,
    revision            INTEGER NOT NULL
);
CREATE INDEX idx_routine_exercises_section ON routine_exercises (routine_section_id, sort_order);

CREATE TABLE set_templates (
    id                    TEXT PRIMARY KEY,
    routine_exercise_id   TEXT NOT NULL REFERENCES routine_exercises(id) ON DELETE CASCADE,
    sort_order            INTEGER NOT NULL,
    -- either explicit target values (same shared-dimension shape as `sets`)...
    weight_g              INTEGER,
    reps                  INTEGER,
    distance_m            INTEGER,
    duration_s            INTEGER,
    extra_metrics         TEXT,
    -- ...or a population rule, e.g. "seed from most recent comparable performance" (SPEC.md 10.1)
    population_rule       TEXT,
    population_config     TEXT,
    set_label             TEXT,
    created_at_ms         INTEGER NOT NULL,
    updated_at_ms         INTEGER NOT NULL,
    revision              INTEGER NOT NULL
);
CREATE INDEX idx_set_templates_routine_exercise ON set_templates (routine_exercise_id, sort_order);

-- ============ workouts ============

CREATE TABLE workouts (
    id                      TEXT PRIMARY KEY,
    local_date              TEXT NOT NULL,
    title                   TEXT NOT NULL,
    note                    TEXT,
    started_at_ms           INTEGER,
    completed_at_ms         INTEGER,
    status                  TEXT NOT NULL CHECK (status IN ('in-progress','completed')),
    source                  TEXT NOT NULL DEFAULT 'manual',
    logged_by_watch         INTEGER NOT NULL DEFAULT 0 CHECK (logged_by_watch IN (0,1)),
    source_routine_id       TEXT REFERENCES routines(id) ON DELETE SET NULL,
    source_routine_name     TEXT,
    hc_source_app           TEXT,
    hc_record_id            TEXT,
    hc_imported_at_ms       INTEGER,
    hc_unmapped_metrics     TEXT,
    hc_overlaps_workout_id  TEXT REFERENCES workouts(id) ON DELETE SET NULL,
    hc_exported_record_id   TEXT,
    hc_exported_at_ms       INTEGER,
    created_at_ms           INTEGER NOT NULL,
    updated_at_ms           INTEGER NOT NULL,
    revision                INTEGER NOT NULL
);
CREATE INDEX idx_workouts_date ON workouts (local_date);
CREATE INDEX idx_workouts_status ON workouts (status);
CREATE UNIQUE INDEX uq_workouts_hc_record ON workouts (hc_record_id) WHERE hc_record_id IS NOT NULL;

CREATE TABLE supersets (
    id            TEXT PRIMARY KEY,
    workout_id    TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    colour        TEXT,
    auto_advance  INTEGER NOT NULL DEFAULT 1 CHECK (auto_advance IN (0,1)),
    rest_ms       INTEGER,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    revision      INTEGER NOT NULL
);
CREATE INDEX idx_supersets_workout ON supersets (workout_id);

CREATE TABLE workout_exercises (
    id                TEXT PRIMARY KEY,
    workout_id        TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id       TEXT NOT NULL REFERENCES exercises(id),
    sort_order        INTEGER NOT NULL,
    today_note        TEXT,
    superset_id       TEXT REFERENCES supersets(id) ON DELETE SET NULL,
    superset_position INTEGER,
    offline_since_ms  INTEGER,
    created_at_ms     INTEGER NOT NULL,
    updated_at_ms     INTEGER NOT NULL,
    revision          INTEGER NOT NULL,
    UNIQUE (id, workout_id, exercise_id)
);
CREATE INDEX idx_workout_exercises_workout ON workout_exercises (workout_id, sort_order);
CREATE INDEX idx_workout_exercises_exercise ON workout_exercises (exercise_id);

CREATE TABLE sets (
    id                    TEXT PRIMARY KEY,
    workout_id            TEXT NOT NULL,
    workout_exercise_id   TEXT NOT NULL,
    exercise_id           TEXT NOT NULL,
    sort_order            INTEGER NOT NULL,
    status                TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','completed')),
    weight_g              INTEGER,
    reps                  INTEGER,
    distance_m            INTEGER,
    duration_s            INTEGER,
    extra_metrics         TEXT,
    entry_weight_unit     TEXT,
    entry_distance_unit   TEXT,
    completed_at_ms       INTEGER,
    note                  TEXT,
    set_label             TEXT,
    source_template_id    TEXT,
    pending_sync          INTEGER NOT NULL DEFAULT 0 CHECK (pending_sync IN (0,1)),
    created_at_ms         INTEGER NOT NULL,
    updated_at_ms         INTEGER NOT NULL,
    revision              INTEGER NOT NULL,
    -- DB-enforced invariant (SPEC.md 10.2): a set's exercise must match its workout-exercise's
    -- exercise — not just an app-level convention.
    FOREIGN KEY (workout_exercise_id, workout_id, exercise_id)
        REFERENCES workout_exercises (id, workout_id, exercise_id) ON DELETE CASCADE
);
CREATE INDEX idx_sets_workout_exercise ON sets (workout_exercise_id, sort_order);
CREATE INDEX idx_sets_exercise ON sets (exercise_id, completed_at_ms);
CREATE INDEX idx_sets_workout ON sets (workout_id);

-- ============ goals & measurements (no frontend UI yet) ============

CREATE TABLE exercise_goals (
    id                  TEXT PRIMARY KEY,
    exercise_id         TEXT NOT NULL REFERENCES exercises(id),
    title               TEXT NOT NULL,
    target_weight_g     INTEGER,
    target_reps         INTEGER,
    target_distance_m   INTEGER,
    target_duration_s   INTEGER,
    target_extra        TEXT,
    start_date          TEXT,
    target_date         TEXT,
    achieved_at_ms      INTEGER,
    progress_config     TEXT,
    archived            INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
    created_at_ms       INTEGER NOT NULL,
    updated_at_ms       INTEGER NOT NULL,
    revision            INTEGER NOT NULL
);
CREATE INDEX idx_exercise_goals_exercise ON exercise_goals (exercise_id);

CREATE TABLE measurement_definitions (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    unit          TEXT NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    archived      INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    revision      INTEGER NOT NULL
);

CREATE TABLE measurement_records (
    id              TEXT PRIMARY KEY,
    definition_id   TEXT NOT NULL REFERENCES measurement_definitions(id) ON DELETE CASCADE,
    local_date      TEXT NOT NULL,
    recorded_at_ms  INTEGER NOT NULL,
    value_milli     INTEGER NOT NULL,
    note            TEXT,
    hc_source_app   TEXT,
    hc_record_id    TEXT,
    created_at_ms   INTEGER NOT NULL,
    updated_at_ms   INTEGER NOT NULL,
    revision        INTEGER NOT NULL
);
CREATE INDEX idx_measurement_records_definition ON measurement_records (definition_id, local_date);
CREATE UNIQUE INDEX uq_measurement_records_hc ON measurement_records (hc_record_id) WHERE hc_record_id IS NOT NULL;

-- ============ Health Connect import staging (no frontend UI yet) ============

CREATE TABLE health_import_candidates (
    id                    TEXT PRIMARY KEY,
    external_record_id    TEXT NOT NULL UNIQUE,
    source_app            TEXT NOT NULL,
    record_type           TEXT NOT NULL,
    local_date            TEXT NOT NULL,
    start_at_ms           INTEGER,
    end_at_ms             INTEGER,
    metric_summary        TEXT,
    status                TEXT NOT NULL DEFAULT 'new',
    imported_workout_id   TEXT REFERENCES workouts(id) ON DELETE SET NULL,
    overlap_workout_id    TEXT REFERENCES workouts(id) ON DELETE SET NULL,
    overlap_resolution    TEXT,
    created_at_ms         INTEGER NOT NULL,
    updated_at_ms         INTEGER NOT NULL
);
CREATE INDEX idx_health_import_candidates_status ON health_import_candidates (status);

-- ============ analysis favourites (no frontend UI yet) ============

CREATE TABLE analysis_favourites (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    config        TEXT NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    revision      INTEGER NOT NULL
);

-- ============ equipment, timer, settings ============

CREATE TABLE barbell_configs (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    display_unit      TEXT NOT NULL CHECK (display_unit IN ('kg','lb')),
    bar_weight_milli  INTEGER NOT NULL,
    plates_json       TEXT NOT NULL,
    is_default        INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
    created_at_ms     INTEGER NOT NULL,
    updated_at_ms     INTEGER NOT NULL,
    revision          INTEGER NOT NULL
);
CREATE UNIQUE INDEX uq_barbell_configs_default ON barbell_configs (is_default) WHERE is_default = 1;

-- Singleton, persisted (not in-memory) so an active rest timer survives process death — SPEC.md
-- section 12's reliability requirement, and the mock's own "target instant, not accumulated
-- ticks" model already anticipates this.
CREATE TABLE rest_timer (
    id                     INTEGER PRIMARY KEY CHECK (id = 1),
    status                 TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive','running','paused')),
    target_instant_ms      INTEGER,
    total_ms               INTEGER,
    remaining_ms_at_pause  INTEGER,
    owner_device           TEXT,
    for_set_id             TEXT,
    next_set_label         TEXT,
    revision               INTEGER NOT NULL DEFAULT 0
);
INSERT INTO rest_timer (id) VALUES (1);

-- Singleton, typed columns rather than a JSON blob — settings are read on nearly every screen and
-- benefit from CHECK constraints + a stable Rust struct more than from schema-free flexibility.
CREATE TABLE app_settings (
    id                              INTEGER PRIMARY KEY CHECK (id = 1),
    weight_unit                     TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg','lb')),
    default_rest_ms                 INTEGER NOT NULL DEFAULT 120000,
    rest_auto_start                 INTEGER NOT NULL DEFAULT 1 CHECK (rest_auto_start IN (0,1)),
    rest_replaces_running           INTEGER NOT NULL DEFAULT 0 CHECK (rest_replaces_running IN (0,1)),
    vibrate_enabled                 INTEGER NOT NULL DEFAULT 1 CHECK (vibrate_enabled IN (0,1)),
    sound_enabled                   INTEGER NOT NULL DEFAULT 1 CHECK (sound_enabled IN (0,1)),
    rest_feedback_device            TEXT NOT NULL DEFAULT 'phone',
    workout_timer_auto_start        INTEGER NOT NULL DEFAULT 1 CHECK (workout_timer_auto_start IN (0,1)),
    keep_screen_on_during_workout   INTEGER NOT NULL DEFAULT 0 CHECK (keep_screen_on_during_workout IN (0,1)),
    haptic_on_set_complete          INTEGER NOT NULL DEFAULT 1 CHECK (haptic_on_set_complete IN (0,1)),
    haptic_on_rest_end              INTEGER NOT NULL DEFAULT 1 CHECK (haptic_on_rest_end IN (0,1)),
    reduced_motion                  INTEGER NOT NULL DEFAULT 0 CHECK (reduced_motion IN (0,1)),
    notifications_denied            INTEGER NOT NULL DEFAULT 0 CHECK (notifications_denied IN (0,1)),
    automatic_backup_enabled        INTEGER NOT NULL DEFAULT 0 CHECK (automatic_backup_enabled IN (0,1)),
    updated_at_ms                   INTEGER NOT NULL
);
INSERT INTO app_settings (id, updated_at_ms) VALUES (1, 0);
