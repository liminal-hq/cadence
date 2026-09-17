// Row mapping and persistence for workouts, including Health Connect provenance.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::{Workout, WorkoutHealthConnectProvenance};
use crate::domain::error::{Error, Result};
use crate::domain::units::ms_to_iso;

#[derive(FromRow)]
struct WorkoutRow {
    id: String,
    local_date: String,
    title: String,
    note: Option<String>,
    started_at_ms: Option<i64>,
    completed_at_ms: Option<i64>,
    status: String,
    source: String,
    logged_by_watch: i64,
    source_routine_id: Option<String>,
    source_routine_name: Option<String>,
    hc_source_app: Option<String>,
    hc_record_id: Option<String>,
    hc_imported_at_ms: Option<i64>,
    hc_unmapped_metrics: Option<String>,
    hc_overlaps_workout_id: Option<String>,
}

/// `hc_source_app`/`hc_record_id`/`hc_imported_at_ms` are only ever written together (every
/// insert path sets all three or none) — if a row ever has one without the others, that's
/// corruption, not a workout with partial provenance, so this drops the provenance entirely
/// rather than rendering a health-connect badge with a blank date or record id.
fn health_connect_provenance(row: &WorkoutRow) -> Option<WorkoutHealthConnectProvenance> {
    let source_app = row.hc_source_app.clone()?;
    let (Some(record_id), Some(imported_at_ms)) = (row.hc_record_id.clone(), row.hc_imported_at_ms)
    else {
        log::warn!(
            "workout {} has hc_source_app set without a matching record_id/imported_at — \
             dropping health-connect provenance",
            row.id
        );
        return None;
    };
    let unmapped_metrics = row.hc_unmapped_metrics.as_deref().and_then(|json| {
        serde_json::from_str(json)
            .inspect_err(|e| {
                log::warn!(
                    "workout {} has malformed hc_unmapped_metrics JSON: {e}",
                    row.id
                )
            })
            .ok()
    });
    Some(WorkoutHealthConnectProvenance {
        source_app,
        record_id,
        imported_at: ms_to_iso(imported_at_ms),
        unmapped_metrics,
        overlaps_with_workout_id: row.hc_overlaps_workout_id.clone(),
    })
}

impl From<WorkoutRow> for Workout {
    fn from(row: WorkoutRow) -> Self {
        let health_connect = health_connect_provenance(&row);

        Workout {
            id: row.id,
            date: row.local_date,
            title: row.title,
            note: row.note,
            started_at: row.started_at_ms.map(ms_to_iso),
            completed_at: row.completed_at_ms.map(ms_to_iso),
            status: row.status,
            source: row.source,
            logged_by_watch: row.logged_by_watch != 0,
            source_routine_id: row.source_routine_id,
            source_routine_name: row.source_routine_name,
            health_connect,
        }
    }
}

