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
            health_connect,
        }
    }
}

pub async fn get(conn: &mut SqliteConnection, id: &str) -> Result<Workout> {
    let row: WorkoutRow = sqlx::query_as(
        "SELECT id, local_date, title, note, started_at_ms, completed_at_ms, status, source, \
         logged_by_watch, hc_source_app, hc_record_id, hc_imported_at_ms, hc_unmapped_metrics, \
         hc_overlaps_workout_id FROM workouts WHERE id = ?",
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
         logged_by_watch, hc_source_app, hc_record_id, hc_imported_at_ms, hc_unmapped_metrics, \
         hc_overlaps_workout_id FROM workouts WHERE local_date >= ? AND local_date <= ? \
         ORDER BY local_date, id",
    )
    .bind(start_date)
    .bind(end_date)
    .fetch_all(conn)
    .await?;
    Ok(rows.into_iter().map(Workout::from).collect())
}

/// Creates a brand-new in-progress, manually-sourced workout with no exercises yet — the
/// "Start workout" action's whole job, per SPEC.md 8.1's allowance to create a workout with
/// minimal ceremony rather than requiring a routine or a pre-picked exercise list.
pub async fn create(conn: &mut SqliteConnection, local_date: &str, title: &str) -> Result<Workout> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "INSERT INTO workouts (id, local_date, title, status, source, logged_by_watch, \
         created_at_ms, updated_at_ms, revision) VALUES (?, ?, ?, 'in-progress', 'manual', 0, \
         ?, ?, ?)",
    )
    .bind(&id)
    .bind(local_date)
    .bind(title)
    .bind(now)
    .bind(now)
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
        assert_eq!(workout.status, "in-progress");
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
    async fn lists_workouts_within_an_inclusive_date_range_ordered_by_date() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let inside_start = create(&mut conn, "2026-08-07", "Superset A").await.unwrap();
        let inside_end = create(&mut conn, "2026-08-29", "Push A").await.unwrap();
        create(&mut conn, "2026-07-31", "Before the range")
            .await
            .unwrap();
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
        assert_eq!(created.status, "in-progress");
        assert_eq!(created.source, "manual");
        assert!(!created.logged_by_watch);
        assert!(created.health_connect.is_none());
        // A freshly created workout is genuinely new, not a stale seeded fixture reused.
        let reloaded = get(&mut conn, &created.id).await.unwrap();
        assert_eq!(reloaded, created);
    }
}
