// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::Exercise;
use crate::domain::error::{Error, Result};
use crate::domain::units::{g_to_kg, m_to_km};

#[derive(FromRow)]
struct ExerciseRow {
    id: String,
    name: String,
    category_id: String,
    metric_profile: String,
    weight_increment_g: Option<i64>,
    reps_increment: Option<i32>,
    distance_increment_m: Option<i64>,
    duration_increment_s: Option<i32>,
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
            weight_increment_kg: row.weight_increment_g.map(g_to_kg),
            reps_increment: row.reps_increment,
            distance_increment_km: row.distance_increment_m.map(m_to_km),
            duration_increment_sec: row.duration_increment_s,
            archived: row.archived != 0,
            favourite: row.favourite != 0,
        }
    }
}

const SELECT_BY_ID: &str = "SELECT id, name, category_id, metric_profile, weight_increment_g, \
     reps_increment, distance_increment_m, duration_increment_s, archived, favourite \
     FROM exercises WHERE id = ?";

const SELECT_ALL: &str = "SELECT id, name, category_id, metric_profile, weight_increment_g, \
     reps_increment, distance_increment_m, duration_increment_s, archived, favourite \
     FROM exercises ORDER BY name";

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
        assert_eq!(exercises.len(), 6);
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
}
