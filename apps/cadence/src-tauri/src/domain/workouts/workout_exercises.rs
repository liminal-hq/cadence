// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::WorkoutExercise;
use crate::domain::error::{Error, Result};
use crate::domain::units::ms_to_iso;

#[derive(FromRow)]
struct WorkoutExerciseRow {
    id: String,
    exercise_id: String,
    workout_id: String,
    sort_order: i32,
    today_note: Option<String>,
    superset_id: Option<String>,
    superset_position: Option<i32>,
    offline_since_ms: Option<i64>,
    workout_title: String,
    technical_note: Option<String>,
    sibling_count: i32,
    superset_size: Option<i32>,
}

/// `workoutLabel` is presentational, computed from the workout's title and this exercise's
/// position among its siblings, rather than a stored column — the mock's own seeded labels were
/// narrative flavour text ("exercise 1 of 6") that didn't always match the actual row count; this
/// computes a label that's always internally consistent with the real data instead.
fn workout_label(title: &str, sort_order: i32, sibling_count: i32) -> String {
    format!("{title} · {sort_order} of {sibling_count}")
}

impl From<WorkoutExerciseRow> for WorkoutExercise {
    fn from(row: WorkoutExerciseRow) -> Self {
        WorkoutExercise {
            id: row.id,
            exercise_id: row.exercise_id,
            workout_id: row.workout_id,
            workout_label: workout_label(&row.workout_title, row.sort_order, row.sibling_count),
            order: row.sort_order,
            technical_note: row.technical_note,
            today_note: row.today_note,
            superset_group_id: row.superset_id,
            superset_position: row.superset_position,
            superset_size: row.superset_size,
            offline_since: row.offline_since_ms.map(ms_to_iso),
            // Prior-performance lookup and label formatting are deferred — see the doc comment
            // on `WorkoutExercise::last_time_reference` in models.rs.
            last_time_reference: None,
        }
    }
}

const SELECT_BY_ID: &str = "SELECT we.id, we.exercise_id, we.workout_id, we.sort_order, \
     we.today_note, we.superset_id, we.superset_position, we.offline_since_ms, \
     w.title AS workout_title, ex.notes AS technical_note, \
     (SELECT COUNT(*) FROM workout_exercises sib WHERE sib.workout_id = we.workout_id) AS sibling_count, \
     CASE WHEN we.superset_id IS NULL THEN NULL \
          ELSE (SELECT COUNT(*) FROM workout_exercises grp WHERE grp.superset_id = we.superset_id) END AS superset_size \
     FROM workout_exercises we \
     JOIN workouts w ON w.id = we.workout_id \
     JOIN exercises ex ON ex.id = we.exercise_id \
     WHERE we.id = ?";

const SELECT_BY_WORKOUT: &str = "SELECT we.id, we.exercise_id, we.workout_id, we.sort_order, \
     we.today_note, we.superset_id, we.superset_position, we.offline_since_ms, \
     w.title AS workout_title, ex.notes AS technical_note, \
     (SELECT COUNT(*) FROM workout_exercises sib WHERE sib.workout_id = we.workout_id) AS sibling_count, \
     CASE WHEN we.superset_id IS NULL THEN NULL \
          ELSE (SELECT COUNT(*) FROM workout_exercises grp WHERE grp.superset_id = we.superset_id) END AS superset_size \
     FROM workout_exercises we \
     JOIN workouts w ON w.id = we.workout_id \
     JOIN exercises ex ON ex.id = we.exercise_id \
     WHERE we.workout_id = ? ORDER BY we.sort_order";

const SELECT_BY_EXERCISE: &str = "SELECT we.id, we.exercise_id, we.workout_id, we.sort_order, \
     we.today_note, we.superset_id, we.superset_position, we.offline_since_ms, \
     w.title AS workout_title, ex.notes AS technical_note, \
     (SELECT COUNT(*) FROM workout_exercises sib WHERE sib.workout_id = we.workout_id) AS sibling_count, \
     CASE WHEN we.superset_id IS NULL THEN NULL \
          ELSE (SELECT COUNT(*) FROM workout_exercises grp WHERE grp.superset_id = we.superset_id) END AS superset_size \
     FROM workout_exercises we \
     JOIN workouts w ON w.id = we.workout_id \
     JOIN exercises ex ON ex.id = we.exercise_id \
     WHERE we.exercise_id = ?";

