// Row mapping and persistence for exercises.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::{is_known_graph_metric, Exercise, ExerciseValues};
use crate::domain::error::{Error, Result};
use crate::domain::units::{g_to_kg, kg_to_g, km_to_m, m_to_km};

#[derive(FromRow)]
struct ExerciseRow {
    id: String,
    name: String,
    category_id: String,
    metric_profile: String,
    notes: Option<String>,
    url: Option<String>,
    weight_increment_g: Option<i64>,
    reps_increment: Option<i32>,
    distance_increment_m: Option<i64>,
    duration_increment_s: Option<i32>,
    default_rest_ms: Option<i64>,
    graph_defaults: Option<String>,
    archived: i64,
    favourite: i64,
}

impl From<ExerciseRow> for Exercise {
    fn from(row: ExerciseRow) -> Self {
        Exercise {
            id: row.id,
            name: row.name,
            category: row.category_id,
            metric_profile: row.metric_profile,
            note: row.notes,
            url: row.url,
            weight_increment_kg: row.weight_increment_g.map(g_to_kg),
            reps_increment: row.reps_increment,
            distance_increment_km: row.distance_increment_m.map(m_to_km),
            duration_increment_sec: row.duration_increment_s,
            rest_default_ms: row.default_rest_ms,
            graph_default_metric: row.graph_defaults,
            archived: row.archived != 0,
            favourite: row.favourite != 0,
        }
    }
}

const SELECT_BY_ID: &str = "SELECT id, name, category_id, metric_profile, notes, url, \
     weight_increment_g, reps_increment, distance_increment_m, duration_increment_s, \
     default_rest_ms, graph_defaults, archived, favourite FROM exercises WHERE id = ?";

const SELECT_ALL: &str = "SELECT id, name, category_id, metric_profile, notes, url, \
     weight_increment_g, reps_increment, distance_increment_m, duration_increment_s, \
     default_rest_ms, graph_defaults, archived, favourite FROM exercises ORDER BY name";

pub async fn get(conn: &mut SqliteConnection, id: &str) -> Result<Exercise> {
    let row: ExerciseRow = sqlx::query_as(SELECT_BY_ID)
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| Error::NotFound {
            entity: "exercise",
            id: id.to_string(),
        })?;
    Ok(row.into())
}

pub async fn list(conn: &mut SqliteConnection) -> Result<Vec<Exercise>> {
    let rows: Vec<ExerciseRow> = sqlx::query_as(SELECT_ALL).fetch_all(conn).await?;
    Ok(rows.into_iter().map(Exercise::from).collect())
}

pub async fn update_favourite(
    conn: &mut SqliteConnection,
    id: &str,
    favourite: bool,
) -> Result<Exercise> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE exercises SET favourite = ?, updated_at_ms = ?, revision = ? WHERE id = ?",
    )
    .bind(favourite)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "exercise",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

fn is_known_metric_profile(value: &str) -> bool {
    matches!(value, "weight-reps" | "distance-duration")
}

/// Shared validation for `create` and `update` — a caller-supplied `metric_profile` or `graph_default_metric` outside the known set would silently persist a value nothing downstream (the logging flow's stepper cluster, the graph tab's metric selector) knows how to interpret.
fn validate_values(values: &ExerciseValues) -> Result<()> {
    if !is_known_metric_profile(&values.metric_profile) {
        return Err(Error::Validation(format!(
            "unknown metric profile {:?}",
            values.metric_profile
        )));
    }
    if let Some(metric) = &values.graph_default_metric {
        if !is_known_graph_metric(metric) {
            return Err(Error::Validation(format!(
                "unknown graph default metric {metric:?}"
            )));
        }
    }
    Ok(())
}

/// Rejects a name that collides case-insensitively with another exercise (`excluding_id` lets `update` compare against every *other* exercise without tripping on its own unchanged name) — SCREENS.md's P-34 "duplicate name" state.
async fn reject_duplicate_name(
    conn: &mut SqliteConnection,
    name: &str,
    excluding_id: Option<&str>,
) -> Result<()> {
    let (count,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM exercises WHERE lower(name) = lower(?) AND id IS NOT ?",
    )
    .bind(name)
    .bind(excluding_id.unwrap_or(""))
    .fetch_one(&mut *conn)
    .await?;
    if count > 0 {
        return Err(Error::Validation(format!(
            "an exercise named {name:?} already exists"
        )));
    }
    Ok(())
}

