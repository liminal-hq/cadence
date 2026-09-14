// Row mapping and persistence for routine sections.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::RoutineSection;
use crate::domain::error::{Error, Result};

#[derive(FromRow)]
struct RoutineSectionRow {
    id: String,
    routine_id: String,
    name: Option<String>,
    sort_order: i32,
}

impl From<RoutineSectionRow> for RoutineSection {
    fn from(row: RoutineSectionRow) -> Self {
        RoutineSection {
            id: row.id,
            routine_id: row.routine_id,
            name: row.name,
            sort_order: row.sort_order,
        }
    }
}

pub async fn get(conn: &mut SqliteConnection, id: &str) -> Result<RoutineSection> {
    let row: RoutineSectionRow = sqlx::query_as(
        "SELECT id, routine_id, name, sort_order FROM routine_sections WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(conn)
    .await?
    .ok_or_else(|| Error::NotFound {
        entity: "routine section",
        id: id.to_string(),
    })?;
    Ok(row.into())
}

pub async fn list_by_routine(
    conn: &mut SqliteConnection,
    routine_id: &str,
) -> Result<Vec<RoutineSection>> {
    let rows: Vec<RoutineSectionRow> = sqlx::query_as(
        "SELECT id, routine_id, name, sort_order FROM routine_sections WHERE routine_id = ? \
         ORDER BY sort_order",
    )
    .bind(routine_id)
    .fetch_all(conn)
    .await?;
    Ok(rows.into_iter().map(RoutineSection::from).collect())
}

/// Appends at the end of the routine's existing sections — `MAX(sort_order)+1`, matching
/// `workout_exercises::add`'s reasoning.
pub async fn add(
    conn: &mut SqliteConnection,
    routine_id: &str,
    name: Option<&str>,
) -> Result<RoutineSection> {
    let siblings = list_by_routine(conn, routine_id).await?;
    let next_order = siblings.iter().map(|s| s.sort_order).max().unwrap_or(0) + 1;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "INSERT INTO routine_sections (id, routine_id, name, sort_order, created_at_ms, \
         updated_at_ms, revision) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(routine_id)
    .bind(name)
    .bind(next_order)
    .bind(now)
    .bind(now)
    .bind(revision)
    .execute(&mut *conn)
    .await?;
    get(conn, &id).await
}

/// A no-op if the section doesn't exist, otherwise records a tombstone. Its supersets/exercises/
/// set-templates cascade via `ON DELETE CASCADE`.
pub async fn delete(conn: &mut SqliteConnection, id: &str) -> Result<()> {
    let result = sqlx::query("DELETE FROM routine_sections WHERE id = ?")
        .bind(id)
        .execute(&mut *conn)
        .await?;
    if result.rows_affected() > 0 {
        let revision = crate::db::next_revision(conn).await?;
        let now = chrono::Utc::now().timestamp_millis();
        crate::db::write_tombstone(conn, "routine_section", id, revision, now).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    #[tokio::test]
    async fn adds_sections_appending_at_the_end_of_the_order() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let routine = super::super::repo::create(&mut conn, "Push day")
            .await
            .unwrap();
        let first = add(&mut conn, &routine.id, Some("Warm-up")).await.unwrap();
        assert_eq!(first.sort_order, 1);
        let second = add(&mut conn, &routine.id, None).await.unwrap();
        assert_eq!(second.sort_order, 2);
        assert_eq!(second.name, None);
    }

    #[tokio::test]
    async fn lists_sections_in_order_for_a_routine() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let routine = super::super::repo::create(&mut conn, "Push day")
            .await
            .unwrap();
        let a = add(&mut conn, &routine.id, Some("A")).await.unwrap();
        let b = add(&mut conn, &routine.id, Some("B")).await.unwrap();
        let sections = list_by_routine(&mut conn, &routine.id).await.unwrap();
        assert_eq!(
            sections.iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
            vec![a.id.as_str(), b.id.as_str()]
        );
    }

    #[tokio::test]
    async fn deletes_a_section_and_records_a_tombstone() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let routine = super::super::repo::create(&mut conn, "Push day")
            .await
            .unwrap();
        let section = add(&mut conn, &routine.id, Some("A")).await.unwrap();
        delete(&mut conn, &section.id).await.unwrap();
        let err = get(&mut conn, &section.id).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tombstones WHERE entity_type = 'routine_section' AND entity_id = ?",
        )
        .bind(&section.id)
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn deleting_a_routine_cascades_to_its_sections() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let routine = super::super::repo::create(&mut conn, "Push day")
            .await
            .unwrap();
        let section = add(&mut conn, &routine.id, Some("A")).await.unwrap();
        super::super::repo::delete(&mut conn, &routine.id)
            .await
            .unwrap();
        let err = get(&mut conn, &section.id).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }
}