pub async fn get(conn: &mut SqliteConnection, id: &str) -> Result<WorkoutExercise> {
    let row: WorkoutExerciseRow = sqlx::query_as(SELECT_BY_ID)
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| Error::NotFound {
            entity: "workout exercise",
            id: id.to_string(),
        })?;
    Ok(row.into())
}

pub async fn list_by_workout(
    conn: &mut SqliteConnection,
    workout_id: &str,
) -> Result<Vec<WorkoutExercise>> {
    let rows: Vec<WorkoutExerciseRow> = sqlx::query_as(SELECT_BY_WORKOUT)
        .bind(workout_id)
        .fetch_all(conn)
        .await?;
    Ok(rows.into_iter().map(WorkoutExercise::from).collect())
}

pub async fn list_by_exercise(
    conn: &mut SqliteConnection,
    exercise_id: &str,
) -> Result<Vec<WorkoutExercise>> {
    let rows: Vec<WorkoutExerciseRow> = sqlx::query_as(SELECT_BY_EXERCISE)
        .bind(exercise_id)
        .fetch_all(conn)
        .await?;
    Ok(rows.into_iter().map(WorkoutExercise::from).collect())
}

pub async fn update_today_note(
    conn: &mut SqliteConnection,
    id: &str,
    note: Option<&str>,
) -> Result<WorkoutExercise> {
    let result = sqlx::query("UPDATE workout_exercises SET today_note = ? WHERE id = ?")
        .bind(note)
        .bind(id)
        .execute(&mut *conn)
        .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "workout exercise",
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
    async fn gets_a_workout_exercise_with_a_computed_label_and_projected_technical_note() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let we = get(&mut conn, "we-2026-09-04-bench").await.unwrap();
        assert_eq!(we.workout_label, "Push A · 1 of 2");
        assert_eq!(
            we.technical_note.as_deref(),
            Some("Pause at chest · pinky on ring · feet back")
        );
        assert_eq!(we.superset_group_id, None);
        assert_eq!(we.superset_size, None);
    }

    #[tokio::test]
    async fn reports_superset_size_from_actual_group_membership() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let we = get(&mut conn, "we-lateral-raise").await.unwrap();
        assert_eq!(we.superset_group_id.as_deref(), Some("ss-1"));
        assert_eq!(we.superset_size, Some(2));
        assert!(we.offline_since.is_some());
    }

    #[tokio::test]
    async fn rejects_an_unknown_workout_exercise_id() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = get(&mut conn, "no-such-we").await.unwrap_err();
        assert!(matches!(
            err,
            Error::NotFound {
                entity: "workout exercise",
                ..
            }
        ));
    }

    #[tokio::test]
    async fn lists_siblings_in_order_by_workout() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let sibs = list_by_workout(&mut conn, "workout-push-a").await.unwrap();
        assert_eq!(
            sibs.iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
            vec!["we-bench-press", "we-running"]
        );
    }

    #[tokio::test]
    async fn lists_every_occurrence_of_an_exercise_across_workouts() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let occurrences = list_by_exercise(&mut conn, "ex-bench-press").await.unwrap();
        assert_eq!(occurrences.len(), 9);
        assert!(occurrences
            .iter()
            .all(|o| o.exercise_id == "ex-bench-press"));
    }

    #[tokio::test]
    async fn updates_and_clears_the_today_note() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let updated = update_today_note(&mut conn, "we-running", Some("Legs felt heavy"))
            .await
            .unwrap();
        assert_eq!(updated.today_note.as_deref(), Some("Legs felt heavy"));
        let cleared = update_today_note(&mut conn, "we-running", None)
            .await
            .unwrap();
        assert_eq!(cleared.today_note, None);
    }

    #[tokio::test]
    async fn rejects_updating_the_today_note_of_an_unknown_workout_exercise() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = update_today_note(&mut conn, "no-such-we", Some("x"))
            .await
            .unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }
}
