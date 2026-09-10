// Pool construction, migrations, and the two cross-cutting sync primitives (the monotonic
// revision counter and tombstone writes) every mutation path shares.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::path::Path;
use std::time::Duration;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::{SqliteConnection, SqlitePool};

use crate::domain::error::Error;

/// Embedded, checksummed migrations — the only path that ever creates or alters the schema.
/// Unlike Threshold's `ensure_schema`/migrations-list split, there is no second mechanism: every
/// test builds its schema by running this same migrator against `sqlite::memory:`, so drift
/// between "what tests run against" and "what production runs" is structurally impossible.
pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

pub async fn init_pool(db_path: &Path) -> Result<SqlitePool, Error> {
    // `create_if_missing` only creates the database file itself — on a genuinely fresh install
    // the app data directory containing it may not exist yet either.
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| Error::Validation(format!("couldn't create {}: {e}", parent.display())))?;
    }

    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true)
        .busy_timeout(Duration::from_secs(5));

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    MIGRATOR
        .run(&pool)
        .await
        .map_err(|e| Error::Validation(e.to_string()))?;

    Ok(pool)
}

/// Hands out the next monotonic revision for a mutation. Every syncable table's `revision` column
/// and every write path shares this one counter, so a future watch-sync plugin can ask "what
/// changed since revision N" across the whole database, not per table (mirrors Threshold's
/// `wear-sync` protocol, which this same counter shape is designed to eventually feed).
pub async fn next_revision(conn: &mut SqliteConnection) -> Result<i64, Error> {
    let (revision,): (i64,) = sqlx::query_as(
        "UPDATE sync_state SET revision = revision + 1 WHERE id = 1 RETURNING revision",
    )
    .fetch_one(conn)
    .await?;
    Ok(revision)
}

/// Records a delete for future sync reconciliation. `INSERT OR REPLACE` because re-deleting an
/// already-tombstoned entity can't happen in practice, but would just be a newer revision if it did.
pub async fn write_tombstone(
    conn: &mut SqliteConnection,
    entity_type: &str,
    entity_id: &str,
    revision: i64,
    deleted_at_ms: i64,
) -> Result<(), Error> {
    sqlx::query(
        "INSERT OR REPLACE INTO tombstones (entity_type, entity_id, revision, deleted_at_ms) \
         VALUES (?, ?, ?, ?)",
    )
    .bind(entity_type)
    .bind(entity_id)
    .bind(revision)
    .bind(deleted_at_ms)
    .execute(conn)
    .await?;
    Ok(())
}

/// A fresh, fully migrated in-memory database — the only schema-construction path in tests too.
#[cfg(test)]
pub async fn init_test_pool() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open an in-memory sqlite pool");
    MIGRATOR
        .run(&pool)
        .await
        .expect("run migrations against the in-memory db");
    pool
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn init_pool_creates_and_migrates_a_file_backed_database() {
        let db_path =
            std::env::temp_dir().join(format!("cadence-test-{}.db", uuid::Uuid::new_v4()));
        let pool = init_pool(&db_path).await.unwrap();
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM exercises")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(
            count > 0,
            "seed migration should have run against the real file path too"
        );
        drop(pool);
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
        let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    }

    #[tokio::test]
    async fn init_pool_creates_a_missing_parent_directory_on_first_launch() {
        let dir = std::env::temp_dir().join(format!("cadence-test-{}", uuid::Uuid::new_v4()));
        let db_path = dir.join("cadence.db");
        assert!(
            !dir.exists(),
            "precondition: parent directory doesn't exist yet"
        );
        let pool = init_pool(&db_path).await.unwrap();
        drop(pool);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn migrator_runs_cleanly_against_a_fresh_in_memory_database() {
        let pool = init_test_pool().await;
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM exercises")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(count > 0, "seed migration should have inserted exercises");
    }

    #[tokio::test]
    async fn next_revision_increments_monotonically() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let first = next_revision(&mut conn).await.unwrap();
        let second = next_revision(&mut conn).await.unwrap();
        assert_eq!(second, first + 1);
    }

    #[tokio::test]
    async fn write_tombstone_records_a_deletion() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        write_tombstone(&mut conn, "set", "set-1", 5, 1_000)
            .await
            .unwrap();
        let (revision,): (i64,) = sqlx::query_as(
            "SELECT revision FROM tombstones WHERE entity_type = 'set' AND entity_id = 'set-1'",
        )
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(revision, 5);
    }
}
