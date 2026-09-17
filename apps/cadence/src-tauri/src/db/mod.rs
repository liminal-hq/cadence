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

    run_migrations(db_path).await?;

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

    Ok(pool)
}

/// Runs the migrator against its own short-lived, single connection with foreign-key enforcement
/// OFF. Some migrations (a `CHECK` constraint change, which SQLite only supports by rebuilding the
/// table) must temporarily drop a table that still has children configured with `ON DELETE
/// CASCADE` — with enforcement on, SQLite treats that `DROP TABLE` as deleting every row in it
/// first, cascading into real data loss for every one of that table's children. `PRAGMA
/// foreign_keys` can only be changed outside a transaction, and sqlx's SQLite driver always runs
/// each migration inside one (it doesn't honour the `-- no-transaction` marker some other
/// backends do), so this has to be a connection that started with enforcement off rather than one
/// toggled mid-migration. The real, long-lived pool `init_pool` hands out afterward reconnects
/// with enforcement back on for actual app use.
async fn run_migrations(db_path: &Path) -> Result<(), Error> {
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(false);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await?;

    MIGRATOR
        .run(&pool)
        .await
        .map_err(|e| Error::Validation(e.to_string()))?;

    pool.close().await;
    Ok(())
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
    // `foreign_keys` defaults off for a bare "sqlite::memory:" connection string, which is
    // exactly what a rebuild-style migration needs while it runs (see `run_migrations`'s doc
    // comment) — enforcement is turned on only *after* migrating, so tests exercise the same
    // enforcement production does for every write path this pool is actually used for.
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open an in-memory sqlite pool");
    MIGRATOR
        .run(&pool)
        .await
        .expect("run migrations against the in-memory db");
    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(&pool)
        .await
        .expect("enable foreign key enforcement on the in-memory db");
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

    /// Regression test for a real data-loss bug caught in review: with foreign-key enforcement on,
    /// SQLite treats 0009's `DROP TABLE workouts` as deleting every row in it first, which fires
    /// `workout_exercises`/`supersets`'s `ON DELETE CASCADE` and destroys every workout's
    /// exercises and sets on any populated database upgrading through it. This brings a
    /// file-backed database up to just before 0009 via a real sub-migrator (so `_sqlx_migrations`
    /// bookkeeping matches a genuine existing install), inserts a realistic logged set, then runs
    /// the actual upgrade path (`run_migrations`) and asserts nothing was lost.
    #[tokio::test]
    async fn upgrading_a_populated_database_preserves_workout_children() {
        let db_path =
            std::env::temp_dir().join(format!("cadence-upgrade-test-{}.db", uuid::Uuid::new_v4()));

        {
            let pre_0009 = sqlx::migrate::Migrator {
                migrations: std::borrow::Cow::Owned(
                    MIGRATOR.iter().filter(|m| m.version < 9).cloned().collect(),
                ),
                ignore_missing: MIGRATOR.ignore_missing,
                locking: MIGRATOR.locking,
                no_tx: MIGRATOR.no_tx,
                create_schemas: MIGRATOR.create_schemas.clone(),
                table_name: MIGRATOR.table_name.clone(),
            };
            let options = SqliteConnectOptions::new()
                .filename(&db_path)
                .create_if_missing(true)
                .foreign_keys(true);
            let pool = SqlitePoolOptions::new()
                .max_connections(1)
                .connect_with(options)
                .await
                .unwrap();
            pre_0009.run(&pool).await.unwrap();

            sqlx::query(
                "INSERT INTO workouts (id, local_date, title, status, source, logged_by_watch, \
                 created_at_ms, updated_at_ms, revision) \
                 VALUES ('w-real', '2026-09-17', 'Push day', 'in-progress', 'manual', 0, 1000, 1000, 1)",
            )
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO workout_exercises (id, workout_id, exercise_id, sort_order, \
                 created_at_ms, updated_at_ms, revision) \
                 VALUES ('we-real', 'w-real', 'ex-bench-press', 1, 1000, 1000, 1)",
            )
            .execute(&pool)
            .await
            .unwrap();
            sqlx::query(
                "INSERT INTO sets (id, workout_id, workout_exercise_id, exercise_id, sort_order, \
                 status, weight_g, reps, created_at_ms, updated_at_ms, revision) \
                 VALUES ('s-real', 'w-real', 'we-real', 'ex-bench-press', 1, 'completed', 60000, \
                 5, 1000, 1000, 1)",
            )
            .execute(&pool)
            .await
            .unwrap();
            pool.close().await;
        }

        // The real upgrade path, exactly as `init_pool` uses it.
        run_migrations(&db_path).await.unwrap();

        let options = SqliteConnectOptions::new()
            .filename(&db_path)
            .foreign_keys(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .unwrap();

        let (status,): (String,) =
            sqlx::query_as("SELECT status FROM workouts WHERE id = 'w-real'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(status, "active");

        let (we_count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM workout_exercises WHERE id = 'we-real'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(
            we_count, 1,
            "upgrading must not cascade-delete existing workout_exercises"
        );

        let (set_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sets WHERE id = 's-real'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(
            set_count, 1,
            "upgrading must not cascade-delete existing sets"
        );

        drop(pool);
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
        let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
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
    async fn rest_timer_accepts_the_elapsed_status() {
        let pool = init_test_pool().await;
        sqlx::query("UPDATE rest_timer SET status = 'elapsed' WHERE id = 1")
            .execute(&pool)
            .await
            .unwrap();
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
