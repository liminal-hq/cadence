// Row mapping and persistence for measurement definitions.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::MeasurementDefinition;
use crate::domain::error::{Error, Result};
use crate::domain::units::{milli_to_unit, unit_to_milli};

#[derive(FromRow)]
struct DefinitionRow {
    id: String,
    name: String,
    unit: String,
    goal_milli: Option<i64>,
    sort_order: i32,
    archived: i64,
}

impl From<DefinitionRow> for MeasurementDefinition {
    fn from(row: DefinitionRow) -> Self {
        MeasurementDefinition {
            id: row.id,
            name: row.name,
            unit: row.unit,
            goal: row.goal_milli.map(milli_to_unit),
            sort_order: row.sort_order,
            archived: row.archived != 0,
        }
    }
}

const SELECT_BY_ID: &str = "SELECT id, name, unit, goal_milli, sort_order, archived \
     FROM measurement_definitions WHERE id = ?";

const SELECT_ALL: &str = "SELECT id, name, unit, goal_milli, sort_order, archived \
     FROM measurement_definitions ORDER BY sort_order, id";

pub async fn get(conn: &mut SqliteConnection, id: &str) -> Result<MeasurementDefinition> {
    let row: DefinitionRow = sqlx::query_as(SELECT_BY_ID)
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| Error::NotFound {
            entity: "measurement definition",
            id: id.to_string(),
        })?;
    Ok(row.into())
}

/// Every definition, archived (disabled) or not — the measurement tracker (P-49) is responsible for filtering to enabled-only.
pub async fn list(conn: &mut SqliteConnection) -> Result<Vec<MeasurementDefinition>> {
    let rows: Vec<DefinitionRow> = sqlx::query_as(SELECT_ALL).fetch_all(conn).await?;
    Ok(rows.into_iter().map(MeasurementDefinition::from).collect())
}

pub async fn create(
    conn: &mut SqliteConnection,
    name: &str,
    unit: &str,
) -> Result<MeasurementDefinition> {
    let existing = list(conn).await?;
    let next_order = existing.iter().map(|d| d.sort_order).max().unwrap_or(0) + 1;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "INSERT INTO measurement_definitions (id, name, unit, sort_order, archived, \
         created_at_ms, updated_at_ms, revision) VALUES (?, ?, ?, ?, 0, ?, ?, ?)",
    )
    .bind(&id)
    .bind(name)
    .bind(unit)
    .bind(next_order)
    .bind(now)
    .bind(now)
    .bind(revision)
    .execute(&mut *conn)
    .await?;
    get(conn, &id).await
}

/// Rejects a unit change once records exist, or once the definition already carries a goal — both `measurement_records.value_milli` and `measurement_definitions.goal_milli` store a bare value with no unit of their own, so silently reinterpreting either under a new unit (e.g. kg becoming lb) would make its displayed value wrong.
pub async fn update(
    conn: &mut SqliteConnection,
    id: &str,
    name: &str,
    unit: &str,
    goal: Option<f64>,
) -> Result<MeasurementDefinition> {
    let current = get(conn, id).await?;
    if current.unit != unit {
        if current.goal.is_some() {
            return Err(Error::Validation(format!(
                "measurement definition {id:?} has a goal set and can't change unit"
            )));
        }
        let (record_count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM measurement_records WHERE definition_id = ?")
                .bind(id)
                .fetch_one(&mut *conn)
                .await?;
        if record_count > 0 {
            return Err(Error::Validation(format!(
                "measurement definition {id:?} has recorded values and can't change unit"
            )));
        }
    }
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE measurement_definitions SET name = ?, unit = ?, goal_milli = ?, \
         updated_at_ms = ?, revision = ? WHERE id = ?",
    )
    .bind(name)
    .bind(unit)
    .bind(goal.map(unit_to_milli))
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "measurement definition",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

pub async fn set_archived(
    conn: &mut SqliteConnection,
    id: &str,
    archived: bool,
) -> Result<MeasurementDefinition> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE measurement_definitions SET archived = ?, updated_at_ms = ?, revision = ? \
         WHERE id = ?",
    )
    .bind(archived)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "measurement definition",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

