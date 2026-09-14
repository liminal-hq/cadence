// Row mapping and persistence for routine exercises (an exercise slot within a routine section)
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::RoutineExercise;
use crate::domain::error::{Error, Result};

#[derive(FromRow)]
struct RoutineExerciseRow {
    id: String,
    routine_section_id: String,
    exercise_id: String,
    sort_order: i32,
    routine_superset_id: Option<String>,
    superset_position: Option<i32>,
    rest_ms: Option<i64>,
    note: Option<String>,
}

impl From<RoutineExerciseRow> for RoutineExercise {
    fn from(row: RoutineExerciseRow) -> Self {
        RoutineExercise {
            id: row.id,
            routine_section_id: row.routine_section_id,
            exercise_id: row.exercise_id,
            order: row.sort_order,
            routine_superset_id: row.routine_superset_id,
            superset_position: row.superset_position,
            rest_ms: row.rest_ms,
            note: row.note,
        }
    }
}

const SELECT_BY_ID: &str = "SELECT id, routine_section_id, exercise_id, sort_order, \
     routine_superset_id, superset_position, rest_ms, note FROM routine_exercises WHERE id = ?";

const SELECT_BY_SECTION: &str = "SELECT id, routine_section_id, exercise_id, sort_order, \
     routine_superset_id, superset_position, rest_ms, note FROM routine_exercises \
     WHERE routine_section_id = ? ORDER BY sort_order";

pub async fn get(conn: &mut SqliteConnection, id: &str) -> Result<RoutineExercise> {
    let row: RoutineExerciseRow = sqlx::query_as(SELECT_BY_ID)
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| Error::NotFound {
            entity: "routine exercise",
            id: id.to_string(),
        })?;
    Ok(row.into())
}

pub async fn list_by_section(
    conn: &mut SqliteConnection,
    routine_section_id: &str,
) -> Result<Vec<RoutineExercise>> {
    let rows: Vec<RoutineExerciseRow> = sqlx::query_as(SELECT_BY_SECTION)
        .bind(routine_section_id)
        .fetch_all(conn)
        .await?;
    Ok(rows.into_iter().map(RoutineExercise::from).collect())
}

/// Appends at the end of the section's existing exercises — `MAX(sort_order)+1`, matching `workout_exercises::add`'s reasoning.
pub async fn add(
    conn: &mut SqliteConnection,
    routine_section_id: &str,
    exercise_id: &str,
) -> Result<RoutineExercise> {
    let siblings = list_by_section(conn, routine_section_id).await?;
    let next_order = siblings.iter().map(|e| e.order).max().unwrap_or(0) + 1;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "INSERT INTO routine_exercises (id, routine_section_id, exercise_id, sort_order, \
         created_at_ms, updated_at_ms, revision) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(routine_section_id)
    .bind(exercise_id)
    .bind(next_order)
    .bind(now)
    .bind(now)
    .bind(revision)
    .execute(&mut *conn)
    .await?;
    get(conn, &id).await
}

/// Assigns or clears this exercise's superset membership — `routine_superset_id`/`superset_position` are both `Some` (assigning) or both `None` (dissolving the group), never one of each, so a display or materialization read never finds an ungrouped exercise with a stale position or a grouped one with none. Rejects a superset that belongs to a different section: the foreign key alone would happily accept it, but a section-owned superset grouping exercises from another section (or another routine) would corrupt both display and per-section materialization.
pub async fn set_superset(
    conn: &mut SqliteConnection,
    id: &str,
    routine_superset_id: Option<&str>,
    superset_position: Option<i32>,
) -> Result<RoutineExercise> {
    if routine_superset_id.is_some() != superset_position.is_some() {
        return Err(Error::Validation(
            "routine_superset_id and superset_position must be assigned or cleared together"
                .to_string(),
        ));
    }
    let exercise = get(conn, id).await?;
    if let Some(superset_id) = routine_superset_id {
        let superset = super::supersets::get(conn, superset_id).await?;
        if superset.routine_section_id != exercise.routine_section_id {
            return Err(Error::Validation(format!(
                "routine superset {superset_id:?} belongs to a different section than routine \
                 exercise {id:?}"
            )));
        }
    }
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE routine_exercises SET routine_superset_id = ?, superset_position = ?, \
         updated_at_ms = ?, revision = ? WHERE id = ?",
    )
    .bind(routine_superset_id)
    .bind(superset_position)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "routine exercise",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

pub async fn update_note(
    conn: &mut SqliteConnection,
    id: &str,
    note: Option<&str>,
) -> Result<RoutineExercise> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE routine_exercises SET note = ?, updated_at_ms = ?, revision = ? WHERE id = ?",
    )
    .bind(note)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "routine exercise",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

