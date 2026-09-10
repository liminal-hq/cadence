// History summary and delete-all — cross-entity operations composing workouts/workout_exercises/
// sets directly, rather than through those modules' own single-entity repo functions.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::{Deserialize, Serialize};
use sqlx::SqliteConnection;

use crate::domain::error::Result;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct HistorySummary {
    pub workout_count: i64,
    pub set_count: i64,
}

/// Counts of what P-62's delete-all confirmation is about to remove — must agree exactly with
/// `delete_all`'s own scope below, since the confirmation dialog describes what deletion removes.
pub async fn get_summary(conn: &mut SqliteConnection) -> Result<HistorySummary> {
    let (workout_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM workouts WHERE status = 'completed'")
            .fetch_one(&mut *conn)
            .await?;
    let (set_count,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM sets s JOIN workouts w ON w.id = s.workout_id \
         WHERE w.status = 'completed'",
    )
    .fetch_one(&mut *conn)
    .await?;
    Ok(HistorySummary {
        workout_count,
        set_count,
    })
}

/// Deletes completed workouts and everything that belongs to them (workout_exercises and sets,
/// via cascading foreign keys) — in-progress workouts, exercises, barbells, and settings are
/// never touched, matching the mock's exact scope. Tombstones are written for every affected row
/// before the cascade runs, since a cascading delete never calls back into application code.
pub async fn delete_all(conn: &mut SqliteConnection) -> Result<()> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;

    let set_ids: Vec<(String,)> = sqlx::query_as(
        "SELECT s.id FROM sets s JOIN workouts w ON w.id = s.workout_id \
         WHERE w.status = 'completed'",
    )
    .fetch_all(&mut *conn)
    .await?;
    for (id,) in set_ids {
        crate::db::write_tombstone(conn, "set", &id, revision, now).await?;
    }

    let workout_exercise_ids: Vec<(String,)> = sqlx::query_as(
        "SELECT we.id FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id \
         WHERE w.status = 'completed'",
    )
    .fetch_all(&mut *conn)
    .await?;
    for (id,) in workout_exercise_ids {
        crate::db::write_tombstone(conn, "workout_exercise", &id, revision, now).await?;
    }

    let workout_ids: Vec<(String,)> =
        sqlx::query_as("SELECT id FROM workouts WHERE status = 'completed'")
            .fetch_all(&mut *conn)
            .await?;
    for (id,) in workout_ids {
        crate::db::write_tombstone(conn, "workout", &id, revision, now).await?;
    }

    sqlx::query("DELETE FROM workouts WHERE status = 'completed'")
        .execute(&mut *conn)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    #[tokio::test]
    async fn summarizes_the_seeded_completed_workouts_and_sets() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let summary = get_summary(&mut conn).await.unwrap();
        assert_eq!(summary.workout_count, 12);
        assert_eq!(summary.set_count, 49);
    }

    #[tokio::test]
    async fn delete_all_clears_completed_history_but_keeps_in_progress_workouts() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        delete_all(&mut conn).await.unwrap();

        let summary = get_summary(&mut conn).await.unwrap();
        assert_eq!(
            summary,
            HistorySummary {
                workout_count: 0,
                set_count: 0
            }
        );

        // The routine scaffold survives, sets included — Today and Logging still resolve these
        // by id, and today's already-logged sets aren't history yet either.
        let (we_count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM workout_exercises WHERE id = 'we-bench-press'")
                .fetch_one(&mut *conn)
                .await
                .unwrap();
        assert_eq!(we_count, 1);
        let (set_count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sets WHERE workout_exercise_id = 'we-bench-press'",
        )
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert!(set_count > 0);

        // A completed workout and its workout_exercise are gone.
        let (workout_count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM workouts WHERE id = 'workout-2026-09-04'")
                .fetch_one(&mut *conn)
                .await
                .unwrap();
        assert_eq!(workout_count, 0);
        let (we_2026_09_04,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM workout_exercises WHERE id = 'we-2026-09-04-bench'",
        )
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(we_2026_09_04, 0);

        // Exercises, barbells, and settings are untouched.
        let (exercise_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM exercises")
            .fetch_one(&mut *conn)
            .await
            .unwrap();
        assert_eq!(exercise_count, 6);
        let (barbell_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM barbell_configs")
            .fetch_one(&mut *conn)
            .await
            .unwrap();
        assert_eq!(barbell_count, 2);
    }

    #[tokio::test]
    async fn delete_all_writes_tombstones_for_everything_it_removes() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        delete_all(&mut conn).await.unwrap();
        let (tombstoned_workout,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tombstones WHERE entity_type = 'workout' AND entity_id = 'workout-2026-09-04'",
        )
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(tombstoned_workout, 1);
        let (tombstoned_set,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tombstones WHERE entity_type = 'set' AND entity_id = 'set-2026-09-04-bench-1'",
        )
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(tombstoned_set, 1);
    }
}
