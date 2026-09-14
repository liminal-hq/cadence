// Row mapping and persistence for routines (the top-level template entity).
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::Routine;
use crate::domain::error::{Error, Result};

#[derive(FromRow)]
struct RoutineRow {
    id: String,
    name: String,
    note: Option<String>,
    sort_order: i32,
    archived: i64,
}

impl From<RoutineRow> for Routine {
    fn from(row: RoutineRow) -> Self {
        Routine {
            id: row.id,
            name: row.name,
            note: row.note,
            sort_order: row.sort_order,
            archived: row.archived != 0,
        }
    }
}

pub async fn get(conn: &mut SqliteConnection, id: &str) -> Result<Routine> {
    let row: RoutineRow =
        sqlx::query_as("SELECT id, name, note, sort_order, archived FROM routines WHERE id = ?")
            .bind(id)
            .fetch_optional(conn)
            .await?
            .ok_or_else(|| Error::NotFound {
                entity: "routine",
                id: id.to_string(),
            })?;
    Ok(row.into())
}

/// Every routine, archived or not — the routine list screen (P-30) is responsible for filtering,
/// same division of labour as `exercises::repo::list` returning archived rows for its caller.
pub async fn list(conn: &mut SqliteConnection) -> Result<Vec<Routine>> {
    let rows: Vec<RoutineRow> = sqlx::query_as(
        "SELECT id, name, note, sort_order, archived FROM routines ORDER BY sort_order, id",
    )
    .fetch_all(conn)
    .await?;
    Ok(rows.into_iter().map(Routine::from).collect())
}

/// Appends at the end of the list — `MAX(sort_order)+1`, matching every other append-ordered
/// table in this crate (a prior archive/delete can leave a gap `COUNT` would collide with).
pub async fn create(conn: &mut SqliteConnection, name: &str) -> Result<Routine> {
    let existing = list(conn).await?;
    let next_order = existing.iter().map(|r| r.sort_order).max().unwrap_or(0) + 1;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "INSERT INTO routines (id, name, sort_order, archived, created_at_ms, updated_at_ms, \
         revision) VALUES (?, ?, ?, 0, ?, ?, ?)",
    )
    .bind(&id)
    .bind(name)
    .bind(next_order)
    .bind(now)
    .bind(now)
    .bind(revision)
    .execute(&mut *conn)
    .await?;
    get(conn, &id).await
}

pub async fn rename(conn: &mut SqliteConnection, id: &str, name: &str) -> Result<Routine> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result =
        sqlx::query("UPDATE routines SET name = ?, updated_at_ms = ?, revision = ? WHERE id = ?")
            .bind(name)
            .bind(now)
            .bind(revision)
            .bind(id)
            .execute(&mut *conn)
            .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "routine",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

pub async fn update_note(
    conn: &mut SqliteConnection,
    id: &str,
    note: Option<&str>,
) -> Result<Routine> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result =
        sqlx::query("UPDATE routines SET note = ?, updated_at_ms = ?, revision = ? WHERE id = ?")
            .bind(note)
            .bind(now)
            .bind(revision)
            .bind(id)
            .execute(&mut *conn)
            .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "routine",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

pub async fn set_archived(
    conn: &mut SqliteConnection,
    id: &str,
    archived: bool,
) -> Result<Routine> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE routines SET archived = ?, updated_at_ms = ?, revision = ? WHERE id = ?",
    )
    .bind(archived)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "routine",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

/// A no-op if the routine doesn't exist, otherwise records a tombstone. Its sections/supersets/
/// routine-exercises/set-templates cascade via the schema's `ON DELETE CASCADE`.
pub async fn delete(conn: &mut SqliteConnection, id: &str) -> Result<()> {
    let result = sqlx::query("DELETE FROM routines WHERE id = ?")
        .bind(id)
        .execute(&mut *conn)
        .await?;
    if result.rows_affected() > 0 {
        let revision = crate::db::next_revision(conn).await?;
        let now = chrono::Utc::now().timestamp_millis();
        crate::db::write_tombstone(conn, "routine", id, revision, now).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    #[tokio::test]
    async fn creates_and_gets_a_routine() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "Push day").await.unwrap();
        assert_eq!(created.name, "Push day");
        assert_eq!(created.sort_order, 1);
        assert!(!created.archived);
        let fetched = get(&mut conn, &created.id).await.unwrap();
        assert_eq!(fetched, created);
    }

    #[tokio::test]
    async fn rejects_an_unknown_routine_id() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = get(&mut conn, "no-such-routine").await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }

    #[tokio::test]
    async fn appends_new_routines_at_the_end_of_the_order() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        create(&mut conn, "Push day").await.unwrap();
        let second = create(&mut conn, "Pull day").await.unwrap();
        assert_eq!(second.sort_order, 2);
    }

    #[tokio::test]
    async fn renames_updates_notes_and_archives_a_routine() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "Push day").await.unwrap();
        let renamed = rename(&mut conn, &created.id, "Push day A").await.unwrap();
        assert_eq!(renamed.name, "Push day A");
        let noted = update_note(&mut conn, &created.id, Some("Heavy week"))
            .await
            .unwrap();
        assert_eq!(noted.note.as_deref(), Some("Heavy week"));
        let archived = set_archived(&mut conn, &created.id, true).await.unwrap();
        assert!(archived.archived);
    }

    #[tokio::test]
    async fn deletes_a_routine_and_records_a_tombstone() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "Push day").await.unwrap();
        delete(&mut conn, &created.id).await.unwrap();
        let err = get(&mut conn, &created.id).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tombstones WHERE entity_type = 'routine' AND entity_id = ?",
        )
        .bind(&created.id)
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn deleting_an_unknown_routine_is_a_silent_no_op() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        delete(&mut conn, "no-such-routine").await.unwrap();
    }
}
