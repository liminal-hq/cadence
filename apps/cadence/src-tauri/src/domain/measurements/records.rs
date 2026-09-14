// Row mapping and persistence for measurement records.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::MeasurementRecord;
use crate::domain::error::{Error, Result};
use crate::domain::units::{milli_to_unit, ms_to_iso, unit_to_milli};

#[derive(FromRow)]
struct RecordRow {
    id: String,
    definition_id: String,
    local_date: String,
    recorded_at_ms: i64,
    value_milli: i64,
    note: Option<String>,
}

impl From<RecordRow> for MeasurementRecord {
    fn from(row: RecordRow) -> Self {
        MeasurementRecord {
            id: row.id,
            definition_id: row.definition_id,
            date: row.local_date,
            recorded_at: ms_to_iso(row.recorded_at_ms),
            value: milli_to_unit(row.value_milli),
            note: row.note,
        }
    }
}

const SELECT_BY_ID: &str = "SELECT id, definition_id, local_date, recorded_at_ms, value_milli, \
     note FROM measurement_records WHERE id = ?";

const SELECT_BY_DEFINITION: &str = "SELECT id, definition_id, local_date, recorded_at_ms, \
     value_milli, note FROM measurement_records WHERE definition_id = ? \
     ORDER BY local_date, recorded_at_ms";

pub async fn get(conn: &mut SqliteConnection, id: &str) -> Result<MeasurementRecord> {
    let row: RecordRow = sqlx::query_as(SELECT_BY_ID)
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| Error::NotFound {
            entity: "measurement record",
            id: id.to_string(),
        })?;
    Ok(row.into())
}

/// Every record for this definition, oldest first — the measurement detail screen (P-50) reverses for its history list when it wants newest-first.
pub async fn list_by_definition(
    conn: &mut SqliteConnection,
    definition_id: &str,
) -> Result<Vec<MeasurementRecord>> {
    let rows: Vec<RecordRow> = sqlx::query_as(SELECT_BY_DEFINITION)
        .bind(definition_id)
        .fetch_all(conn)
        .await?;
    Ok(rows.into_iter().map(MeasurementRecord::from).collect())
}

pub async fn create(
    conn: &mut SqliteConnection,
    definition_id: &str,
    date: &str,
    value: f64,
    note: Option<&str>,
) -> Result<MeasurementRecord> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "INSERT INTO measurement_records (id, definition_id, local_date, recorded_at_ms, \
         value_milli, note, created_at_ms, updated_at_ms, revision) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(definition_id)
    .bind(date)
    .bind(now)
    .bind(unit_to_milli(value))
    .bind(note)
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
    date: &str,
    value: f64,
    note: Option<&str>,
) -> Result<MeasurementRecord> {
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    let result = sqlx::query(
        "UPDATE measurement_records SET local_date = ?, value_milli = ?, note = ?, \
         updated_at_ms = ?, revision = ? WHERE id = ?",
    )
    .bind(date)
    .bind(unit_to_milli(value))
    .bind(note)
    .bind(now)
    .bind(revision)
    .bind(id)
    .execute(&mut *conn)
    .await?;
    if result.rows_affected() == 0 {
        return Err(Error::NotFound {
            entity: "measurement record",
            id: id.to_string(),
        });
    }
    get(conn, id).await
}

/// A no-op if the record doesn't exist, otherwise records a tombstone.
pub async fn delete(conn: &mut SqliteConnection, id: &str) -> Result<()> {
    let result = sqlx::query("DELETE FROM measurement_records WHERE id = ?")
        .bind(id)
        .execute(&mut *conn)
        .await?;
    if result.rows_affected() > 0 {
        let revision = crate::db::next_revision(conn).await?;
        let now = chrono::Utc::now().timestamp_millis();
        crate::db::write_tombstone(conn, "measurement_record", id, revision, now).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    #[tokio::test]
    async fn creates_a_record_with_value_round_tripped() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "bodyweight", "2026-09-14", 82.5, Some("morning"))
            .await
            .unwrap();
        assert_eq!(created.date, "2026-09-14");
        assert_eq!(created.value, 82.5);
        assert_eq!(created.note.as_deref(), Some("morning"));
    }

    #[tokio::test]
    async fn rejects_getting_an_unknown_record() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = get(&mut conn, "no-such-record").await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }

    #[tokio::test]
    async fn lists_records_for_a_definition_in_date_order() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        create(&mut conn, "bodyweight", "2026-09-10", 83.0, None)
            .await
            .unwrap();
        create(&mut conn, "bodyweight", "2026-09-05", 84.0, None)
            .await
            .unwrap();
        create(&mut conn, "body-fat", "2026-09-05", 18.0, None)
            .await
            .unwrap();

        let records = list_by_definition(&mut conn, "bodyweight").await.unwrap();
        assert_eq!(records.len(), 2);
        assert_eq!(records[0].date, "2026-09-05");
        assert_eq!(records[1].date, "2026-09-10");
    }

    #[tokio::test]
    async fn updates_a_record_in_place() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "bodyweight", "2026-09-14", 82.5, None)
            .await
            .unwrap();
        let updated = update(&mut conn, &created.id, "2026-09-15", 82.0, Some("fixed"))
            .await
            .unwrap();
        assert_eq!(updated.date, "2026-09-15");
        assert_eq!(updated.value, 82.0);
        assert_eq!(updated.note.as_deref(), Some("fixed"));
    }

    #[tokio::test]
    async fn rejects_updating_an_unknown_record() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let err = update(&mut conn, "no-such-record", "2026-09-14", 1.0, None)
            .await
            .unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }

    #[tokio::test]
    async fn deletes_a_record_and_records_a_tombstone() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let created = create(&mut conn, "bodyweight", "2026-09-14", 82.5, None)
            .await
            .unwrap();
        delete(&mut conn, &created.id).await.unwrap();
        let err = get(&mut conn, &created.id).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
        let (count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tombstones WHERE entity_type = 'measurement_record' \
             AND entity_id = ?",
        )
        .bind(&created.id)
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn deleting_an_unknown_record_is_a_silent_no_op() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        delete(&mut conn, "no-such-record").await.unwrap();
    }
}
