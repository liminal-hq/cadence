// Row mapping and persistence for barbell/plate configs
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::{BarbellConfig, NewBarbellConfig};
use crate::domain::error::{Error, Result};
use crate::domain::units::{milli_to_unit, unit_to_milli};

#[derive(FromRow)]
struct BarbellRow {
    id: String,
    name: String,
    display_unit: String,
    bar_weight_milli: i64,
    plates_json: String,
    is_default: i64,
}

impl From<BarbellRow> for BarbellConfig {
    fn from(row: BarbellRow) -> Self {
        let plates_milli: Vec<i64> = serde_json::from_str(&row.plates_json).unwrap_or_default();
        BarbellConfig {
            id: row.id,
            name: row.name,
            bar_weight: milli_to_unit(row.bar_weight_milli),
            display_unit: row.display_unit,
            available_plates: plates_milli.into_iter().map(milli_to_unit).collect(),
            is_default: row.is_default != 0,
        }
    }
}

const SELECT_ALL: &str = "SELECT id, name, display_unit, bar_weight_milli, plates_json, \
     is_default FROM barbell_configs ORDER BY name";

pub async fn list(conn: &mut SqliteConnection) -> Result<Vec<BarbellConfig>> {
    let rows: Vec<BarbellRow> = sqlx::query_as(SELECT_ALL).fetch_all(conn).await?;
    Ok(rows.into_iter().map(BarbellConfig::from).collect())
}

async fn get(conn: &mut SqliteConnection, id: &str) -> Result<BarbellConfig> {
    let row: BarbellRow = sqlx::query_as(
        "SELECT id, name, display_unit, bar_weight_milli, plates_json, is_default \
         FROM barbell_configs WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| Error::NotFound {
        entity: "barbell config",
        id: id.to_string(),
    })?;
    Ok(row.into())
}

/// Setting `is_default: true` clears it on every other config — at most one default at a time.
/// Bumps `revision`/`updated_at_ms` on whatever row this flips, same as any other mutation.
async fn clear_other_defaults(conn: &mut SqliteConnection, except_id: &str) -> Result<()> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "UPDATE barbell_configs SET is_default = 0, updated_at_ms = ?, revision = ? \
         WHERE id != ? AND is_default = 1",
    )
    .bind(now)
    .bind(revision)
    .bind(except_id)
    .execute(conn)
    .await?;
    Ok(())
}

async fn exists(conn: &mut SqliteConnection, id: &str) -> Result<bool> {
    let row: Option<(i64,)> = sqlx::query_as("SELECT 1 FROM barbell_configs WHERE id = ?")
        .bind(id)
        .fetch_optional(conn)
        .await?;
    Ok(row.is_some())
}

fn to_plates_json(plates: &[f64]) -> String {
    let milli: Vec<i64> = plates.iter().map(|&p| unit_to_milli(p)).collect();
    serde_json::to_string(&milli).expect("plate list serializes")
}

pub async fn add(conn: &mut SqliteConnection, config: &NewBarbellConfig) -> Result<BarbellConfig> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    // Clear any existing default *before* inserting — the partial unique index on is_default
    // allows only one row at a time, so inserting a second default first would violate it.
    if config.is_default {
        clear_other_defaults(conn, &id).await?;
    }
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "INSERT INTO barbell_configs (id, name, display_unit, bar_weight_milli, plates_json, \
         is_default, created_at_ms, updated_at_ms, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&config.name)
    .bind(&config.display_unit)
    .bind(unit_to_milli(config.bar_weight))
    .bind(to_plates_json(&config.available_plates))
    .bind(config.is_default)
    .bind(now)
    .bind(now)
    .bind(revision)
    .execute(&mut *conn)
    .await?;
    get(conn, &id).await
}

pub async fn update(conn: &mut SqliteConnection, config: &BarbellConfig) -> Result<BarbellConfig> {
    // Verify the target exists *before* clearing anyone else's default — otherwise a stale/
    // unknown id would clear the real default, then fail the UPDATE below, leaving every config
    // non-default even though nothing was actually changed.
    if !exists(conn, &config.id).await? {
        return Err(Error::NotFound {
            entity: "barbell config",
            id: config.id.clone(),
        });
    }
    let now = chrono::Utc::now().timestamp_millis();
    // Same ordering constraint as `add`: clear the old default before this row claims it.
    if config.is_default {
        clear_other_defaults(conn, &config.id).await?;
    }
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE barbell_configs SET name = ?, display_unit = ?, bar_weight_milli = ?, \
         plates_json = ?, is_default = ?, updated_at_ms = ?, revision = ? WHERE id = ?",
    )
    .bind(&config.name)
    .bind(&config.display_unit)
    .bind(unit_to_milli(config.bar_weight))
    .bind(to_plates_json(&config.available_plates))
    .bind(config.is_default)
    .bind(now)
    .bind(revision)
    .bind(&config.id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "barbell config",
            id: config.id.clone(),
        });
    }
    get(conn, &config.id).await
}

