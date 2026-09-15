// Row mapping and persistence for routine-authored superset templates
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{Connection, FromRow, SqliteConnection};

use super::models::RoutineSuperset;
use crate::domain::error::{Error, Result};

#[derive(FromRow)]
struct RoutineSupersetRow {
    id: String,
    routine_section_id: String,
    colour: Option<String>,
    auto_advance: i64,
    rest_ms: Option<i64>,
}

impl From<RoutineSupersetRow> for RoutineSuperset {
    fn from(row: RoutineSupersetRow) -> Self {
        RoutineSuperset {
            id: row.id,
            routine_section_id: row.routine_section_id,
            colour: row.colour,
            auto_advance: row.auto_advance != 0,
            rest_ms: row.rest_ms,
        }
    }
}

pub async fn get(conn: &mut SqliteConnection, id: &str) -> Result<RoutineSuperset> {
    let row: RoutineSupersetRow = sqlx::query_as(
        "SELECT id, routine_section_id, colour, auto_advance, rest_ms FROM routine_supersets \
         WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(conn)
    .await?
    .ok_or_else(|| Error::NotFound {
        entity: "routine superset",
        id: id.to_string(),
    })?;
    Ok(row.into())
}

pub async fn create(
    conn: &mut SqliteConnection,
    routine_section_id: &str,
    colour: Option<&str>,
    auto_advance: bool,
    rest_ms: Option<i64>,
) -> Result<RoutineSuperset> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "INSERT INTO routine_supersets (id, routine_section_id, colour, auto_advance, rest_ms, \
         created_at_ms, updated_at_ms, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(routine_section_id)
    .bind(colour)
    .bind(auto_advance)
    .bind(rest_ms)
    .bind(now)
    .bind(now)
    .bind(revision)
    .execute(&mut *conn)
    .await?;
    get(conn, &id).await
}

/// A no-op if the superset doesn't exist, otherwise records a tombstone. Member routine-exercises' `routine_superset_id` is cleared via `ON DELETE SET NULL`, but that alone leaves `superset_position` stale — cleared explicitly here, row by row, so each clear gets its own revision stamp like any other mutation.
pub async fn delete(conn: &mut SqliteConnection, id: &str) -> Result<()> {
    // A transaction on this same connection, not just sequential statements: a concurrent
    // `set_superset` assigning a new member between the SELECT below and the DELETE would
    // otherwise land outside this snapshot, leaving that member's `superset_position` populated
    // once the FK's `ON DELETE SET NULL` clears its `routine_superset_id`.
    let mut tx = conn.begin().await?;
    let member_ids: Vec<(String,)> =
        sqlx::query_as("SELECT id FROM routine_exercises WHERE routine_superset_id = ?")
            .bind(id)
            .fetch_all(&mut *tx)
            .await?;
    let now = chrono::Utc::now().timestamp_millis();
    for (exercise_id,) in &member_ids {
        let revision = crate::db::next_revision(&mut tx).await?;
        sqlx::query(
            "UPDATE routine_exercises SET superset_position = NULL, updated_at_ms = ?, \
             revision = ? WHERE id = ?",
        )
        .bind(now)
        .bind(revision)
        .bind(exercise_id)
        .execute(&mut *tx)
        .await?;
    }
    let result = sqlx::query("DELETE FROM routine_supersets WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    if result.rows_affected() > 0 {
        let revision = crate::db::next_revision(&mut tx).await?;
        crate::db::write_tombstone(&mut tx, "routine_superset", id, revision, now).await?;
    }
    tx.commit().await?;
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
    async fn creates_and_gets_a_routine_superset() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let section_id = a_section(&mut conn).await;
        let created = create(&mut conn, &section_id, Some("#ffcc00"), true, Some(60_000))
            .await
            .unwrap();
        assert_eq!(created.colour.as_deref(), Some("#ffcc00"));
        assert!(created.auto_advance);
        assert_eq!(created.rest_ms, Some(60_000));
        let fetched = get(&mut conn, &created.id).await.unwrap();
        assert_eq!(fetched, created);
    }

    #[tokio::test]
    async fn deletes_a_routine_superset_and_records_a_tombstone() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let section_id = a_section(&mut conn).await;
        let created = create(&mut conn, &section_id, None, true, None)
            .await
            .unwrap();
        delete(&mut conn, &created.id).await.unwrap();
        let err = get(&mut conn, &created.id).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }

    #[tokio::test]
    async fn deleting_an_unknown_routine_superset_is_a_silent_no_op() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        delete(&mut conn, "no-such-superset").await.unwrap();
    }
}
