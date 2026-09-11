// Row mapping and persistence for sets, including the composite foreign-key lookup that ties a
// set to its workout-exercise's exercise.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::{SetEntry, SetValues};
use crate::domain::error::{Error, Result};
use crate::domain::units::{g_to_kg, kg_to_g, km_to_m, m_to_km, ms_to_iso};

#[derive(FromRow)]
struct SetRow {
    id: String,
    workout_exercise_id: String,
    sort_order: i32,
    status: String,
    weight_g: Option<i64>,
    reps: Option<i32>,
    distance_m: Option<i64>,
    duration_s: Option<i32>,
    completed_at_ms: Option<i64>,
    note: Option<String>,
    pending_sync: i64,
}

impl From<SetRow> for SetEntry {
    fn from(row: SetRow) -> Self {
        SetEntry {
            id: row.id,
            workout_exercise_id: row.workout_exercise_id,
            order: row.sort_order,
            status: row.status,
            weight_kg: row.weight_g.map(g_to_kg),
            reps: row.reps,
            distance_km: row.distance_m.map(m_to_km),
            duration_sec: row.duration_s,
            completed_at: row.completed_at_ms.map(ms_to_iso),
            note: row.note,
            is_record: false,
            pending_sync: row.pending_sync != 0,
        }
    }
}

/// The parent workout-exercise's `(workout_id, exercise_id)` — every insert needs both to
/// satisfy `sets`' composite foreign key (SPEC.md 10.2's "a set's exercise must match its
/// workout-exercise's exercise" invariant, enforced in schema, not just in this lookup).
async fn parent_ids(
    conn: &mut SqliteConnection,
    workout_exercise_id: &str,
) -> Result<(String, String)> {
    let row: Option<(String, String)> =
        sqlx::query_as("SELECT workout_id, exercise_id FROM workout_exercises WHERE id = ?")
            .bind(workout_exercise_id)
            .fetch_optional(&mut *conn)
            .await?;
    row.ok_or_else(|| Error::NotFound {
        entity: "workout exercise",
        id: workout_exercise_id.to_string(),
    })
}

pub async fn list(conn: &mut SqliteConnection, workout_exercise_id: &str) -> Result<Vec<SetEntry>> {
    let rows: Vec<SetRow> = sqlx::query_as(
        "SELECT id, workout_exercise_id, sort_order, status, weight_g, reps, distance_m, \
         duration_s, completed_at_ms, note, pending_sync FROM sets WHERE workout_exercise_id = ? \
         ORDER BY sort_order",
    )
    .bind(workout_exercise_id)
    .fetch_all(&mut *conn)
    .await?;
    Ok(rows.into_iter().map(SetEntry::from).collect())
}

async fn get(conn: &mut SqliteConnection, id: &str) -> Result<SetEntry> {
    let row: SetRow = sqlx::query_as(
        "SELECT id, workout_exercise_id, sort_order, status, weight_g, reps, distance_m, \
         duration_s, completed_at_ms, note, pending_sync FROM sets WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| Error::NotFound {
        entity: "set",
        id: id.to_string(),
    })?;
    Ok(row.into())
}

/// A blind upsert of an existing set's editable fields — mirrors `saveSet`'s "last write wins,
/// no merge" semantics. The row must already exist (created via `add`/`log_new`); this never
/// creates a new logical set, matching SPEC.md 10.2's "editing a completed set updates in place."
pub async fn save(conn: &mut SqliteConnection, set: &SetEntry) -> Result<SetEntry> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE sets SET status = ?, weight_g = ?, reps = ?, distance_m = ?, duration_s = ?, \
         completed_at_ms = ?, note = ?, pending_sync = ?, updated_at_ms = ?, revision = ? \
         WHERE id = ?",
    )
    .bind(&set.status)
    .bind(set.weight_kg.map(kg_to_g))
    .bind(set.reps)
    .bind(set.distance_km.map(km_to_m))
    .bind(set.duration_sec)
    .bind(
        set.completed_at
            .as_deref()
            .map(crate::domain::units::iso_to_ms)
            .transpose()?,
    )
    .bind(&set.note)
    .bind(set.pending_sync)
    .bind(now)
    .bind(revision)
    .bind(&set.id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "set",
            id: set.id.clone(),
        });
    }
    get(conn, &set.id).await
}

pub async fn complete(conn: &mut SqliteConnection, id: &str) -> Result<SetEntry> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE sets SET status = 'completed', completed_at_ms = ?, updated_at_ms = ?, \
         revision = ? WHERE id = ?",
    )
    .bind(now)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "set",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