/// Rewrites every definition's `sort_order` to its 1-indexed position in `ordered_ids` — mirrors `routines::sections::reorder`'s complete-permutation guard (a stranger id, a duplicate, or an omitted definition are all rejected).
pub async fn reorder(
    conn: &mut SqliteConnection,
    ordered_ids: &[String],
) -> Result<Vec<MeasurementDefinition>> {
    let existing = list(conn).await?;
    let mut remaining: std::collections::HashSet<&str> =
        existing.iter().map(|d| d.id.as_str()).collect();
    for id in ordered_ids {
        if !remaining.remove(id.as_str()) {
            return Err(Error::Validation(format!(
                "measurement definition {id:?} does not exist, or is listed more than once"
            )));
        }
    }
    if !remaining.is_empty() {
        return Err(Error::Validation(format!(
            "reorder omits {} existing definition(s)",
            remaining.len()
        )));
    }
    let now = chrono::Utc::now().timestamp_millis();
    for (index, id) in ordered_ids.iter().enumerate() {
        let revision = crate::db::next_revision(conn).await?;
        sqlx::query(
            "UPDATE measurement_definitions SET sort_order = ?, updated_at_ms = ?, revision = ? \
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

/// A no-op if the definition doesn't exist, otherwise records a tombstone. Its records cascade via the schema's `ON DELETE CASCADE` — unlike categories/exercises, a measurement record isn't durable training history, so no reject-if-referenced guard applies here; archiving is the encouraged reversible path (SPEC.md 8.8: "all definitions remain editable").
pub async fn delete(conn: &mut SqliteConnection, id: &str) -> Result<()> {
    let result = sqlx::query("DELETE FROM measurement_definitions WHERE id = ?")
        .bind(id)
        .execute(&mut *conn)
        .await?;
    if result.rows_affected() > 0 {
        let revision = crate::db::next_revision(conn).await?;
        let now = chrono::Utc::now().timestamp_millis();
        crate::db::write_tombstone(conn, "measurement_definition", id, revision, now).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    #[tokio::test]
    async fn lists_the_seeded_measurement_suggestions_archived_by_default() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let definitions = list(&mut conn).await.unwrap();
        assert_eq!(definitions.len(), 7);
        assert!(definitions.iter().all(|d| d.archived));
        assert_eq!(definitions[0].id, "bodyweight");
    }

    #[tokio::test]
    async fn creates_a_definition_appending_at_the_end_of_the_order() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "Forearm", "cm").await.unwrap();
        // 7 seeded suggestions use sort_order 0-6 (0005_measurement_suggestions.sql).
        assert_eq!(created.sort_order, 7);
        assert!(!created.archived);
    }

    #[tokio::test]
    async fn rejects_getting_an_unknown_definition() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = get(&mut conn, "no-such-definition").await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }

    #[tokio::test]
    async fn updates_a_definition_in_place() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "Forearm", "cm").await.unwrap();
        let updated = update(
            &mut conn,
            &created.id,
            "Forearm circumference",
            "cm",
            Some(35.0),
        )
        .await
        .unwrap();
        assert_eq!(updated.name, "Forearm circumference");
        assert_eq!(updated.goal, Some(35.0));
    }

    #[tokio::test]
    async fn update_can_clear_a_goal() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "Forearm", "cm").await.unwrap();
        update(&mut conn, &created.id, "Forearm", "cm", Some(35.0))
            .await
            .unwrap();
        let cleared = update(&mut conn, &created.id, "Forearm", "cm", None)
            .await
            .unwrap();
        assert_eq!(cleared.goal, None);
    }

    #[tokio::test]
    async fn update_rejects_a_unit_change_once_records_exist() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "Forearm", "cm").await.unwrap();
        super::super::records::create(&mut conn, &created.id, "2026-09-14", 30.0, None, None)
            .await
            .unwrap();
        let err = update(&mut conn, &created.id, "Forearm", "in", None)
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn update_allows_a_unit_change_before_any_records_exist() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "Forearm", "cm").await.unwrap();
        let updated = update(&mut conn, &created.id, "Forearm", "in", None)
            .await
            .unwrap();
        assert_eq!(updated.unit, "in");
    }

    #[tokio::test]
    async fn update_rejects_a_unit_change_once_a_goal_is_set() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "Forearm", "cm").await.unwrap();
        update(&mut conn, &created.id, "Forearm", "cm", Some(35.0))
            .await
            .unwrap();
        let err = update(&mut conn, &created.id, "Forearm", "in", Some(35.0))
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn archives_and_unarchives_a_definition() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "Forearm", "cm").await.unwrap();
        let archived = set_archived(&mut conn, &created.id, true).await.unwrap();
        assert!(archived.archived);
        let restored = set_archived(&mut conn, &created.id, false).await.unwrap();
        assert!(!restored.archived);
    }

    #[tokio::test]
    async fn reorder_rejects_an_incomplete_list() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = reorder(&mut conn, &["bodyweight".to_string()])
            .await
            .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn reorder_rewrites_sort_order_to_match_the_given_order() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let mut ids: Vec<String> = list(&mut conn)
            .await
            .unwrap()
            .into_iter()
            .map(|d| d.id)
            .collect();
        ids.swap(0, 1);
        let reordered = reorder(&mut conn, &ids).await.unwrap();
        assert_eq!(
            reordered.iter().map(|d| d.id.as_str()).collect::<Vec<_>>(),
            ids.iter().map(String::as_str).collect::<Vec<_>>()
        );
    }

    #[tokio::test]
    async fn deletes_a_definition_and_records_a_tombstone() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "Forearm", "cm").await.unwrap();
        delete(&mut conn, &created.id).await.unwrap();
        let err = get(&mut conn, &created.id).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tombstones WHERE entity_type = 'measurement_definition' \
             AND entity_id = ?",
        )
        .bind(&created.id)
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(count, 1);
    }
}
