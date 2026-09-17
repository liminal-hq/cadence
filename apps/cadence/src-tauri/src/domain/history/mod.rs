// History summary and delete-all, composing workouts/workout_exercises/sets directly
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
    #[cfg_attr(test, ts(type = "number"))]
    pub workout_count: i64,
    #[cfg_attr(test, ts(type = "number"))]
    pub set_count: i64,
}

/// Counts of what P-62's delete-all confirmation is about to remove — must agree exactly with
/// `delete_all`'s own scope below, since the confirmation dialog describes what deletion removes.
/// `completed` and `abandoned` are both "history" here (SPEC.md 8.1: the lifecycle states "do not
/// lock history"); `draft`/`active` workouts are still open and never counted.
pub async fn get_summary(conn: &mut SqliteConnection) -> Result<HistorySummary> {
    let (workout_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM workouts WHERE status IN ('completed', 'abandoned')")
            .fetch_one(&mut *conn)
            .await?;
    let (set_count,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM sets s JOIN workouts w ON w.id = s.workout_id \
         WHERE w.status IN ('completed', 'abandoned')",
    )
    .fetch_one(&mut *conn)
    .await?;
    Ok(HistorySummary {
        workout_count,
        set_count,
    })
}

/// Deletes completed or abandoned workouts and everything that belongs to them (workout_exercises
/// and sets, via cascading foreign keys) — still-open (draft/active) workouts, exercises,
/// barbells, and settings are never touched, matching the mock's exact scope. Tombstones are
/// written for every affected row before the cascade runs, since a cascading delete never calls
/// back into application code.
pub async fn delete_all(conn: &mut SqliteConnection) -> Result<()> {
    let now = chrono::Utc::now().timestamp_millis();

    let set_ids: Vec<(String,)> = sqlx::query_as(
        "SELECT s.id FROM sets s JOIN workouts w ON w.id = s.workout_id \
         WHERE w.status IN ('completed', 'abandoned')",
    )
    .fetch_all(&mut *conn)
    .await?;
    for (id,) in set_ids {
        // One revision per row, not one shared for the whole batch — matching every other
        // mutation path in this crate, so a future revision-cursor sync consumer never has to
        // treat "hundreds of rows changed in the same tick" as a special case.
        let revision = crate::db::next_revision(conn).await?;
        crate::db::write_tombstone(conn, "set", &id, revision, now).await?;
    }

    let workout_exercise_ids: Vec<(String,)> = sqlx::query_as(
        "SELECT we.id FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id \
         WHERE w.status IN ('completed', 'abandoned')",
    )
    .fetch_all(&mut *conn)
    .await?;
    for (id,) in workout_exercise_ids {
        let revision = crate::db::next_revision(conn).await?;
        crate::db::write_tombstone(conn, "workout_exercise", &id, revision, now).await?;
    }

    let workout_ids: Vec<(String,)> =
        sqlx::query_as("SELECT id FROM workouts WHERE status IN ('completed', 'abandoned')")
            .fetch_all(&mut *conn)
            .await?;
    for (id,) in workout_ids {
        let revision = crate::db::next_revision(conn).await?;
        crate::db::write_tombstone(conn, "workout", &id, revision, now).await?;
    }

    sqlx::query("DELETE FROM workouts WHERE status IN ('completed', 'abandoned')")
        .execute(&mut *conn)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;
    use crate::domain::sets::models::SetValues;
    use crate::domain::{sets, workouts};

    /// One completed workout (an exercise with two sets) and one in-progress "survivor" workout
    /// (an exercise with one set) — the two-workout shape `delete_all`'s scope tests need.
    /// Returns (completed_workout_id, completed_set_ids, survivor_workout_exercise_id).
    async fn seed_completed_and_in_progress_workouts(
        conn: &mut SqliteConnection,
    ) -> (String, Vec<String>, String) {
        let completed = workouts::repo::create(conn, "2026-09-04", "Push A")
            .await
            .unwrap();
        let completed_we = workouts::workout_exercises::add(conn, &completed.id, "ex-bench-press")
            .await
            .unwrap();
        let mut set_ids = Vec::new();
        for _ in 0..2 {
            let set = sets::repo::log_new(
                conn,
                &completed_we.id,
                &SetValues {
                    weight_kg: Some(80.0),
                    reps: Some(8),
                    ..Default::default()
                },
            )
            .await
            .unwrap();
            set_ids.push(set.id);
        }
        sqlx::query("UPDATE workouts SET status = 'completed' WHERE id = ?")
            .bind(&completed.id)
            .execute(&mut *conn)
            .await
            .unwrap();

        let survivor = workouts::repo::create(conn, "2026-09-09", "Push A")
            .await
            .unwrap();
        let survivor_we = workouts::workout_exercises::add(conn, &survivor.id, "ex-running")
            .await
            .unwrap();
        sets::repo::add(conn, &survivor_we.id).await.unwrap();

        (completed.id, set_ids, survivor_we.id)
    }

    /// An abandoned workout with a completed set already logged — decision #2's "abandoning never
    /// discards history" means this must be treated as history exactly like a completed workout.
    /// Inserted directly as `abandoned` rather than via `create()` + a status flip: this is called
    /// alongside a fixture that leaves its own workout genuinely open, and both the app-level guard
    /// and the database's own partial unique index correctly refuse a second `active` row while
    /// one already exists — this fixture only ever needs the row to end up abandoned, never active.
    async fn seed_an_abandoned_workout_with_a_completed_set(conn: &mut SqliteConnection) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        let revision = crate::db::next_revision(conn).await.unwrap();
        sqlx::query(
            "INSERT INTO workouts (id, local_date, title, status, source, logged_by_watch, \
             started_at_ms, created_at_ms, updated_at_ms, revision) VALUES (?, ?, ?, 'abandoned', \
             'manual', 0, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind("2026-09-05")
        .bind("Push B")
        .bind(now)
        .bind(now)
        .bind(now)
        .bind(revision)
        .execute(&mut *conn)
        .await
        .unwrap();
        let we = workouts::workout_exercises::add(conn, &id, "ex-bench-press")
            .await
            .unwrap();
        sets::repo::log_new(
            conn,
            &we.id,
            &SetValues {
                weight_kg: Some(70.0),
                reps: Some(6),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        id
    }

    #[tokio::test]
    async fn summarizes_and_deletes_abandoned_workouts_alongside_completed_ones() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let (_, _, survivor_we_id) = seed_completed_and_in_progress_workouts(&mut conn).await;
        let abandoned_id = seed_an_abandoned_workout_with_a_completed_set(&mut conn).await;

        let summary = get_summary(&mut conn).await.unwrap();
        assert_eq!(summary.workout_count, 2, "completed + abandoned");
        assert_eq!(summary.set_count, 3, "2 completed + 1 abandoned");

        delete_all(&mut conn).await.unwrap();

        let (abandoned_count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM workouts WHERE id = ?")
                .bind(&abandoned_id)
                .fetch_one(&mut *conn)
                .await
                .unwrap();
        assert_eq!(abandoned_count, 0, "abandoned workout is removed too");

        let (survivor_count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM workout_exercises WHERE id = ?")
                .bind(&survivor_we_id)
                .fetch_one(&mut *conn)
                .await
                .unwrap();
        assert_eq!(survivor_count, 1, "the still-active workout is untouched");
    }

    #[tokio::test]
    async fn summarizes_completed_workouts_and_sets() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        seed_completed_and_in_progress_workouts(&mut conn).await;
        let summary = get_summary(&mut conn).await.unwrap();
        assert_eq!(summary.workout_count, 1);
        assert_eq!(summary.set_count, 2);
    }

    #[tokio::test]
    async fn delete_all_clears_completed_history_but_keeps_in_progress_workouts() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let (completed_id, _, survivor_we_id) =
            seed_completed_and_in_progress_workouts(&mut conn).await;
        delete_all(&mut conn).await.unwrap();

        let summary = get_summary(&mut conn).await.unwrap();
        assert_eq!(
            summary,
            HistorySummary {
                workout_count: 0,
                set_count: 0
            }
        );

        // The in-progress workout's own exercise and sets survive — Today and Logging still
        // resolve these by id, and an in-progress workout's sets aren't history yet either.
        let (we_count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM workout_exercises WHERE id = ?")
                .bind(&survivor_we_id)
                .fetch_one(&mut *conn)
                .await
                .unwrap();
        assert_eq!(we_count, 1);
        let (set_count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM sets WHERE workout_exercise_id = ?")
                .bind(&survivor_we_id)
                .fetch_one(&mut *conn)
                .await
                .unwrap();
        assert!(set_count > 0);

        // The completed workout and its workout_exercise are gone.
        let (workout_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM workouts WHERE id = ?")
            .bind(&completed_id)
            .fetch_one(&mut *conn)
            .await
            .unwrap();
        assert_eq!(workout_count, 0);

        // Exercises, barbells, and settings are untouched.
        let (exercise_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM exercises")
            .fetch_one(&mut *conn)
            .await
            .unwrap();
        assert_eq!(exercise_count, 80);
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
        let (completed_id, set_ids, _) = seed_completed_and_in_progress_workouts(&mut conn).await;
        delete_all(&mut conn).await.unwrap();
        let (tombstoned_workout,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tombstones WHERE entity_type = 'workout' AND entity_id = ?",
        )
        .bind(&completed_id)
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(tombstoned_workout, 1);
        let (tombstoned_set,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tombstones WHERE entity_type = 'set' AND entity_id = ?",
        )
        .bind(&set_ids[0])
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(tombstoned_set, 1);
    }

    #[tokio::test]
    async fn delete_all_stamps_a_distinct_revision_per_tombstoned_row() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        seed_completed_and_in_progress_workouts(&mut conn).await;
        delete_all(&mut conn).await.unwrap();
        let (distinct_revisions,): (i64,) =
            sqlx::query_as("SELECT COUNT(DISTINCT revision) FROM tombstones")
                .fetch_one(&mut *conn)
                .await
                .unwrap();
        let (total_tombstones,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tombstones")
            .fetch_one(&mut *conn)
            .await
            .unwrap();
        assert!(total_tombstones > 1);
        assert_eq!(distinct_revisions, total_tombstones);
    }
}
