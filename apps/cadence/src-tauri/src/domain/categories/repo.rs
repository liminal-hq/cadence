// Row mapping and persistence for exercise categories
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::Category;
use crate::domain::error::{Error, Result};

#[derive(FromRow)]
struct CategoryRow {
    id: String,
    name: String,
    colour_background: String,
    colour_text: String,
    colour_dot: String,
    sort_order: i32,
    archived: i64,
}

impl From<CategoryRow> for Category {
    fn from(row: CategoryRow) -> Self {
        Category {
            id: row.id,
            name: row.name,
            colour_background: row.colour_background,
            colour_text: row.colour_text,
            colour_dot: row.colour_dot,
            sort_order: row.sort_order,
            archived: row.archived != 0,
        }
    }
}

const SELECT_BY_ID: &str = "SELECT id, name, colour_background, colour_text, colour_dot, \
     sort_order, archived FROM categories WHERE id = ?";

const SELECT_ALL: &str = "SELECT id, name, colour_background, colour_text, colour_dot, \
     sort_order, archived FROM categories ORDER BY sort_order, id";

pub async fn get(conn: &mut SqliteConnection, id: &str) -> Result<Category> {
    let row: CategoryRow = sqlx::query_as(SELECT_BY_ID)
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| Error::NotFound {
            entity: "category",
            id: id.to_string(),
        })?;
    Ok(row.into())
}

/// Every category, archived or not — the category editor (P-35) is responsible for filtering, same division of labour as `exercises::repo::list`.
pub async fn list(conn: &mut SqliteConnection) -> Result<Vec<Category>> {
    let rows: Vec<CategoryRow> = sqlx::query_as(SELECT_ALL).fetch_all(conn).await?;
    Ok(rows.into_iter().map(Category::from).collect())
}

/// The id is a lowercase, hyphenated slug derived from `name` at the call site (Coordinator), not a random UUID — every other entity in this crate uses opaque UUIDs, but categories are already referenced by human-legible slugs (`"chest"`, `"back"`, ...) throughout the seeded exercise library and the frontend's `CATEGORY_COLOURS` map, so a freshly created category keeps that convention rather than introducing a second addressing scheme.
pub async fn create(
    conn: &mut SqliteConnection,
    id: &str,
    name: &str,
    colour_background: &str,
    colour_text: &str,
    colour_dot: &str,
) -> Result<Category> {
    let existing = list(conn).await?;
    if existing.iter().any(|c| c.id == id) {
        return Err(Error::Validation(format!(
            "a category with id {id:?} already exists"
        )));
    }
    let next_order = existing.iter().map(|c| c.sort_order).max().unwrap_or(0) + 1;
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "INSERT INTO categories (id, name, colour_background, colour_text, colour_dot, \
         sort_order, archived, created_at_ms, updated_at_ms, revision) \
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)",
    )
    .bind(id)
    .bind(name)
    .bind(colour_background)
    .bind(colour_text)
    .bind(colour_dot)
    .bind(next_order)
    .bind(now)
    .bind(now)
    .bind(revision)
    .execute(&mut *conn)
    .await?;
    get(conn, id).await
}

pub async fn rename(conn: &mut SqliteConnection, id: &str, name: &str) -> Result<Category> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result =
        sqlx::query("UPDATE categories SET name = ?, updated_at_ms = ?, revision = ? WHERE id = ?")
            .bind(name)
            .bind(now)
            .bind(revision)
            .bind(id)
            .execute(&mut *conn)
            .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "category",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

pub async fn recolour(
    conn: &mut SqliteConnection,
    id: &str,
    colour_background: &str,
    colour_text: &str,
    colour_dot: &str,
) -> Result<Category> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE categories SET colour_background = ?, colour_text = ?, colour_dot = ?, \
         updated_at_ms = ?, revision = ? WHERE id = ?",
    )
    .bind(colour_background)
    .bind(colour_text)
    .bind(colour_dot)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "category",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