/// Appends a new planned set, carrying forward the last sibling's values as a placeholder --
/// mirrors `addSet`'s "repeat last set's numbers" default.
pub async fn add(conn: &mut SqliteConnection, workout_exercise_id: &str) -> Result<SetEntry> {
    let (workout_id, exercise_id) = parent_ids(conn, workout_exercise_id).await?;
    let siblings = list(conn, workout_exercise_id).await?;
    let previous = siblings.last();
    // MAX(order)+1, not COUNT+1 — a prior delete can leave a gap, and COUNT would collide with
    // an existing sort_order rather than always extending past it.
    let next_order = siblings.iter().map(|s| s.order).max().unwrap_or(0) + 1;
    let now = chrono::Utc::now().timestamp_millis();
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO sets (id, workout_id, workout_exercise_id, exercise_id, sort_order, status, \
         weight_g, reps, distance_m, duration_s, pending_sync, created_at_ms, updated_at_ms, \
         revision) VALUES (?, ?, ?, ?, ?, 'planned', ?, ?, ?, ?, 0, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&workout_id)
    .bind(workout_exercise_id)
    .bind(&exercise_id)
    .bind(next_order)
    .bind(previous.and_then(|p| p.weight_kg).map(kg_to_g))
    .bind(previous.and_then(|p| p.reps))
    .bind(previous.and_then(|p| p.distance_km).map(km_to_m))
    .bind(previous.and_then(|p| p.duration_sec))
    .bind(now)
    .bind(now)
    .bind(crate::db::next_revision(conn).await?)
    .execute(&mut *conn)
    .await?;
    get(conn, &id).await
}

/// Creates an already-completed set directly from given values — mirrors `logNewSet`'s "log
/// fresh from the cluster's next draft" fast path, distinct from `add` (always planned, no values).
pub async fn log_new(
    conn: &mut SqliteConnection,
    workout_exercise_id: &str,
    values: &SetValues,
) -> Result<SetEntry> {
    let (workout_id, exercise_id) = parent_ids(conn, workout_exercise_id).await?;
    let next_order = list(conn, workout_exercise_id)
        .await?
        .iter()
        .map(|s| s.order)
        .max()
        .unwrap_or(0)
        + 1;
    let now = chrono::Utc::now().timestamp_millis();
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO sets (id, workout_id, workout_exercise_id, exercise_id, sort_order, status, \
         weight_g, reps, distance_m, duration_s, completed_at_ms, pending_sync, created_at_ms, \
         updated_at_ms, revision) VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, 0, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&workout_id)
    .bind(workout_exercise_id)
    .bind(&exercise_id)
    .bind(next_order)
    .bind(values.weight_kg.map(kg_to_g))
    .bind(values.reps)
    .bind(values.distance_km.map(km_to_m))
    .bind(values.duration_sec)
    .bind(now)
    .bind(now)
    .bind(now)
    .bind(crate::db::next_revision(conn).await?)
    .execute(&mut *conn)
    .await?;
    get(conn, &id).await
}

/// Copies an existing set's numbers into a fresh planned set — resets completion/sync state but
/// keeps its note, mirroring `duplicateSet`'s exact reset-on-copy fields.
pub async fn duplicate(conn: &mut SqliteConnection, id: &str) -> Result<SetEntry> {
    let existing = get(conn, id).await?;
    let (workout_id, exercise_id) = parent_ids(conn, &existing.workout_exercise_id).await?;
    let next_order = list(conn, &existing.workout_exercise_id)
        .await?
        .iter()
        .map(|s| s.order)
        .max()
        .unwrap_or(0)
        + 1;
    let now = chrono::Utc::now().timestamp_millis();
    let new_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO sets (id, workout_id, workout_exercise_id, exercise_id, sort_order, status, \
         weight_g, reps, distance_m, duration_s, note, pending_sync, created_at_ms, updated_at_ms, \
         revision) VALUES (?, ?, ?, ?, ?, 'planned', ?, ?, ?, ?, ?, 0, ?, ?, ?)",
    )
    .bind(&new_id)
    .bind(&workout_id)
    .bind(&existing.workout_exercise_id)
    .bind(&exercise_id)
    .bind(next_order)
    .bind(existing.weight_kg.map(kg_to_g))
    .bind(existing.reps)
    .bind(existing.distance_km.map(km_to_m))
    .bind(existing.duration_sec)
    .bind(&existing.note)
    .bind(now)
    .bind(now)
    .bind(crate::db::next_revision(conn).await?)
    .execute(&mut *conn)
    .await?;
    get(conn, &new_id).await
}

