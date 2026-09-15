// Row mapping and persistence for exercise goals
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::{ExerciseGoal, ExerciseGoalValues};
use crate::domain::error::{Error, Result};
use crate::domain::units::{g_to_kg, kg_to_g, km_to_m, m_to_km, ms_to_iso};

#[derive(FromRow)]
struct GoalRow {
    id: String,
    exercise_id: String,
    title: String,
    target_weight_g: Option<i64>,
    target_reps: Option<i32>,
    target_distance_m: Option<i64>,
    target_duration_s: Option<i32>,
    start_date: Option<String>,
    target_date: Option<String>,
    achieved_at_ms: Option<i64>,
    archived: i64,
}

impl From<GoalRow> for ExerciseGoal {
    fn from(row: GoalRow) -> Self {
        ExerciseGoal {
            id: row.id,
            exercise_id: row.exercise_id,
            title: row.title,
            target_weight_kg: row.target_weight_g.map(g_to_kg),
            target_reps: row.target_reps,
            target_distance_km: row.target_distance_m.map(m_to_km),
            target_duration_sec: row.target_duration_s,
            start_date: row.start_date,
            target_date: row.target_date,
            achieved_at: row.achieved_at_ms.map(ms_to_iso),
            archived: row.archived != 0,
        }
    }
}

const SELECT_BY_ID: &str = "SELECT id, exercise_id, title, target_weight_g, target_reps, \
     target_distance_m, target_duration_s, start_date, target_date, achieved_at_ms, archived \
     FROM exercise_goals WHERE id = ?";

const SELECT_BY_EXERCISE: &str = "SELECT id, exercise_id, title, target_weight_g, target_reps, \
     target_distance_m, target_duration_s, start_date, target_date, achieved_at_ms, archived \
     FROM exercise_goals WHERE exercise_id = ? ORDER BY created_at_ms, id";

pub async fn get(conn: &mut SqliteConnection, id: &str) -> Result<ExerciseGoal> {
    let row: GoalRow = sqlx::query_as(SELECT_BY_ID)
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| Error::NotFound {
            entity: "exercise goal",
            id: id.to_string(),
        })?;
    Ok(row.into())
}

/// Every goal for this exercise, archived or not, oldest first — the exercise detail Goals tab (P-48) is responsible for filtering.
pub async fn list_by_exercise(
    conn: &mut SqliteConnection,
    exercise_id: &str,
) -> Result<Vec<ExerciseGoal>> {
    let rows: Vec<GoalRow> = sqlx::query_as(SELECT_BY_EXERCISE)
        .bind(exercise_id)
        .fetch_all(conn)
        .await?;
    Ok(rows.into_iter().map(ExerciseGoal::from).collect())
}

pub async fn create(
    conn: &mut SqliteConnection,
    values: &ExerciseGoalValues,
) -> Result<ExerciseGoal> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "INSERT INTO exercise_goals (id, exercise_id, title, target_weight_g, target_reps, \
         target_distance_m, target_duration_s, start_date, target_date, archived, \
         created_at_ms, updated_at_ms, revision) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&values.exercise_id)
    .bind(&values.title)
    .bind(values.target_weight_kg.map(kg_to_g))
    .bind(values.target_reps)
    .bind(values.target_distance_km.map(km_to_m))
    .bind(values.target_duration_sec)
    .bind(&values.start_date)
    .bind(&values.target_date)
    .bind(now)
    .bind(now)
    .bind(revision)
    .execute(&mut *conn)
    .await?;
    get(conn, &id).await
}

/// Deliberately never writes `values.exercise_id` — unlike `create`, which uses it to attach the new goal to an exercise, `update` edits an existing goal in place and must not let a caller silently reassign it to a different exercise (whose metric profile could be entirely incompatible with the goal's already-stored target fields).
pub async fn update(
    conn: &mut SqliteConnection,
    id: &str,
    values: &ExerciseGoalValues,
) -> Result<ExerciseGoal> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE exercise_goals SET title = ?, target_weight_g = ?, \
         target_reps = ?, target_distance_m = ?, target_duration_s = ?, start_date = ?, \
         target_date = ?, updated_at_ms = ?, revision = ? WHERE id = ?",
    )
    .bind(&values.title)
    .bind(values.target_weight_kg.map(kg_to_g))
    .bind(values.target_reps)
    .bind(values.target_distance_km.map(km_to_m))
    .bind(values.target_duration_sec)
    .bind(&values.start_date)
    .bind(&values.target_date)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "exercise goal",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

/// Sets or clears `achieved_at_ms` — a manual toggle, not inferred from history (see the doc comment on `ExerciseGoal::achieved_at`).
pub async fn set_achieved(
    conn: &mut SqliteConnection,
    id: &str,
    achieved: bool,
) -> Result<ExerciseGoal> {
    let now = chrono::Utc::now().timestamp_millis();
    let achieved_at_ms = achieved.then_some(now);
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE exercise_goals SET achieved_at_ms = ?, updated_at_ms = ?, revision = ? \
         WHERE id = ?",
    )
    .bind(achieved_at_ms)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "exercise goal",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

pub async fn set_archived(
    conn: &mut SqliteConnection,
    id: &str,
    archived: bool,
) -> Result<ExerciseGoal> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE exercise_goals SET archived = ?, updated_at_ms = ?, revision = ? WHERE id = ?",
    )
    .bind(archived)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "exercise goal",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