pub async fn create(conn: &mut SqliteConnection, values: &ExerciseValues) -> Result<Exercise> {
    validate_values(values)?;
    reject_duplicate_name(conn, &values.name, None).await?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "INSERT INTO exercises (id, name, category_id, metric_profile, notes, url, \
         weight_increment_g, reps_increment, distance_increment_m, duration_increment_s, \
         default_rest_ms, graph_defaults, favourite, archived, created_at_ms, updated_at_ms, \
         revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&values.name)
    .bind(&values.category)
    .bind(&values.metric_profile)
    .bind(&values.note)
    .bind(&values.url)
    .bind(values.weight_increment_kg.map(kg_to_g))
    .bind(values.reps_increment)
    .bind(values.distance_increment_km.map(km_to_m))
    .bind(values.duration_increment_sec)
    .bind(values.rest_default_ms)
    .bind(&values.graph_default_metric)
    .bind(now)
    .bind(now)
    .bind(revision)
    .execute(&mut *conn)
    .await?;
    get(conn, &id).await
}

pub async fn update(
    conn: &mut SqliteConnection,
    id: &str,
    values: &ExerciseValues,
) -> Result<Exercise> {
    validate_values(values)?;
    reject_duplicate_name(conn, &values.name, Some(id)).await?;
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE exercises SET name = ?, category_id = ?, metric_profile = ?, notes = ?, url = ?, \
         weight_increment_g = ?, reps_increment = ?, distance_increment_m = ?, \
         duration_increment_s = ?, default_rest_ms = ?, graph_defaults = ?, updated_at_ms = ?, \
         revision = ? WHERE id = ?",
    )
    .bind(&values.name)
    .bind(&values.category)
    .bind(&values.metric_profile)
    .bind(&values.note)
    .bind(&values.url)
    .bind(values.weight_increment_kg.map(kg_to_g))
    .bind(values.reps_increment)
    .bind(values.distance_increment_km.map(km_to_m))
    .bind(values.duration_increment_sec)
    .bind(values.rest_default_ms)
    .bind(&values.graph_default_metric)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "exercise",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

pub async fn set_archived(
    conn: &mut SqliteConnection,
    id: &str,
    archived: bool,
) -> Result<Exercise> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE exercises SET archived = ?, updated_at_ms = ?, revision = ? WHERE id = ?",
    )
    .bind(archived)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "exercise",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