pub async fn set_archived(
    conn: &mut SqliteConnection,
    id: &str,
    archived: bool,
) -> Result<Category> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE categories SET archived = ?, updated_at_ms = ?, revision = ? WHERE id = ?",
    )
    .bind(archived)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "category",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

/// Rejects deleting a category any exercise still references, rather than letting the database's own foreign-key constraint surface as an opaque `Db` error — P-35's "reassign exercises before archival/deletion" means the caller is expected to move exercises to another category (or archive the category instead) before this can succeed.
pub async fn delete(conn: &mut SqliteConnection, id: &str) -> Result<()> {
    let (exercise_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM exercises WHERE category_id = ?")
            .bind(id)
            .fetch_one(&mut *conn)
            .await?;
    if exercise_count > 0 {
        return Err(Error::Validation(format!(
            "category {id:?} still has {exercise_count} exercise(s) — reassign them first"
        )));
    }
    let result = sqlx::query("DELETE FROM categories WHERE id = ?")
        .bind(id)
        .execute(&mut *conn)
        .await?;
    if result.rows_affected() > 0 {
        let revision = crate::db::next_revision(conn).await?;
        let now = chrono::Utc::now().timestamp_millis();
        crate::db::write_tombstone(conn, "category", id, revision, now).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    #[tokio::test]
    async fn lists_every_seeded_category() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let categories = list(&mut conn).await.unwrap();
        assert_eq!(categories.len(), 8);
        assert_eq!(categories[0].id, "chest");
        assert!(!categories[0].archived);
    }

    #[tokio::test]
    async fn gets_a_seeded_category() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let category = get(&mut conn, "chest").await.unwrap();
        assert_eq!(category.name, "Chest");
        assert_eq!(category.colour_dot, "#a83a4c");
    }

    #[tokio::test]
    async fn rejects_an_unknown_category_id() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = get(&mut conn, "no-such-category").await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }

    #[tokio::test]
    async fn creates_a_category_appending_at_the_end_of_the_order() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "grip", "Grip", "#eee", "#111", "#999")
            .await
            .unwrap();
        // 8 seeded categories use sort_order 0-7 (0002_seed_defaults.sql).
        assert_eq!(created.sort_order, 8);
        assert!(!created.archived);
    }

    #[tokio::test]
    async fn rejects_creating_a_category_with_a_duplicate_id() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = create(&mut conn, "chest", "Chest Again", "#eee", "#111", "#999")
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn renames_and_recolours_a_category() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "grip", "Grip", "#eee", "#111", "#999")
            .await
            .unwrap();
        let renamed = rename(&mut conn, &created.id, "Grip Strength")
            .await
            .unwrap();
        assert_eq!(renamed.name, "Grip Strength");
        let recoloured = recolour(&mut conn, &created.id, "#aaa", "#bbb", "#ccc")
            .await
            .unwrap();
        assert_eq!(recoloured.colour_background, "#aaa");
    }

    #[tokio::test]
    async fn archives_and_unarchives_a_category() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let archived = set_archived(&mut conn, "cardio", true).await.unwrap();
        assert!(archived.archived);
        let restored = set_archived(&mut conn, "cardio", false).await.unwrap();
        assert!(!restored.archived);
    }

    #[tokio::test]
    async fn refuses_to_delete_a_category_with_exercises() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = delete(&mut conn, "chest").await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
        // Still there.
        get(&mut conn, "chest").await.unwrap();
    }

    #[tokio::test]
    async fn deletes_an_empty_category_and_records_a_tombstone() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "grip", "Grip", "#eee", "#111", "#999")
            .await
            .unwrap();
        delete(&mut conn, &created.id).await.unwrap();
        let err = get(&mut conn, &created.id).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tombstones WHERE entity_type = 'category' AND entity_id = ?",
        )
        .bind(&created.id)
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn deleting_an_unknown_category_is_a_silent_no_op() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        delete(&mut conn, "no-such-category").await.unwrap();
    }
}