/// Never lets the list reach zero — mirrors the mock's own no-op-on-last-config guard, since
/// the plate calculator and every set editor's Plates chip assume at least one config exists.
pub async fn delete(conn: &mut SqliteConnection, id: &str) -> Result<()> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM barbell_configs")
        .fetch_one(&mut *conn)
        .await?;
    if count <= 1 {
        return Ok(());
    }
    let result = sqlx::query("DELETE FROM barbell_configs WHERE id = ?")
        .bind(id)
        .execute(&mut *conn)
        .await?;
    if result.rows_affected() > 0 {
        let revision = crate::db::next_revision(conn).await?;
        let now = chrono::Utc::now().timestamp_millis();
        crate::db::write_tombstone(conn, "barbell_config", id, revision, now).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    #[tokio::test]
    async fn lists_seeded_configs_with_units_converted() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let configs = list(&mut conn).await.unwrap();
        assert_eq!(configs.len(), 2);
        let olympic = configs.iter().find(|c| c.name == "Olympic").unwrap();
        assert_eq!(olympic.bar_weight, 20.0);
        assert_eq!(olympic.display_unit, "kg");
        assert_eq!(
            olympic.available_plates,
            vec![25.0, 20.0, 15.0, 10.0, 5.0, 2.5, 1.25]
        );
        assert!(olympic.is_default);
    }

    #[tokio::test]
    async fn adding_a_default_clears_the_previous_default() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let new_config = NewBarbellConfig {
            name: "Trap bar".to_string(),
            bar_weight: 25.0,
            display_unit: "kg".to_string(),
            available_plates: vec![20.0, 10.0],
            is_default: true,
        };
        let added = add(&mut conn, &new_config).await.unwrap();
        assert!(added.is_default);
        let configs = list(&mut conn).await.unwrap();
        let olympic = configs.iter().find(|c| c.name == "Olympic").unwrap();
        assert!(!olympic.is_default);
        assert_eq!(configs.iter().filter(|c| c.is_default).count(), 1);
    }

    #[tokio::test]
    async fn rejects_updating_an_unknown_config() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let phantom = BarbellConfig {
            id: "no-such-barbell".to_string(),
            name: "Ghost".to_string(),
            bar_weight: 20.0,
            display_unit: "kg".to_string(),
            available_plates: vec![],
            is_default: false,
        };
        let err = update(&mut conn, &phantom).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }

    #[tokio::test]
    async fn an_unknown_target_default_never_clears_the_real_default() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let phantom = BarbellConfig {
            id: "no-such-barbell".to_string(),
            name: "Ghost".to_string(),
            bar_weight: 20.0,
            display_unit: "kg".to_string(),
            available_plates: vec![],
            is_default: true,
        };
        let err = update(&mut conn, &phantom).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
        // The real default survives the failed update — not left with zero defaults.
        let configs = list(&mut conn).await.unwrap();
        assert_eq!(configs.iter().filter(|c| c.is_default).count(), 1);
        assert!(
            configs
                .iter()
                .find(|c| c.name == "Olympic")
                .unwrap()
                .is_default
        );
    }

    #[tokio::test]
    async fn clearing_the_previous_default_bumps_its_revision() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let (revision_before,): (i64,) =
            sqlx::query_as("SELECT revision FROM barbell_configs WHERE id = 'barbell-olympic'")
                .fetch_one(&mut *conn)
                .await
                .unwrap();
        let new_config = NewBarbellConfig {
            name: "Trap bar".to_string(),
            bar_weight: 25.0,
            display_unit: "kg".to_string(),
            available_plates: vec![20.0, 10.0],
            is_default: true,
        };
        add(&mut conn, &new_config).await.unwrap();
        let (revision_after,): (i64,) =
            sqlx::query_as("SELECT revision FROM barbell_configs WHERE id = 'barbell-olympic'")
                .fetch_one(&mut *conn)
                .await
                .unwrap();
        assert!(revision_after > revision_before);
    }

    #[tokio::test]
    async fn deleting_down_to_the_last_config_is_a_no_op() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        delete(&mut conn, "barbell-standard").await.unwrap();
        assert_eq!(list(&mut conn).await.unwrap().len(), 1);
        // The last remaining config survives even though it's explicitly targeted.
        delete(&mut conn, "barbell-olympic").await.unwrap();
        assert_eq!(list(&mut conn).await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn deleting_records_a_tombstone_when_it_actually_removes_a_row() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        delete(&mut conn, "barbell-standard").await.unwrap();
        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tombstones WHERE entity_type = 'barbell_config' AND entity_id = 'barbell-standard'",
        )
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(count, 1);
    }
}
