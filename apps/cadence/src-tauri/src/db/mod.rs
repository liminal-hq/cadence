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

/// Migrations that must run with foreign-key enforcement OFF — currently only the
/// workout-lifecycle-status rebuild, which needs to temporarily drop a table (`workouts`) that
/// still has children configured with `ON DELETE CASCADE`: with enforcement on, SQLite treats that
/// `DROP TABLE` as deleting every row in it first, cascading into real data loss for every one of
/// that table's children. Every other migration keeps enforcement on, matching production — a
/// migration like 0004's demo-data cleanup relies on `ON DELETE CASCADE` to remove its own
/// children, and running it with enforcement off would silently orphan them instead. Adding a
/// migration to this list is opt-in: a future rebuild-style migration needs to be added here
/// explicitly, the same way 9 was.
const FK_OFF_MIGRATION_VERSIONS: &[i64] = &[9];

/// Builds a `Migrator` over a subset of `MIGRATOR`'s migrations, keeping every other field
/// identical (`Migrator` doesn't derive `Clone`, so this copies each field by hand) except
/// `ignore_missing`, which is forced on: `Migrator::run` otherwise rejects any database where a
/// migration recorded in `_sqlx_migrations` is absent from this migrator's own (partial) list —
/// exactly what running a subset against a database another subset already partly migrated does.
fn filtered_migrator(keep: impl Fn(i64) -> bool) -> sqlx::migrate::Migrator {
    sqlx::migrate::Migrator {
        migrations: std::borrow::Cow::Owned(
            MIGRATOR
                .iter()
                .filter(|m| keep(m.version))
                .cloned()
                .collect(),
        ),
        ignore_missing: true,
        locking: MIGRATOR.locking,
        no_tx: MIGRATOR.no_tx,
        create_schemas: MIGRATOR.create_schemas.clone(),
        table_name: MIGRATOR.table_name.clone(),
    }
}

/// Runs one migration subset against its own short-lived, single connection opened with the given
/// foreign-key setting from the start — `PRAGMA foreign_keys` can only be changed outside a
/// transaction, and sqlx's SQLite driver always runs each migration inside one (it doesn't honour
/// the `-- no-transaction` marker some other backends do), so enforcement has to be fixed for the
/// whole connection rather than toggled mid-migration.
async fn run_migration_subset(
    db_path: &Path,
    foreign_keys: bool,
    keep: impl Fn(i64) -> bool,
) -> Result<(), Error> {
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(foreign_keys);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await?;

    filtered_migrator(keep)
        .run(&pool)
        .await
        .map_err(|e| Error::Validation(e.to_string()))?;

    pool.close().await;
    Ok(())
}

/// Runs the full migrator in two passes so each migration keeps the foreign-key enforcement it was
/// actually written against: everything except `FK_OFF_MIGRATION_VERSIONS` runs with enforcement
/// on (matching production, so a migration relying on `ON DELETE CASCADE` still gets it), then
/// that small subset runs with enforcement off (see its doc comment for why). The real, long-lived
/// pool `init_pool` hands out afterward reconnects with enforcement back on for actual app use.
async fn run_migrations(db_path: &Path) -> Result<(), Error> {
    run_migration_subset(db_path, true, |v| !FK_OFF_MIGRATION_VERSIONS.contains(&v)).await?;
    run_migration_subset(db_path, false, |v| FK_OFF_MIGRATION_VERSIONS.contains(&v)).await?;
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
/// Mirrors `run_migrations`'s two-phase split for the same reason: an in-memory connection can't
/// be closed and reopened between phases the way the file-backed production path does (a second
/// `sqlite::memory:` connection would be a distinct, empty database), so this toggles the pragma
/// directly on the one connection the pool ever hands out — safe here because each phase's
/// `Migrator::run` finishes (and commits) before the next pragma change, so it's never mid-transaction.
#[cfg(test)]
pub async fn init_test_pool() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open an in-memory sqlite pool");

    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(&pool)
        .await
        .expect("enable foreign key enforcement for the ordinary migrations");
    filtered_migrator(|v| !FK_OFF_MIGRATION_VERSIONS.contains(&v))
        .run(&pool)
        .await
        .expect("run the ordinary migrations against the in-memory db");

    sqlx::query("PRAGMA foreign_keys = OFF;")
        .execute(&pool)
        .await
        .expect("disable foreign key enforcement for the rebuild migration");
    filtered_migrator(|v| FK_OFF_MIGRATION_VERSIONS.contains(&v))
        .run(&pool)
        .await
        .expect("run the rebuild migration against the in-memory db");

    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(&pool)
        .await
        .expect("re-enable foreign key enforcement for actual test use");
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
            let pre_0009 = filtered_migrator(|v| v < 9);
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

    /// Regression test for a second data-integrity bug caught in review, introduced by the first
    /// fix above: running the *entire* migrator with foreign-key enforcement off (rather than just
    /// 0009) meant a fresh install's 0004 migration — whose `DELETE FROM workouts` relies on
    /// `ON DELETE CASCADE` to clean up the demo workouts' own `workout_exercises`/`sets`/
    /// `supersets` — silently orphaned all of them instead, since cascades don't fire with
    /// enforcement off. This runs the real fresh-install path end to end and asserts every
    /// `workout_exercises`/`sets`/`supersets` row still points at a workout that actually exists.
    #[tokio::test]
    async fn a_fresh_install_leaves_no_orphaned_workout_children() {
        let db_path =
            std::env::temp_dir().join(format!("cadence-fresh-test-{}.db", uuid::Uuid::new_v4()));

        run_migrations(&db_path).await.unwrap();

        let options = SqliteConnectOptions::new()
            .filename(&db_path)
            .foreign_keys(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .unwrap();

        let (orphaned_workout_exercises,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM workout_exercises WHERE workout_id NOT IN (SELECT id FROM workouts)",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(
            orphaned_workout_exercises, 0,
            "workout_exercises has rows pointing at a deleted workout"
        );

        let (orphaned_sets,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sets WHERE workout_id NOT IN (SELECT id FROM workouts)",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(
            orphaned_sets, 0,
            "sets has rows pointing at a deleted workout"
        );

        let (orphaned_supersets,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM supersets WHERE workout_id NOT IN (SELECT id FROM workouts)",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(
            orphaned_supersets, 0,
            "supersets has rows pointing at a deleted workout"
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
