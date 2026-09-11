// Row mapping and persistence for the singleton rest-timer row
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::RestTimerState;
use crate::domain::error::Result;
use crate::domain::units::{iso_to_ms, ms_to_iso};

#[derive(FromRow)]
struct RestTimerRow {
    status: String,
    target_instant_ms: Option<i64>,
    total_ms: Option<i64>,
    remaining_ms_at_pause: Option<i64>,
    owner_device: Option<String>,
    for_set_id: Option<String>,
    next_set_label: Option<String>,
}

impl From<RestTimerRow> for RestTimerState {
    fn from(row: RestTimerRow) -> Self {
        RestTimerState {
            status: row.status,
            target_instant: row.target_instant_ms.map(ms_to_iso),
            total_ms: row.total_ms,
            remaining_ms_at_pause: row.remaining_ms_at_pause,
            owner_device: row.owner_device,
            for_set_id: row.for_set_id,
            next_set_label: row.next_set_label,
        }
    }
}

pub async fn get(conn: &mut SqliteConnection) -> Result<RestTimerState> {
    let row: RestTimerRow = sqlx::query_as(
        "SELECT status, target_instant_ms, total_ms, remaining_ms_at_pause, owner_device, \
         for_set_id, next_set_label FROM rest_timer WHERE id = 1",
    )
    .fetch_one(conn)
    .await?;
    Ok(row.into())
}

/// A full replace of the singleton row — every field is written from `state`, matching the
/// mock's own "replace the whole state object" semantics (never a partial merge).
pub async fn set(conn: &mut SqliteConnection, state: &RestTimerState) -> Result<RestTimerState> {
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "UPDATE rest_timer SET status = ?, target_instant_ms = ?, total_ms = ?, \
         remaining_ms_at_pause = ?, owner_device = ?, for_set_id = ?, next_set_label = ?, \
         revision = ? WHERE id = 1",
    )
    .bind(&state.status)
    .bind(state.target_instant.as_deref().map(iso_to_ms).transpose()?)
    .bind(state.total_ms)
    .bind(state.remaining_ms_at_pause)
    .bind(&state.owner_device)
    .bind(&state.for_set_id)
    .bind(&state.next_set_label)
    .bind(revision)
    .execute(&mut *conn)
    .await?;
    get(conn).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    #[tokio::test]
    async fn starts_inactive() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let state = get(&mut conn).await.unwrap();
        assert_eq!(state.status, "inactive");
        assert_eq!(state.target_instant, None);
    }

    #[tokio::test]
    async fn set_replaces_the_whole_row() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let running = RestTimerState {
            status: "running".to_string(),
            target_instant: Some("2026-09-09T09:42:00.000Z".to_string()),
            total_ms: Some(120_000),
            remaining_ms_at_pause: None,
            owner_device: Some("phone".to_string()),
            for_set_id: Some("set-bp-1".to_string()),
            next_set_label: None,
        };
        let saved = set(&mut conn, &running).await.unwrap();
        assert_eq!(saved, running);
        assert_eq!(get(&mut conn).await.unwrap(), running);
    }
}