/// A no-op if the routine-exercise doesn't exist, otherwise records a tombstone. Its set templates cascade via `ON DELETE CASCADE`.
pub async fn delete(conn: &mut SqliteConnection, id: &str) -> Result<()> {
    let result = sqlx::query("DELETE FROM routine_exercises WHERE id = ?")
        .bind(id)
        .execute(&mut *conn)
        .await?;
    if result.rows_affected() > 0 {
        let revision = crate::db::next_revision(conn).await?;
        let now = chrono::Utc::now().timestamp_millis();
        crate::db::write_tombstone(conn, "routine_exercise", id, revision, now).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    async fn a_section(conn: &mut SqliteConnection) -> String {
        let routine = super::super::repo::create(conn, "Push day").await.unwrap();
        super::super::sections::add(conn, &routine.id, Some("A"))
            .await
            .unwrap()
            .id
    }

    #[tokio::test]
    async fn adds_exercises_appending_at_the_end_of_the_order() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let section_id = a_section(&mut conn).await;
        let first = add(&mut conn, &section_id, "ex-bench-press").await.unwrap();
        assert_eq!(first.order, 1);
        let second = add(&mut conn, &section_id, "ex-running").await.unwrap();
        assert_eq!(second.order, 2);
    }

    #[tokio::test]
    async fn assigns_and_clears_superset_membership() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let section_id = a_section(&mut conn).await;
        let superset = super::super::supersets::create(&mut conn, &section_id, None, true, None)
            .await
            .unwrap();
        let exercise = add(&mut conn, &section_id, "ex-lateral-raise")
            .await
            .unwrap();
        let grouped = set_superset(&mut conn, &exercise.id, Some(&superset.id), Some(1))
            .await
            .unwrap();
        assert_eq!(
            grouped.routine_superset_id.as_deref(),
            Some(superset.id.as_str())
        );
        assert_eq!(grouped.superset_position, Some(1));

        let cleared = set_superset(&mut conn, &exercise.id, None, None)
            .await
            .unwrap();
        assert_eq!(cleared.routine_superset_id, None);
        assert_eq!(cleared.superset_position, None);
    }

    #[tokio::test]
    async fn deleting_a_routine_superset_clears_membership_instead_of_deleting_the_exercise() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let section_id = a_section(&mut conn).await;
        let superset = super::super::supersets::create(&mut conn, &section_id, None, true, None)
            .await
            .unwrap();
        let exercise = add(&mut conn, &section_id, "ex-lateral-raise")
            .await
            .unwrap();
        set_superset(&mut conn, &exercise.id, Some(&superset.id), Some(1))
            .await
            .unwrap();

        super::super::supersets::delete(&mut conn, &superset.id)
            .await
            .unwrap();
        let reloaded = get(&mut conn, &exercise.id).await.unwrap();
        assert_eq!(reloaded.routine_superset_id, None);
        // The FK's `ON DELETE SET NULL` only clears `routine_superset_id` — `superset_position`
        // must be cleared explicitly, or a re-grouped exercise would inherit a stale position.
        assert_eq!(reloaded.superset_position, None);
    }

    #[tokio::test]
    async fn rejects_assigning_a_superset_id_without_a_position() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let section_id = a_section(&mut conn).await;
        let superset = super::super::supersets::create(&mut conn, &section_id, None, true, None)
            .await
            .unwrap();
        let exercise = add(&mut conn, &section_id, "ex-lateral-raise")
            .await
            .unwrap();
        let err = set_superset(&mut conn, &exercise.id, Some(&superset.id), None)
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn rejects_a_position_without_a_superset_id() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let section_id = a_section(&mut conn).await;
        let exercise = add(&mut conn, &section_id, "ex-lateral-raise")
            .await
            .unwrap();
        let err = set_superset(&mut conn, &exercise.id, None, Some(1))
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn rejects_a_superset_from_a_different_section() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let section_a = a_section(&mut conn).await;
        let routine_b = super::super::repo::create(&mut conn, "Pull day")
            .await
            .unwrap();
        let section_b = super::super::sections::add(&mut conn, &routine_b.id, Some("A"))
            .await
            .unwrap();
        let superset_in_b =
            super::super::supersets::create(&mut conn, &section_b.id, None, true, None)
                .await
                .unwrap();
        let exercise_in_a = add(&mut conn, &section_a, "ex-lateral-raise")
            .await
            .unwrap();

        let err = set_superset(
            &mut conn,
            &exercise_in_a.id,
            Some(&superset_in_b.id),
            Some(1),
        )
        .await
        .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn updates_and_clears_the_note() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let section_id = a_section(&mut conn).await;
        let exercise = add(&mut conn, &section_id, "ex-running").await.unwrap();
        let noted = update_note(&mut conn, &exercise.id, Some("Incline treadmill"))
            .await
            .unwrap();
        assert_eq!(noted.note.as_deref(), Some("Incline treadmill"));
        let cleared = update_note(&mut conn, &exercise.id, None).await.unwrap();
        assert_eq!(cleared.note, None);
    }

    #[tokio::test]
    async fn deletes_a_routine_exercise_and_records_a_tombstone() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let section_id = a_section(&mut conn).await;
        let exercise = add(&mut conn, &section_id, "ex-running").await.unwrap();
        delete(&mut conn, &exercise.id).await.unwrap();
        let err = get(&mut conn, &exercise.id).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }
}
