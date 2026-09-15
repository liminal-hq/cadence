// Row mapping and the bulk read for training analysis.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::AnalysisSetEntry;
use crate::domain::error::Result;
use crate::domain::units::{g_to_kg, m_to_km};

#[derive(FromRow)]
struct AnalysisRow {
    set_id: String,
    workout_id: String,
    exercise_id: String,
    exercise_name: String,
    category_id: String,
    category_name: String,
    metric_profile: String,
    date: String,
    sort_order: i32,
    weight_g: Option<i64>,
    reps: Option<i32>,
    distance_m: Option<i64>,
    duration_s: Option<i32>,
}

impl From<AnalysisRow> for AnalysisSetEntry {
    fn from(row: AnalysisRow) -> Self {
        AnalysisSetEntry {
            set_id: row.set_id,
            workout_id: row.workout_id,
            exercise_id: row.exercise_id,
            exercise_name: row.exercise_name,
            category_id: row.category_id,
            category_name: row.category_name,
            metric_profile: row.metric_profile,
            date: row.date,
            set_order: row.sort_order,
            weight_kg: row.weight_g.map(g_to_kg),
            reps: row.reps,
            distance_km: row.distance_m.map(m_to_km),
            duration_sec: row.duration_s,
        }
    }
}

const SELECT_IN_RANGE: &str = "SELECT s.id AS set_id, s.workout_id, s.exercise_id, \
     e.name AS exercise_name, e.category_id, c.name AS category_name, e.metric_profile, \
     w.local_date AS date, s.sort_order, s.weight_g, s.reps, s.distance_m, s.duration_s \
     FROM sets s \
     JOIN workouts w ON w.id = s.workout_id \
     JOIN exercises e ON e.id = s.exercise_id \
     JOIN categories c ON c.id = e.category_id \
     WHERE s.status = 'completed' AND w.local_date BETWEEN ? AND ? \
     ORDER BY w.local_date, s.sort_order";

/// Every completed set in `[start_date, end_date]` (inclusive), denormalized with exercise/category context — aggregation is entirely the caller's job (see history/computeStats.ts's own "pure function over fetched rows" precedent).
pub async fn list_completed_sets_in_range(
    conn: &mut SqliteConnection,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<AnalysisSetEntry>> {
    let rows: Vec<AnalysisRow> = sqlx::query_as(SELECT_IN_RANGE)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(conn)
        .await?;
    Ok(rows.into_iter().map(AnalysisSetEntry::from).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;
    use crate::domain::sets::models::SetValues;

    async fn log_completed_set(
        conn: &mut SqliteConnection,
        date: &str,
        exercise_id: &str,
        values: SetValues,
    ) {
        let workout = crate::domain::workouts::repo::create(conn, date, "Session")
            .await
            .unwrap();
        let we = crate::domain::workouts::workout_exercises::add(conn, &workout.id, exercise_id)
            .await
            .unwrap();
        crate::domain::sets::repo::log_new(conn, &we.id, &values)
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn lists_completed_sets_within_the_date_range_with_category_context() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        log_completed_set(
            &mut conn,
            "2026-06-01",
            "ex-bench-press",
            SetValues {
                weight_kg: Some(80.0),
                reps: Some(5),
                ..Default::default()
            },
        )
        .await;

        let entries = list_completed_sets_in_range(&mut conn, "2026-01-01", "2026-12-31")
            .await
            .unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].exercise_name, "Bench Press");
        assert_eq!(entries[0].category_name, "Chest");
        assert_eq!(entries[0].weight_kg, Some(80.0));
        assert_eq!(entries[0].reps, Some(5));
    }

    #[tokio::test]
    async fn exposes_each_sets_order_within_its_workout_exercise() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let workout = crate::domain::workouts::repo::create(&mut conn, "2026-06-01", "Session")
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
            weight_kg: Some(80.0),
            reps: Some(5),
            ..Default::default()
        };
        crate::domain::sets::repo::log_new(&mut conn, &we.id, &values)
            .await
            .unwrap();
        crate::domain::sets::repo::log_new(&mut conn, &we.id, &values)
            .await
            .unwrap();

        let entries = list_completed_sets_in_range(&mut conn, "2026-01-01", "2026-12-31")
            .await
            .unwrap();
        assert_eq!(entries.len(), 2);
        assert_ne!(
            entries[0].set_order, entries[1].set_order,
            "two identically-valued sets in the same workout-exercise must still carry distinct set_order"
        );
    }

    #[tokio::test]
    async fn excludes_a_planned_set_that_was_never_completed() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let workout = crate::domain::workouts::repo::create(&mut conn, "2026-06-01", "Session")
            .await
            .unwrap();
        let we = crate::domain::workouts::workout_exercises::add(
            &mut conn,
            &workout.id,
            "ex-bench-press",
        )
        .await
        .unwrap();
        crate::domain::sets::repo::add(&mut conn, &we.id)
            .await
            .unwrap();

        let entries = list_completed_sets_in_range(&mut conn, "2026-01-01", "2026-12-31")
            .await
            .unwrap();
        assert!(entries.is_empty());
    }

    #[tokio::test]
    async fn excludes_sets_outside_the_given_range() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        log_completed_set(
            &mut conn,
            "2026-06-01",
            "ex-bench-press",
            SetValues {
                weight_kg: Some(80.0),
                reps: Some(5),
                ..Default::default()
            },
        )
        .await;

        let entries = list_completed_sets_in_range(&mut conn, "2099-01-01", "2099-12-31")
            .await
            .unwrap();
        assert!(entries.is_empty());
    }
}