/// A no-op if the goal doesn't exist, otherwise records a tombstone.
pub async fn delete(conn: &mut SqliteConnection, id: &str) -> Result<()> {
    let result = sqlx::query("DELETE FROM exercise_goals WHERE id = ?")
        .bind(id)
        .execute(&mut *conn)
        .await?;
    if result.rows_affected() > 0 {
        let revision = crate::db::next_revision(conn).await?;
        let now = chrono::Utc::now().timestamp_millis();
        crate::db::write_tombstone(conn, "exercise_goal", id, revision, now).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    fn sample_values() -> ExerciseGoalValues {
        ExerciseGoalValues {
            exercise_id: "ex-bench-press".to_string(),
            title: "Bench 100kg".to_string(),
            target_weight_kg: Some(100.0),
            target_reps: Some(1),
            target_distance_km: None,
            target_duration_sec: None,
            start_date: Some("2026-01-01".to_string()),
            target_date: Some("2026-12-31".to_string()),
        }
    }

    #[tokio::test]
    async fn creates_a_goal_with_every_field_round_tripped() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, &sample_values()).await.unwrap();
        assert_eq!(created.title, "Bench 100kg");
        assert_eq!(created.target_weight_kg, Some(100.0));
        assert_eq!(created.target_reps, Some(1));
        assert_eq!(created.start_date.as_deref(), Some("2026-01-01"));
        assert_eq!(created.target_date.as_deref(), Some("2026-12-31"));
        assert_eq!(created.achieved_at, None);
        assert!(!created.archived);
    }

    #[tokio::test]
    async fn rejects_getting_an_unknown_goal() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = get(&mut conn, "no-such-goal").await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }

    #[tokio::test]
    async fn lists_goals_for_an_exercise_only() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        create(&mut conn, &sample_values()).await.unwrap();
        let mut other = sample_values();
        other.exercise_id = "ex-running".to_string();
        create(&mut conn, &other).await.unwrap();

        let goals = list_by_exercise(&mut conn, "ex-bench-press").await.unwrap();
        assert_eq!(goals.len(), 1);
        assert_eq!(goals[0].exercise_id, "ex-bench-press");
    }

    #[tokio::test]
    async fn updates_a_goal_in_place() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, &sample_values()).await.unwrap();
        let mut values = sample_values();
        values.title = "Bench 110kg".to_string();
        values.target_weight_kg = Some(110.0);
        let updated = update(&mut conn, &created.id, &values).await.unwrap();
        assert_eq!(updated.title, "Bench 110kg");
        assert_eq!(updated.target_weight_kg, Some(110.0));
    }

    #[tokio::test]
    async fn update_never_reassigns_the_goal_to_a_different_exercise() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, &sample_values()).await.unwrap();
        let mut values = sample_values();
        values.exercise_id = "ex-running".to_string();
        let updated = update(&mut conn, &created.id, &values).await.unwrap();
        assert_eq!(updated.exercise_id, "ex-bench-press");
    }

    #[tokio::test]
    async fn round_trips_distance_and_duration_target_fields() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let mut values = sample_values();
        values.exercise_id = "ex-running".to_string();
        values.target_weight_kg = None;
        values.target_reps = None;
        values.target_distance_km = Some(5.0);
        values.target_duration_sec = Some(1800);
        let created = create(&mut conn, &values).await.unwrap();
        assert_eq!(created.target_distance_km, Some(5.0));
        assert_eq!(created.target_duration_sec, Some(1800));

        let mut updated_values = values.clone();
        updated_values.target_distance_km = Some(10.0);
        updated_values.target_duration_sec = Some(3600);
        let updated = update(&mut conn, &created.id, &updated_values)
            .await
            .unwrap();
        assert_eq!(updated.target_distance_km, Some(10.0));
        assert_eq!(updated.target_duration_sec, Some(3600));

        let fetched = get(&mut conn, &created.id).await.unwrap();
        assert_eq!(fetched.target_distance_km, Some(10.0));
        assert_eq!(fetched.target_duration_sec, Some(3600));
    }

    #[tokio::test]
    async fn rejects_updating_an_unknown_goal() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = update(&mut conn, "no-such-goal", &sample_values())
            .await
            .unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }

    #[tokio::test]
    async fn sets_and_clears_achieved() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, &sample_values()).await.unwrap();
        let achieved = set_achieved(&mut conn, &created.id, true).await.unwrap();
        assert!(achieved.achieved_at.is_some());
        let cleared = set_achieved(&mut conn, &created.id, false).await.unwrap();
        assert_eq!(cleared.achieved_at, None);
    }

    #[tokio::test]
    async fn archives_and_unarchives_a_goal() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, &sample_values()).await.unwrap();
        let archived = set_archived(&mut conn, &created.id, true).await.unwrap();
        assert!(archived.archived);
        let restored = set_archived(&mut conn, &created.id, false).await.unwrap();
        assert!(!restored.archived);
    }

    #[tokio::test]
    async fn deletes_a_goal_and_records_a_tombstone() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, &sample_values()).await.unwrap();
        delete(&mut conn, &created.id).await.unwrap();
        let err = get(&mut conn, &created.id).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tombstones WHERE entity_type = 'exercise_goal' AND entity_id = ?",
        )
        .bind(&created.id)
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn deleting_an_unknown_goal_is_a_silent_no_op() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        delete(&mut conn, "no-such-goal").await.unwrap();
    }
}
