// Row mapping and persistence for routine sections
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

/// Appends at the end of the routine's existing sections — `MAX(sort_order)+1`, matching `workout_exercises::add`'s reasoning.
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

pub async fn rename(
    conn: &mut SqliteConnection,
    id: &str,
    name: Option<&str>,
) -> Result<RoutineSection> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE routine_sections SET name = ?, updated_at_ms = ?, revision = ? WHERE id = ?",
    )
    .bind(name)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "routine section",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

/// Rewrites every named section's `sort_order` to its 1-indexed position in `ordered_ids`, so a caller (the routine editor's up/down reorder controls) can commit a whole new order in one call rather than a series of pairwise swaps. Requires `ordered_ids` to be a complete permutation of `routine_id`'s existing sections — rejecting a stranger id, a duplicate, or an omitted section — since anything less would leave omitted rows at their stale position or collide two rows onto the same `sort_order`.
pub async fn reorder(
    conn: &mut SqliteConnection,
    routine_id: &str,
    ordered_ids: &[String],
) -> Result<Vec<RoutineSection>> {
    let existing = list_by_routine(conn, routine_id).await?;
    let mut remaining: std::collections::HashSet<&str> =
        existing.iter().map(|s| s.id.as_str()).collect();
    for id in ordered_ids {
        if !remaining.remove(id.as_str()) {
            return Err(Error::Validation(format!(
                "routine section {id:?} does not belong to routine {routine_id:?}, or is listed more than once"
            )));
        }
    }
    if !remaining.is_empty() {
        return Err(Error::Validation(format!(
            "reorder for routine {routine_id:?} omits {} existing section(s)",
            remaining.len()
        )));
    }
    let now = chrono::Utc::now().timestamp_millis();
    for (index, id) in ordered_ids.iter().enumerate() {
        let revision = crate::db::next_revision(conn).await?;
        sqlx::query(
            "UPDATE routine_sections SET sort_order = ?, updated_at_ms = ?, revision = ? \
             WHERE id = ?",
        )
        .bind(index as i32 + 1)
        .bind(now)
        .bind(revision)
        .bind(id)
        .execute(&mut *conn)
        .await?;
    }
    list_by_routine(conn, routine_id).await
}

/// A no-op if the section doesn't exist, otherwise records a tombstone. Its supersets/exercises/set-templates cascade via `ON DELETE CASCADE`.
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
    async fn renames_and_clears_a_sections_name() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let routine = super::super::repo::create(&mut conn, "Push day")
            .await
            .unwrap();
        let section = add(&mut conn, &routine.id, Some("Warm-up")).await.unwrap();
        let renamed = rename(&mut conn, &section.id, Some("Main lifts"))
            .await
            .unwrap();
        assert_eq!(renamed.name.as_deref(), Some("Main lifts"));
        let cleared = rename(&mut conn, &section.id, None).await.unwrap();
        assert_eq!(cleared.name, None);
    }

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
    async fn reorder_rewrites_sort_order_to_match_the_given_order() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let routine = super::super::repo::create(&mut conn, "Push day")
            .await
            .unwrap();
        let a = add(&mut conn, &routine.id, Some("A")).await.unwrap();
        let b = add(&mut conn, &routine.id, Some("B")).await.unwrap();
        let c = add(&mut conn, &routine.id, Some("C")).await.unwrap();

        let reordered = reorder(
            &mut conn,
            &routine.id,
            &[b.id.clone(), c.id.clone(), a.id.clone()],
        )
        .await
        .unwrap();
        assert_eq!(
            reordered.iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
            vec![b.id.as_str(), c.id.as_str(), a.id.as_str()]
        );
    }

    #[tokio::test]
    async fn reorder_rejects_a_section_from_another_routine() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let routine = super::super::repo::create(&mut conn, "Push day")
            .await
            .unwrap();
        let other_routine = super::super::repo::create(&mut conn, "Pull day")
            .await
            .unwrap();
        let a = add(&mut conn, &routine.id, Some("A")).await.unwrap();
        let stranger = add(&mut conn, &other_routine.id, Some("X")).await.unwrap();

        let err = reorder(&mut conn, &routine.id, &[a.id.clone(), stranger.id.clone()])
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn reorder_rejects_a_duplicate_id() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let routine = super::super::repo::create(&mut conn, "Push day")
            .await
            .unwrap();
        let a = add(&mut conn, &routine.id, Some("A")).await.unwrap();
        let _b = add(&mut conn, &routine.id, Some("B")).await.unwrap();

        let err = reorder(&mut conn, &routine.id, &[a.id.clone(), a.id.clone()])
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn reorder_rejects_an_incomplete_list() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let routine = super::super::repo::create(&mut conn, "Push day")
            .await
            .unwrap();
        let a = add(&mut conn, &routine.id, Some("A")).await.unwrap();
        let _b = add(&mut conn, &routine.id, Some("B")).await.unwrap();

        let err = reorder(&mut conn, &routine.id, std::slice::from_ref(&a.id))
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
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