pub async fn get(conn: &mut SqliteConnection, id: &str) -> Result<Workout> {
    let row: WorkoutRow = sqlx::query_as(
        "SELECT id, local_date, title, note, started_at_ms, completed_at_ms, status, source, \
         logged_by_watch, source_routine_id, source_routine_name, hc_source_app, hc_record_id, \
         hc_imported_at_ms, hc_unmapped_metrics, hc_overlaps_workout_id FROM workouts \
         WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(conn)
    .await?
    .ok_or_else(|| Error::NotFound {
        entity: "workout",
        id: id.to_string(),
    })?;
    Ok(row.into())
}

/// Inclusive of both bounds — string comparison on `YYYY-MM-DD` sorts correctly, matching
/// `listWorkoutsInRange`'s documented contract exactly. Same-day workouts break ties by `id` for
/// a deterministic order (the interface doesn't promise anything more specific than "grouped by
/// date").
pub async fn list_in_range(
    conn: &mut SqliteConnection,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<Workout>> {
    let rows: Vec<WorkoutRow> = sqlx::query_as(
        "SELECT id, local_date, title, note, started_at_ms, completed_at_ms, status, source, \
         logged_by_watch, source_routine_id, source_routine_name, hc_source_app, hc_record_id, \
         hc_imported_at_ms, hc_unmapped_metrics, hc_overlaps_workout_id FROM workouts \
         WHERE local_date >= ? AND local_date <= ? ORDER BY local_date, id",
    )
    .bind(start_date)
    .bind(end_date)
    .fetch_all(conn)
    .await?;
    Ok(rows.into_iter().map(Workout::from).collect())
}

/// The single `draft`/`active` workout, if one exists — SPEC.md 8.1's "only one workout is active
/// ... by default" model is global, not scoped to today's date, so Today's "Continue workout"
/// check (and anything else asking "is a workout already open") must look here rather than at a
/// specific date's workouts. An open workout is never dated in the future relative to when it was
/// last touched, so `updated_at_ms DESC` is enough to break ties if more than one is ever found.
pub async fn get_open(conn: &mut SqliteConnection) -> Result<Option<Workout>> {
    let row: Option<WorkoutRow> = sqlx::query_as(
        "SELECT id, local_date, title, note, started_at_ms, completed_at_ms, status, source, \
         logged_by_watch, source_routine_id, source_routine_name, hc_source_app, hc_record_id, \
         hc_imported_at_ms, hc_unmapped_metrics, hc_overlaps_workout_id FROM workouts \
         WHERE status IN ('draft', 'active') ORDER BY updated_at_ms DESC LIMIT 1",
    )
    .fetch_optional(conn)
    .await?;
    Ok(row.map(Workout::from))
}

/// The single source of truth for SPEC.md 8.1's single-active-workout guard — every path that
/// creates or reactivates an `active` workout (`create`, `reopen`, `Coordinator::duplicate_workout`,
/// `Coordinator::materialize_routine_section`) calls this rather than repeating the check, so a
/// future fifth path can't silently forget it. `action` names what's being attempted (e.g. "start
/// a new workout") so the message reads naturally at each call site. A database-level partial
/// unique index is the actual atomic enforcement (it closes the race this check alone can't — two
/// near-simultaneous calls could both pass it before either insert lands); this exists to give the
/// common, non-racing case a clean validation error instead of a raw constraint-violation message.
pub async fn ensure_no_open_workout(conn: &mut SqliteConnection, action: &str) -> Result<()> {
    if let Some(open) = get_open(conn).await? {
        return Err(Error::Validation(format!(
            "can't {action} while workout {} is already open",
            open.id
        )));
    }
    Ok(())
}

/// Creates a brand-new active, manually-sourced workout with no exercises yet — the
/// "Start workout" action's whole job, per SPEC.md 8.1's allowance to create a workout with
/// minimal ceremony rather than requiring a routine or a pre-picked exercise list.
pub async fn create(conn: &mut SqliteConnection, local_date: &str, title: &str) -> Result<Workout> {
    ensure_no_open_workout(conn, "start a new workout").await?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "INSERT INTO workouts (id, local_date, title, status, source, logged_by_watch, \
         started_at_ms, created_at_ms, updated_at_ms, revision) VALUES (?, ?, ?, 'active', \
         'manual', 0, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(local_date)
    .bind(title)
    .bind(now) // started_at_ms
    .bind(now) // created_at_ms
    .bind(now) // updated_at_ms
    .bind(revision)
    .execute(&mut *conn)
    .await?;
    get(conn, &id).await
}

pub async fn update_note(
    conn: &mut SqliteConnection,
    id: &str,
    note: Option<&str>,
) -> Result<Workout> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result =
        sqlx::query("UPDATE workouts SET note = ?, updated_at_ms = ?, revision = ? WHERE id = ?")
            .bind(note)
            .bind(now)
            .bind(revision)
            .bind(id)
            .execute(&mut *conn)
            .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "workout",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

async fn current_status(conn: &mut SqliteConnection, id: &str) -> Result<String> {
    sqlx::query_scalar("SELECT status FROM workouts WHERE id = ?")
        .bind(id)
        .fetch_optional(&mut *conn)
        .await?
        .ok_or_else(|| Error::NotFound {
            entity: "workout",
            id: id.to_string(),
        })
}

/// Marks a workout complete — requires it to currently be `draft`/`active` and to have at least
/// one completed set (SPEC.md 8.1's "mark a workout complete"; an empty workout can't be
/// completed, abandon or delete is the exit for that case instead).
pub async fn complete(conn: &mut SqliteConnection, id: &str) -> Result<Workout> {
    let status = current_status(conn, id).await?;
    if status != "draft" && status != "active" {
        return Err(Error::Validation(format!(
            "workout {id} can't be completed from status '{status}'"
        )));
    }
    let has_completed_set: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM sets WHERE workout_id = ? AND status = 'completed')",
    )
    .bind(id)
    .fetch_one(&mut *conn)
    .await?;
    if !has_completed_set {
        return Err(Error::Validation(
            "workout has no completed sets — abandon or delete it instead".to_string(),
        ));
    }

    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE workouts SET status = 'completed', completed_at_ms = ?, updated_at_ms = ?, \
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
            entity: "workout",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

/// Abandons a workout — requires it to currently be `draft`/`active`, but unlike `complete` never
/// requires a completed set: SPEC.md 8.1's lifecycle states "do not lock history," so abandoning a
/// workout with sets already logged must still be allowed and never discards them.
pub async fn abandon(conn: &mut SqliteConnection, id: &str) -> Result<Workout> {
    let status = current_status(conn, id).await?;
    if status != "draft" && status != "active" {
        return Err(Error::Validation(format!(
            "workout {id} can't be abandoned from status '{status}'"
        )));
    }

    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE workouts SET status = 'abandoned', completed_at_ms = ?, updated_at_ms = ?, \
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
            entity: "workout",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

/// Returns a completed or abandoned workout to active — requires it to currently be one of those
/// two terminal states, and clears `completed_at_ms` back to unset. Also requires no *other*
/// workout to already be open: SPEC.md 8.1's single-active-workout model is enforced nowhere else
/// today, but `reopen` is the one path that can otherwise put a second workout into `draft`/
/// `active` behind the user's back, and `get_open`'s `LIMIT 1` would then silently hide whichever
/// one it didn't return.
pub async fn reopen(conn: &mut SqliteConnection, id: &str) -> Result<Workout> {
    let status = current_status(conn, id).await?;
    if status != "completed" && status != "abandoned" {
        return Err(Error::Validation(format!(
            "workout {id} can't be reopened from status '{status}'"
        )));
    }
    ensure_no_open_workout(conn, "reopen this workout").await?;

    // started_at_ms resets to now too — otherwise a reopened workout's eventual duration is
    // measured from its original start, not from when it actually resumed being worked on.
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE workouts SET status = 'active', started_at_ms = ?, completed_at_ms = NULL, \
         updated_at_ms = ?, revision = ? WHERE id = ?",
    )
    .bind(now)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "workout",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    #[tokio::test]
    async fn gets_a_manual_workout() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "2026-09-09", "Push A").await.unwrap();
        let workout = get(&mut conn, &created.id).await.unwrap();
        assert_eq!(workout.title, "Push A");
        assert_eq!(workout.date, "2026-09-09");
        assert_eq!(workout.status, "active");
        assert_eq!(workout.source, "manual");
        assert!(workout.health_connect.is_none());
    }

    /// `create()` never sets Health Connect provenance — that's an import-only path with no
    /// command surface yet, so this inserts the row directly to exercise `get`'s HC projection.
    async fn insert_health_connect_workout(
        conn: &mut SqliteConnection,
        id: &str,
        overlaps_with: Option<&str>,
    ) {
        sqlx::query(
            "INSERT INTO workouts (id, local_date, title, status, source, logged_by_watch, \
             hc_source_app, hc_record_id, hc_imported_at_ms, hc_unmapped_metrics, \
             hc_overlaps_workout_id, created_at_ms, updated_at_ms, revision) \
             VALUES (?, '2026-08-27', 'Morning Run', 'completed', 'health-connect-import', 0, \
             'Google Fit', 'gfit-run-2026-08-27', 0, '[\"Average heart rate: 142 bpm\"]', ?, 0, 0, 1)",
        )
        .bind(id)
        .bind(overlaps_with)
        .execute(&mut *conn)
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn gets_a_health_connect_imported_workout_with_full_provenance() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        // hc_overlaps_workout_id has a real FK to workouts(id) — the overlapped workout must
        // actually exist.
        let strength = create(&mut conn, "2026-08-27", "Push A").await.unwrap();
        insert_health_connect_workout(&mut conn, "workout-hc", Some(&strength.id)).await;
        let workout = get(&mut conn, "workout-hc").await.unwrap();
        let hc = workout
            .health_connect
            .expect("inserted with health connect provenance");
        assert_eq!(hc.source_app, "Google Fit");
        assert_eq!(hc.record_id, "gfit-run-2026-08-27");
        assert_eq!(
            hc.unmapped_metrics,
            Some(vec!["Average heart rate: 142 bpm".to_string()])
        );
        assert_eq!(hc.overlaps_with_workout_id, Some(strength.id));
        // No start/end timestamps reported by the source app.
        assert_eq!(workout.started_at, None);
    }

    #[tokio::test]
    async fn drops_health_connect_provenance_when_the_row_is_only_partially_populated() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "2026-09-09", "Push A").await.unwrap();
        // hc_source_app set without a matching record_id/imported_at — shouldn't happen via any
        // real write path, but a corrupt row here must not surface a half-populated badge.
        sqlx::query("UPDATE workouts SET hc_source_app = 'Google Fit' WHERE id = ?")
            .bind(&created.id)
            .execute(&mut *conn)
            .await
            .unwrap();
        let workout = get(&mut conn, &created.id).await.unwrap();
        assert_eq!(workout.health_connect, None);
    }

    #[tokio::test]
    async fn rejects_an_unknown_workout_id() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = get(&mut conn, "no-such-workout").await.unwrap_err();
        assert!(matches!(
            err,
            Error::NotFound {
                entity: "workout",
                ..
            }
        ));
    }

    #[tokio::test]
    async fn get_open_returns_none_when_nothing_is_open() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        assert_eq!(get_open(&mut conn).await.unwrap(), None);
    }

    #[tokio::test]
    async fn get_open_finds_an_active_workout_regardless_of_its_date() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        // Dated well in the past — SPEC.md 8.1's single-active-workout model is global, not
        // scoped to today, so this must still be found (this is exactly what reopening an old
        // completed/abandoned workout produces).
        let created = create(&mut conn, "2020-01-01", "Old workout")
            .await
            .unwrap();
        let found = get_open(&mut conn).await.unwrap();
        assert_eq!(found.map(|w| w.id), Some(created.id));
    }

    #[tokio::test]
    async fn get_open_ignores_completed_and_abandoned_workouts() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "2026-09-16", "Push A").await.unwrap();
        abandon(&mut conn, &created.id).await.unwrap();
        assert_eq!(get_open(&mut conn).await.unwrap(), None);
    }

    #[tokio::test]
    async fn lists_workouts_within_an_inclusive_date_range_ordered_by_date() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let inside_start = create(&mut conn, "2026-08-07", "Superset A").await.unwrap();
        abandon(&mut conn, &inside_start.id).await.unwrap();
        let inside_end = create(&mut conn, "2026-08-29", "Push A").await.unwrap();
        abandon(&mut conn, &inside_end.id).await.unwrap();
        let before = create(&mut conn, "2026-07-31", "Before the range")
            .await
            .unwrap();
        abandon(&mut conn, &before.id).await.unwrap();
        create(&mut conn, "2026-09-01", "After the range")
            .await
            .unwrap();

        let workouts = list_in_range(&mut conn, "2026-08-01", "2026-08-31")
            .await
            .unwrap();
        assert_eq!(
            workouts.iter().map(|w| w.id.as_str()).collect::<Vec<_>>(),
            vec![inside_start.id.as_str(), inside_end.id.as_str()]
        );
    }

    #[tokio::test]
    async fn updates_a_workout_note() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "2026-09-04", "Push A").await.unwrap();
        let updated = update_note(&mut conn, &created.id, Some("Felt strong today"))
            .await
            .unwrap();
        assert_eq!(updated.note.as_deref(), Some("Felt strong today"));

        let cleared = update_note(&mut conn, &created.id, None).await.unwrap();
        assert_eq!(cleared.note, None);
    }

    #[tokio::test]
    async fn rejects_updating_the_note_of_an_unknown_workout() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = update_note(&mut conn, "no-such-workout", Some("x"))
            .await
            .unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }

    #[tokio::test]
    async fn creates_a_fresh_in_progress_manual_workout_with_no_exercises() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "2026-09-10", "Today's workout")
            .await
            .unwrap();
        assert_eq!(created.date, "2026-09-10");
        assert_eq!(created.title, "Today's workout");
        assert_eq!(created.status, "active");
        assert_eq!(created.source, "manual");
        assert!(!created.logged_by_watch);
        assert!(created.health_connect.is_none());
        assert!(created.started_at.is_some());
        // A freshly created workout is genuinely new, not a stale seeded fixture reused.
        let reloaded = get(&mut conn, &created.id).await.unwrap();
        assert_eq!(reloaded, created);
    }

    async fn log_a_completed_set(conn: &mut SqliteConnection, workout_id: &str) {
        let workout_exercise = crate::domain::workouts::workout_exercises::add(
            conn,
            workout_id,
            "ex-barbell-back-squat",
        )
        .await
        .unwrap();
        crate::domain::sets::repo::log_new(
            conn,
            &workout_exercise.id,
            &crate::domain::sets::models::SetValues {
                weight_kg: Some(60.0),
                reps: Some(5),
                distance_km: None,
                duration_sec: None,
            },
        )
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn completes_a_workout_with_a_completed_set() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "2026-09-16", "Push A").await.unwrap();
        log_a_completed_set(&mut conn, &created.id).await;

        let completed = complete(&mut conn, &created.id).await.unwrap();
        assert_eq!(completed.status, "completed");
        assert!(completed.completed_at.is_some());
    }

    #[tokio::test]
    async fn rejects_completing_a_workout_with_no_completed_sets() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "2026-09-16", "Push A").await.unwrap();
        let err = complete(&mut conn, &created.id).await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn rejects_completing_an_already_completed_workout() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "2026-09-16", "Push A").await.unwrap();
        log_a_completed_set(&mut conn, &created.id).await;
        complete(&mut conn, &created.id).await.unwrap();

        let err = complete(&mut conn, &created.id).await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn abandons_a_workout_with_no_sets() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "2026-09-16", "Push A").await.unwrap();
        let abandoned = abandon(&mut conn, &created.id).await.unwrap();
        assert_eq!(abandoned.status, "abandoned");
        assert!(abandoned.completed_at.is_some());
    }

    #[tokio::test]
    async fn abandons_a_workout_with_completed_sets_and_keeps_them() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "2026-09-16", "Push A").await.unwrap();
        log_a_completed_set(&mut conn, &created.id).await;

        let abandoned = abandon(&mut conn, &created.id).await.unwrap();
        assert_eq!(abandoned.status, "abandoned");

        let (set_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sets WHERE workout_id = ?")
            .bind(&created.id)
            .fetch_one(&mut *conn)
            .await
            .unwrap();
        assert_eq!(set_count, 1, "abandoning must never discard logged sets");
    }

    #[tokio::test]
    async fn rejects_abandoning_a_terminal_workout() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "2026-09-16", "Push A").await.unwrap();
        abandon(&mut conn, &created.id).await.unwrap();

        let err = abandon(&mut conn, &created.id).await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn reopens_a_completed_workout_and_clears_completed_at() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "2026-09-16", "Push A").await.unwrap();
        log_a_completed_set(&mut conn, &created.id).await;
        complete(&mut conn, &created.id).await.unwrap();

        let reopened = reopen(&mut conn, &created.id).await.unwrap();
        assert_eq!(reopened.status, "active");
        assert_eq!(reopened.completed_at, None);
    }

    /// A reopened workout's `started_at` must reset, not keep pointing at when it was originally
    /// started — otherwise re-completing it after being reopened weeks or months later computes
    /// its duration from the original start instead of from when it actually resumed.
    #[tokio::test]
    async fn reopening_resets_started_at() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "2026-06-01", "Push A").await.unwrap();
        log_a_completed_set(&mut conn, &created.id).await;
        complete(&mut conn, &created.id).await.unwrap();
        sqlx::query("UPDATE workouts SET started_at_ms = 0 WHERE id = ?")
            .bind(&created.id)
            .execute(&mut *conn)
            .await
            .unwrap();

        let before_reopen = chrono::Utc::now().timestamp_millis();
        let reopened = reopen(&mut conn, &created.id).await.unwrap();

        let started_at_ms = crate::domain::units::iso_to_ms(&reopened.started_at.unwrap()).unwrap();
        assert!(
            started_at_ms >= before_reopen,
            "started_at must reset to now on reopen, not stay at its original value"
        );
    }

    #[tokio::test]
    async fn reopens_an_abandoned_workout() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "2026-09-16", "Push A").await.unwrap();
        abandon(&mut conn, &created.id).await.unwrap();

        let reopened = reopen(&mut conn, &created.id).await.unwrap();
        assert_eq!(reopened.status, "active");
    }

    #[tokio::test]
    async fn rejects_reopening_an_active_workout() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "2026-09-16", "Push A").await.unwrap();
        let err = reopen(&mut conn, &created.id).await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    /// `reopen` must check more than the *target* workout's own status — a different workout
    /// could already be draft/active. Reopening a terminal workout while another is open would
    /// otherwise put two workouts into `active` at once, silently violating SPEC.md 8.1's
    /// single-active-workout model and leaving `get_open`'s `LIMIT 1` hiding whichever one it
    /// didn't return.
    #[tokio::test]
    async fn rejects_reopening_a_workout_while_another_is_already_open() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let terminal = create(&mut conn, "2026-09-01", "Push A").await.unwrap();
        abandon(&mut conn, &terminal.id).await.unwrap();
        let currently_open = create(&mut conn, "2026-09-16", "Pull A").await.unwrap();

        let err = reopen(&mut conn, &terminal.id).await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));

        // The already-open workout must be untouched, and the terminal one must stay terminal.
        let still_open = get(&mut conn, &currently_open.id).await.unwrap();
        assert_eq!(still_open.status, "active");
        let still_terminal = get(&mut conn, &terminal.id).await.unwrap();
        assert_eq!(still_terminal.status, "abandoned");
    }

    /// `create` is "Start workout"'s whole job, so it must not be possible to end up with two
    /// active workouts by simply starting a second one while the first is still open.
    #[tokio::test]
    async fn rejects_starting_a_new_workout_while_another_is_already_open() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let open = create(&mut conn, "2026-09-01", "Push A").await.unwrap();

        let err = create(&mut conn, "2026-09-16", "Pull A").await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));

        let still_open = get(&mut conn, &open.id).await.unwrap();
        assert_eq!(still_open.status, "active");
    }

    #[tokio::test]
    async fn rejects_mutating_an_unknown_workout_id() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        assert!(matches!(
            complete(&mut conn, "no-such-workout").await.unwrap_err(),
            Error::NotFound { .. }
        ));
        assert!(matches!(
            abandon(&mut conn, "no-such-workout").await.unwrap_err(),
            Error::NotFound { .. }
        ));
        assert!(matches!(
            reopen(&mut conn, "no-such-workout").await.unwrap_err(),
            Error::NotFound { .. }
        ));
    }
}
