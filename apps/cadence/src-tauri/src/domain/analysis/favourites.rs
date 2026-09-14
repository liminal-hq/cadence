// Row mapping and persistence for analysis favourites — a pinned P-47 breakdown configuration.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::AnalysisFavourite;
use crate::domain::error::{Error, Result};

#[derive(FromRow)]
struct FavouriteRow {
    id: String,
    name: String,
    config: String,
    sort_order: i32,
}

impl From<FavouriteRow> for AnalysisFavourite {
    fn from(row: FavouriteRow) -> Self {
        AnalysisFavourite {
            id: row.id,
            name: row.name,
            config: row.config,
            sort_order: row.sort_order,
        }
    }
}

const SELECT_BY_ID: &str =
    "SELECT id, name, config, sort_order FROM analysis_favourites WHERE id = ?";

const SELECT_ALL: &str =
    "SELECT id, name, config, sort_order FROM analysis_favourites ORDER BY sort_order, id";

pub async fn get(conn: &mut SqliteConnection, id: &str) -> Result<AnalysisFavourite> {
    let row: FavouriteRow = sqlx::query_as(SELECT_BY_ID)
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| Error::NotFound {
            entity: "analysis favourite",
            id: id.to_string(),
        })?;
    Ok(row.into())
}

pub async fn list(conn: &mut SqliteConnection) -> Result<Vec<AnalysisFavourite>> {
    let rows: Vec<FavouriteRow> = sqlx::query_as(SELECT_ALL).fetch_all(conn).await?;
    Ok(rows.into_iter().map(AnalysisFavourite::from).collect())
}

/// `config` is an opaque JSON blob (the period/metric/group-by the frontend pinned) — this layer never parses it, only stores and returns it verbatim.
pub async fn create(
    conn: &mut SqliteConnection,
    name: &str,
    config: &str,
) -> Result<AnalysisFavourite> {
    let existing = list(conn).await?;
    let next_order = existing.iter().map(|f| f.sort_order).max().unwrap_or(0) + 1;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "INSERT INTO analysis_favourites (id, name, config, sort_order, created_at_ms, \
         updated_at_ms, revision) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(name)
    .bind(config)
    .bind(next_order)
    .bind(now)
    .bind(now)
    .bind(revision)
    .execute(&mut *conn)
    .await?;
    get(conn, &id).await
}

pub async fn update(
    conn: &mut SqliteConnection,
    id: &str,
    name: &str,
    config: &str,
) -> Result<AnalysisFavourite> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE analysis_favourites SET name = ?, config = ?, updated_at_ms = ?, revision = ? \
         WHERE id = ?",
    )
    .bind(name)
    .bind(config)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "analysis favourite",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

/// Rewrites every favourite's `sort_order` to its 1-indexed position in `ordered_ids` — mirrors `routines::sections::reorder`'s complete-permutation guard (a stranger id, a duplicate, or an omitted favourite are all rejected).
pub async fn reorder(
    conn: &mut SqliteConnection,
    ordered_ids: &[String],
) -> Result<Vec<AnalysisFavourite>> {
    let existing = list(conn).await?;
    let mut remaining: std::collections::HashSet<&str> =
        existing.iter().map(|f| f.id.as_str()).collect();
    for id in ordered_ids {
        if !remaining.remove(id.as_str()) {
            return Err(Error::Validation(format!(
                "analysis favourite {id:?} does not exist, or is listed more than once"
            )));
        }
    }
    if !remaining.is_empty() {
        return Err(Error::Validation(format!(
            "reorder omits {} existing favourite(s)",
            remaining.len()
        )));
    }
    let now = chrono::Utc::now().timestamp_millis();
    for (index, id) in ordered_ids.iter().enumerate() {
        let revision = crate::db::next_revision(conn).await?;
        sqlx::query(
            "UPDATE analysis_favourites SET sort_order = ?, updated_at_ms = ?, revision = ? \
             WHERE id = ?",
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

/// A no-op if the favourite doesn't exist, otherwise records a tombstone — unpinning a favourite doesn't touch any workout data, so no reject-if-referenced guard applies.
pub async fn delete(conn: &mut SqliteConnection, id: &str) -> Result<()> {
    let result = sqlx::query("DELETE FROM analysis_favourites WHERE id = ?")
        .bind(id)
        .execute(&mut *conn)
        .await?;
    if result.rows_affected() > 0 {
        let revision = crate::db::next_revision(conn).await?;
        let now = chrono::Utc::now().timestamp_millis();
        crate::db::write_tombstone(conn, "analysis_favourite", id, revision, now).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    #[tokio::test]
    async fn creates_a_favourite_appending_at_the_end_of_the_order() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "Monthly volume", r#"{"metric":"volume"}"#)
            .await
            .unwrap();
        assert_eq!(created.sort_order, 1);
        assert_eq!(created.config, r#"{"metric":"volume"}"#);
    }

    #[tokio::test]
    async fn rejects_getting_an_unknown_favourite() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = get(&mut conn, "no-such-favourite").await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }

    #[tokio::test]
    async fn updates_a_favourite_in_place() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "Monthly volume", r#"{"metric":"volume"}"#)
            .await
            .unwrap();
        let updated = update(
            &mut conn,
            &created.id,
            "Weekly volume",
            r#"{"metric":"volume"}"#,
        )
        .await
        .unwrap();
        assert_eq!(updated.name, "Weekly volume");
    }

    #[tokio::test]
    async fn rejects_updating_an_unknown_favourite() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = update(&mut conn, "no-such-favourite", "x", "{}")
            .await
            .unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }

    #[tokio::test]
    async fn reorder_rejects_an_incomplete_list() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        create(&mut conn, "A", "{}").await.unwrap();
        create(&mut conn, "B", "{}").await.unwrap();
        let err = reorder(&mut conn, &["missing-id".to_string()])
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn reorder_rewrites_sort_order_to_match_the_given_order() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let a = create(&mut conn, "A", "{}").await.unwrap();
        let b = create(&mut conn, "B", "{}").await.unwrap();
        let reordered = reorder(&mut conn, &[b.id.clone(), a.id.clone()])
            .await
            .unwrap();
        assert_eq!(
            reordered.iter().map(|f| f.id.as_str()).collect::<Vec<_>>(),
            vec![b.id.as_str(), a.id.as_str()]
        );
    }

    #[tokio::test]
    async fn deletes_a_favourite_and_records_a_tombstone() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "Monthly volume", "{}").await.unwrap();
        delete(&mut conn, &created.id).await.unwrap();
        let err = get(&mut conn, &created.id).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tombstones WHERE entity_type = 'analysis_favourite' \
             AND entity_id = ?",
        )
        .bind(&created.id)
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn deleting_an_unknown_favourite_is_a_silent_no_op() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        delete(&mut conn, "no-such-favourite").await.unwrap();
    }
}