/// A no-op if the set doesn't exist (matches `deleteSet`'s silent-no-op mock semantics), otherwise
/// records a tombstone so a future sync consumer can see the deletion, not just its absence.
pub async fn delete(conn: &mut SqliteConnection, id: &str) -> Result<()> {
    let result = sqlx::query("DELETE FROM sets WHERE id = ?")
        .bind(id)
        .execute(&mut *conn)
        .await?;
    if result.rows_affected() > 0 {
        let revision = crate::db::next_revision(conn).await?;
        let now = chrono::Utc::now().timestamp_millis();
        crate::db::write_tombstone(conn, "set", id, revision, now).await?;
    }
    Ok(())
}

pub async fn update_note(
    conn: &mut SqliteConnection,
    id: &str,
    note: Option<&str>,
) -> Result<SetEntry> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result =
        sqlx::query("UPDATE sets SET note = ?, updated_at_ms = ?, revision = ? WHERE id = ?")
            .bind(note)
            .bind(now)
            .bind(revision)
            .bind(id)
            .execute(&mut *conn)
            .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "set",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    const SPOTTER_NOTE: &str = "Spotter touched the bar on rep 9 — count it as 8 clean. Grip felt \
         narrow, try one finger wider next";

    /// A fresh bench-press workout-exercise with the same four-set shape the old seed fixture
    /// had: two completed sets (the second carrying a note) in order, then two planned ones.
    async fn seed_four_bench_press_sets(conn: &mut SqliteConnection) -> (String, Vec<SetEntry>) {
        let workout = crate::domain::workouts::repo::create(conn, "2026-09-09", "Push A")
            .await
            .unwrap();
        let we =
            crate::domain::workouts::workout_exercises::add(conn, &workout.id, "ex-bench-press")
                .await
                .unwrap();
        log_new(
            conn,
            &we.id,
            &SetValues {
                weight_kg: Some(80.0),
                reps: Some(8),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        let second = log_new(
            conn,
            &we.id,
            &SetValues {
                weight_kg: Some(80.0),
                reps: Some(9),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        update_note(conn, &second.id, Some(SPOTTER_NOTE))
            .await
            .unwrap();
        add(conn, &we.id).await.unwrap();
        add(conn, &we.id).await.unwrap();
        let sets = list(conn, &we.id).await.unwrap();
        (we.id, sets)
    }

    #[tokio::test]
    async fn lists_sets_in_order_with_units_converted() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let (_, sets) = seed_four_bench_press_sets(&mut conn).await;
        assert_eq!(sets.len(), 4);
        assert_eq!(sets[0].weight_kg, Some(80.0));
        assert_eq!(sets[1].note.as_deref(), Some(SPOTTER_NOTE));
        assert!(sets[1].completed_at.is_some());
    }

    #[tokio::test]
    async fn distance_duration_sets_round_trip_correctly() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let workout = crate::domain::workouts::repo::create(&mut conn, "2026-09-04", "Push A")
            .await
            .unwrap();
        let we =
            crate::domain::workouts::workout_exercises::add(&mut conn, &workout.id, "ex-running")
                .await
                .unwrap();
        log_new(
            &mut conn,
            &we.id,
            &SetValues {
                distance_km: Some(5.0),
                duration_sec: Some(1680),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        let sets = list(&mut conn, &we.id).await.unwrap();
        assert_eq!(sets[0].distance_km, Some(5.0));
        assert_eq!(sets[0].duration_sec, Some(1680));
    }

    #[tokio::test]
    async fn completes_a_planned_set() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let (_, sets) = seed_four_bench_press_sets(&mut conn).await;
        let completed = complete(&mut conn, &sets[2].id).await.unwrap();
        assert_eq!(completed.status, "completed");
        assert!(completed.completed_at.is_some());
    }

    #[tokio::test]
    async fn rejects_completing_an_unknown_set() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = complete(&mut conn, "no-such-set").await.unwrap_err();
        assert!(matches!(err, Error::NotFound { entity: "set", .. }));
    }

    #[tokio::test]
    async fn save_updates_an_existing_set_in_place() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let (_, sets) = seed_four_bench_press_sets(&mut conn).await;
        let mut set = get(&mut conn, &sets[2].id).await.unwrap();
        set.weight_kg = Some(85.0);
        set.reps = Some(6);
        let saved = save(&mut conn, &set).await.unwrap();
        assert_eq!(saved.weight_kg, Some(85.0));
        assert_eq!(saved.reps, Some(6));
    }

    #[tokio::test]
    async fn rejects_saving_a_set_that_does_not_exist() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let phantom = SetEntry {
            id: "no-such-set".to_string(),
            // Never actually looked up — save() fails on the UPDATE affecting zero rows, not any
            // FK check against this field.
            workout_exercise_id: "no-such-workout-exercise".to_string(),
            order: 1,
            status: "planned".to_string(),
            weight_kg: None,
            reps: None,
            distance_km: None,
            duration_sec: None,
            completed_at: None,
            note: None,
            is_record: false,
            pending_sync: false,
        };
        let err = save(&mut conn, &phantom).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }

    #[tokio::test]
    async fn add_repeats_the_last_siblings_values_as_a_planned_set() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let (we_id, sets) = seed_four_bench_press_sets(&mut conn).await;
        let added = add(&mut conn, &we_id).await.unwrap();
        assert_eq!(added.status, "planned");
        // Repeats the last sibling's (sets[3], a planned set that itself repeated sets[1]'s
        // 80kg/9reps) values.
        assert_eq!(added.weight_kg, sets[3].weight_kg);
        assert_eq!(added.reps, sets[3].reps);
        assert_eq!(added.order, 5);
    }

    #[tokio::test]
    async fn add_with_no_siblings_creates_an_empty_planned_set() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let workout = crate::domain::workouts::repo::create(&mut conn, "2026-09-09", "Push A")
            .await
            .unwrap();
        let we = crate::domain::workouts::workout_exercises::add(
            &mut conn,
            &workout.id,
            "ex-goblet-squat",
        )
        .await
        .unwrap();
        let added = add(&mut conn, &we.id).await.unwrap();
        assert_eq!(added.order, 1);
        assert_eq!(added.weight_kg, None);
    }

    #[tokio::test]
    async fn log_new_creates_an_already_completed_set() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let workout = crate::domain::workouts::repo::create(&mut conn, "2026-09-09", "Push A")
            .await
            .unwrap();
        let we = crate::domain::workouts::workout_exercises::add(
            &mut conn,
            &workout.id,
            "ex-bench-press",
        )
        .await
        .unwrap();
        let values = SetValues {
            weight_kg: Some(82.5),
            reps: Some(6),
            ..Default::default()
        };
        let logged = log_new(&mut conn, &we.id, &values).await.unwrap();
        assert_eq!(logged.status, "completed");
        assert!(logged.completed_at.is_some());
        assert_eq!(logged.weight_kg, Some(82.5));
    }

    #[tokio::test]
    async fn duplicate_resets_completion_and_sync_state_but_keeps_the_note() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let (_, sets) = seed_four_bench_press_sets(&mut conn).await;
        let duplicated = duplicate(&mut conn, &sets[1].id).await.unwrap();
        assert_eq!(duplicated.status, "planned");
        assert_eq!(duplicated.completed_at, None);
        assert!(!duplicated.pending_sync);
        assert_eq!(duplicated.weight_kg, Some(80.0));
        assert_eq!(duplicated.reps, Some(9));
        assert!(duplicated.note.is_some());
        assert_ne!(duplicated.id, sets[1].id);
    }

    #[tokio::test]
    async fn deletes_a_set() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let (we_id, sets) = seed_four_bench_press_sets(&mut conn).await;
        delete(&mut conn, &sets[3].id).await.unwrap();
        let remaining = list(&mut conn, &we_id).await.unwrap();
        assert!(!remaining.iter().any(|s| s.id == sets[3].id));
    }

    #[tokio::test]
    async fn deleting_an_unknown_set_is_a_silent_no_op() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        delete(&mut conn, "no-such-set").await.unwrap();
    }

    #[tokio::test]
    async fn delete_records_a_tombstone_for_future_sync() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let (_, sets) = seed_four_bench_press_sets(&mut conn).await;
        delete(&mut conn, &sets[3].id).await.unwrap();
        let (revision,): (i64,) = sqlx::query_as(
            "SELECT revision FROM tombstones WHERE entity_type = 'set' AND entity_id = ?",
        )
        .bind(&sets[3].id)
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert!(revision > 0);
    }

    #[tokio::test]
    async fn add_extends_past_the_highest_order_even_after_a_middle_set_was_deleted() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        // Four sets at order 1..4; deleting order 2 leaves a gap COUNT-based math would collide
        // on (COUNT=3, +1=4 — already taken by the surviving order-4 set).
        let (we_id, sets) = seed_four_bench_press_sets(&mut conn).await;
        delete(&mut conn, &sets[1].id).await.unwrap();
        let added = add(&mut conn, &we_id).await.unwrap();
        assert_eq!(added.order, 5);
    }

    #[tokio::test]
    async fn updates_and_clears_a_set_note() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let (_, sets) = seed_four_bench_press_sets(&mut conn).await;
        let updated = update_note(&mut conn, &sets[0].id, Some("Felt easy"))
            .await
            .unwrap();
        assert_eq!(updated.note.as_deref(), Some("Felt easy"));
        let cleared = update_note(&mut conn, &sets[0].id, None).await.unwrap();
        assert_eq!(cleared.note, None);
    }

    #[tokio::test]
    async fn rejects_updating_the_note_of_an_unknown_set() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = update_note(&mut conn, "no-such-set", Some("x"))
            .await
            .unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }
}
