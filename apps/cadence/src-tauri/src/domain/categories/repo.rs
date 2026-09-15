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

async fn reject_duplicate_name(
    conn: &mut SqliteConnection,
    name: &str,
    excluding_id: Option<&str>,
) -> Result<()> {
    let (count,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM categories WHERE lower(name) = lower(?) AND id IS NOT ?",
    )
    .bind(name)
    .bind(excluding_id.unwrap_or(""))
    .fetch_one(&mut *conn)
    .await?;
    if count > 0 {
        return Err(Error::Validation(format!(
            "a category named {name:?} already exists"
        )));
    }
    Ok(())
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
    let name = name.trim();
    reject_duplicate_name(conn, name, None).await?;
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
    let name = name.trim();
    reject_duplicate_name(conn, name, Some(id)).await?;
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

/// Rewrites every category's `sort_order` to its 1-indexed position in `ordered_ids` — mirrors `routines::sections::reorder`'s complete-permutation guard (a stranger id, a duplicate, or an omitted category are all rejected), since anything less would leave omitted rows at their stale position or collide two rows onto the same `sort_order`.
pub async fn reorder(conn: &mut SqliteConnection, ordered_ids: &[String]) -> Result<Vec<Category>> {
    let existing = list(conn).await?;
    let mut remaining: std::collections::HashSet<&str> =
        existing.iter().map(|c| c.id.as_str()).collect();
    for id in ordered_ids {
        if !remaining.remove(id.as_str()) {
            return Err(Error::Validation(format!(
                "category {id:?} does not exist, or is listed more than once"
            )));
        }
    }
    if !remaining.is_empty() {
        return Err(Error::Validation(format!(
            "reorder omits {} existing category(ies)",
            remaining.len()
        )));
    }
    let now = chrono::Utc::now().timestamp_millis();
    for (index, id) in ordered_ids.iter().enumerate() {
        let revision = crate::db::next_revision(conn).await?;
        sqlx::query(
            "UPDATE categories SET sort_order = ?, updated_at_ms = ?, revision = ? WHERE id = ?",
        )
        .bind(index as i32 + 1)
        .bind(now)
        .bind(revision)
        .bind(id)
        .execute(&mut *conn)
        .await?;
    }
    list(conn).await
}

/// Returns a validation error naming how many exercises still reference `id`, or `Ok(())` if none do. Shared by `set_archived` (only when archiving — unarchiving is always safe) and `delete`, since both are "this category is going away" operations SCREENS.md's P-35 requires exercises to be reassigned away from first.
async fn reject_if_referenced(conn: &mut SqliteConnection, id: &str) -> Result<()> {
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
    Ok(())
}

/// Archiving requires exercises to be reassigned away first, matching `delete`'s own guard — unarchiving never does, since it only makes a hidden category visible again.
pub async fn set_archived(
    conn: &mut SqliteConnection,
    id: &str,
    archived: bool,
) -> Result<Category> {
    if archived {
        reject_if_referenced(conn, id).await?;
    }
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
    reject_if_referenced(conn, id).await?;
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
    async fn rejects_creating_a_category_with_a_duplicate_name_case_insensitively() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = create(&mut conn, "chest-2", "CHEST", "#eee", "#111", "#999")
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn rejects_renaming_a_category_to_match_another_categorys_name() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "grip", "Grip", "#eee", "#111", "#999")
            .await
            .unwrap();
        let err = rename(&mut conn, &created.id, "chest").await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn trims_the_name_before_storing_and_before_the_duplicate_check() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "grip", "  Grip  ", "#eee", "#111", "#999")
            .await
            .unwrap();
        assert_eq!(created.name, "Grip");

        let err = create(&mut conn, "grip-2", "grip ", "#eee", "#111", "#999")
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));

        let renamed = rename(&mut conn, &created.id, "  Grip Strength  ")
            .await
            .unwrap();
        assert_eq!(renamed.name, "Grip Strength");
    }

    #[tokio::test]
    async fn allows_renaming_a_category_to_its_own_current_name() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "grip", "Grip", "#eee", "#111", "#999")
            .await
            .unwrap();
        let renamed = rename(&mut conn, &created.id, "Grip").await.unwrap();
        assert_eq!(renamed.name, "Grip");
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
    async fn archives_and_unarchives_a_category_with_no_exercises() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "grip", "Grip", "#eee", "#111", "#999")
            .await
            .unwrap();
        let archived = set_archived(&mut conn, &created.id, true).await.unwrap();
        assert!(archived.archived);
        let restored = set_archived(&mut conn, &created.id, false).await.unwrap();
        assert!(!restored.archived);
    }

    #[tokio::test]
    async fn refuses_to_archive_a_category_with_exercises_but_allows_unarchiving() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        // "cardio" has ex-running from the starter library seed (0003).
        let err = set_archived(&mut conn, "cardio", true).await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
        // Unarchiving an already-unarchived, referenced category is still fine — it never needs
        // the same guard, since it only makes a hidden category visible again.
        let unarchived = set_archived(&mut conn, "cardio", false).await.unwrap();
        assert!(!unarchived.archived);
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

    #[tokio::test]
    async fn reorder_rewrites_sort_order_to_match_the_given_order() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let mut ids: Vec<String> = list(&mut conn)
            .await
            .unwrap()
            .into_iter()
            .map(|c| c.id)
            .collect();
        ids.swap(0, 1);
        let reordered = reorder(&mut conn, &ids).await.unwrap();
        assert_eq!(
            reordered.iter().map(|c| c.id.as_str()).collect::<Vec<_>>(),
            ids.iter().map(String::as_str).collect::<Vec<_>>()
        );
    }

    #[tokio::test]
    async fn reorder_rejects_an_incomplete_list() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = reorder(&mut conn, &["chest".to_string()])
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn reorder_rejects_a_duplicate_id() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let mut ids: Vec<String> = list(&mut conn)
            .await
            .unwrap()
            .into_iter()
            .map(|c| c.id)
            .collect();
        ids[1] = ids[0].clone();
        let err = reorder(&mut conn, &ids).await.unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }
}