/// Rejects deleting an exercise any workout, routine, or goal still references, rather than letting the database's own foreign-key constraint surface as an opaque `Db` error — matching `categories::repo::delete`'s own reasoning. Archiving (see `set_archived`) has no such guard, since SPEC.md 10.2 wants a referenced exercise archived, not deleted, to keep its history intelligible.
pub async fn delete(conn: &mut SqliteConnection, id: &str) -> Result<()> {
    let (workout_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM workout_exercises WHERE exercise_id = ?")
            .bind(id)
            .fetch_one(&mut *conn)
            .await?;
    let (routine_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM routine_exercises WHERE exercise_id = ?")
            .bind(id)
            .fetch_one(&mut *conn)
            .await?;
    let (goal_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM exercise_goals WHERE exercise_id = ?")
            .bind(id)
            .fetch_one(&mut *conn)
            .await?;
    let reference_count = workout_count + routine_count + goal_count;
    if reference_count > 0 {
        return Err(Error::Validation(format!(
            "exercise {id:?} is still referenced by {reference_count} record(s) — archive it instead"
        )));
    }
    let result = sqlx::query("DELETE FROM exercises WHERE id = ?")
        .bind(id)
        .execute(&mut *conn)
        .await?;
    if result.rows_affected() > 0 {
        let revision = crate::db::next_revision(conn).await?;
        let now = chrono::Utc::now().timestamp_millis();
        crate::db::write_tombstone(conn, "exercise", id, revision, now).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    #[tokio::test]
    async fn gets_a_seeded_exercise_with_units_converted() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let exercise = get(&mut conn, "ex-bench-press").await.unwrap();
        assert_eq!(exercise.name, "Bench Press");
        assert_eq!(exercise.category, "chest");
        assert_eq!(exercise.metric_profile, "weight-reps");
        assert_eq!(exercise.weight_increment_kg, Some(2.5));
    }

    #[tokio::test]
    async fn distance_duration_exercise_reports_the_right_increments() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let exercise = get(&mut conn, "ex-running").await.unwrap();
        assert_eq!(exercise.weight_increment_kg, None);
        assert_eq!(exercise.distance_increment_km, Some(0.1));
        assert_eq!(exercise.duration_increment_sec, Some(10));
    }

    #[tokio::test]
    async fn rejects_an_unknown_exercise_id() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = get(&mut conn, "no-such-exercise").await.unwrap_err();
        assert!(matches!(
            err,
            Error::NotFound {
                entity: "exercise",
                ..
            }
        ));
    }

    #[tokio::test]
    async fn lists_every_seeded_exercise() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let exercises = list(&mut conn).await.unwrap();
        // 6 from the demo-scenario seed (0002) + 74 from the starter library (0003).
        assert_eq!(exercises.len(), 80);
    }

    #[tokio::test]
    async fn toggles_favourite_and_persists_it() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let updated = update_favourite(&mut conn, "ex-bench-press", true)
            .await
            .unwrap();
        assert!(updated.favourite);
        let reloaded = get(&mut conn, "ex-bench-press").await.unwrap();
        assert!(reloaded.favourite);
    }

    #[tokio::test]
    async fn rejects_toggling_favourite_on_an_unknown_exercise() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = update_favourite(&mut conn, "no-such-exercise", true)
            .await
            .unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }

    fn sample_values() -> ExerciseValues {
        ExerciseValues {
            name: "Cable Fly Variant".to_string(),
            category: "chest".to_string(),
            metric_profile: "weight-reps".to_string(),
            note: Some("Squeeze at the top".to_string()),
            url: Some("https://example.com".to_string()),
            weight_increment_kg: Some(2.5),
            reps_increment: Some(1),
            distance_increment_km: None,
            duration_increment_sec: None,
            rest_default_ms: Some(90_000),
            graph_default_metric: Some("estimated-1rm".to_string()),
        }
    }

    #[tokio::test]
    async fn creates_an_exercise_with_every_field_round_tripped() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, &sample_values()).await.unwrap();
        assert_eq!(created.name, "Cable Fly Variant");
        assert_eq!(created.note.as_deref(), Some("Squeeze at the top"));
        assert_eq!(created.url.as_deref(), Some("https://example.com"));
        assert_eq!(created.rest_default_ms, Some(90_000));
        assert_eq!(
            created.graph_default_metric.as_deref(),
            Some("estimated-1rm")
        );
        assert!(!created.archived);
        assert!(!created.favourite);
    }

    #[tokio::test]
    async fn rejects_creating_an_exercise_with_an_unknown_metric_profile() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let mut values = sample_values();
        values.metric_profile = "time-under-tension".to_string();
        let err = create(&mut conn, &values).await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn rejects_creating_an_exercise_with_an_unknown_graph_default_metric() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let mut values = sample_values();
        values.graph_default_metric = Some("one-rep-max".to_string());
        let err = create(&mut conn, &values).await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn rejects_creating_an_exercise_with_a_case_insensitive_duplicate_name() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let mut values = sample_values();
        values.name = "bench press".to_string();
        let err = create(&mut conn, &values).await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn updates_an_exercise_in_place() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, &sample_values()).await.unwrap();
        let mut values = sample_values();
        values.name = "Cable Fly Variant B".to_string();
        values.note = Some("Updated cue".to_string());
        let updated = update(&mut conn, &created.id, &values).await.unwrap();
        assert_eq!(updated.name, "Cable Fly Variant B");
        assert_eq!(updated.note.as_deref(), Some("Updated cue"));
    }

    #[tokio::test]
    async fn updating_an_exercise_to_keep_its_own_name_is_not_a_duplicate() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, &sample_values()).await.unwrap();
        let values = sample_values();
        update(&mut conn, &created.id, &values).await.unwrap();
    }

    #[tokio::test]
    async fn rejects_updating_an_unknown_exercise() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = update(&mut conn, "no-such-exercise", &sample_values())
            .await
            .unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }

    #[tokio::test]
    async fn archives_and_unarchives_an_exercise() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, &sample_values()).await.unwrap();
        let archived = set_archived(&mut conn, &created.id, true).await.unwrap();
        assert!(archived.archived);
        let restored = set_archived(&mut conn, &created.id, false).await.unwrap();
        assert!(!restored.archived);
    }

    #[tokio::test]
    async fn deletes_an_unreferenced_exercise_and_records_a_tombstone() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, &sample_values()).await.unwrap();
        delete(&mut conn, &created.id).await.unwrap();
        let err = get(&mut conn, &created.id).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tombstones WHERE entity_type = 'exercise' AND entity_id = ?",
        )
        .bind(&created.id)
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn refuses_to_delete_an_exercise_referenced_by_a_workout() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let workout = crate::domain::workouts::repo::create(&mut conn, "2026-09-09", "Push A")
            .await
            .unwrap();
        crate::domain::workouts::workout_exercises::add(&mut conn, &workout.id, "ex-bench-press")
            .await
            .unwrap();
        let err = delete(&mut conn, "ex-bench-press").await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }
}
