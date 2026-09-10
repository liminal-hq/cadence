// Row mapping and persistence for the singleton app-settings row.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::{Settings, SettingsPatch};
use crate::domain::error::Result;

#[derive(FromRow)]
struct SettingsRow {
    weight_unit: String,
    default_rest_ms: i64,
    rest_auto_start: i64,
    rest_replaces_running: i64,
    vibrate_enabled: i64,
    sound_enabled: i64,
    rest_feedback_device: String,
    workout_timer_auto_start: i64,
    keep_screen_on_during_workout: i64,
    haptic_on_set_complete: i64,
    haptic_on_rest_end: i64,
    reduced_motion: i64,
    notifications_denied: i64,
    automatic_backup_enabled: i64,
}

impl From<SettingsRow> for Settings {
    fn from(row: SettingsRow) -> Self {
        Settings {
            weight_unit: row.weight_unit,
            default_rest_ms: row.default_rest_ms,
            rest_auto_start: row.rest_auto_start != 0,
            rest_replaces_running: row.rest_replaces_running != 0,
            vibrate_enabled: row.vibrate_enabled != 0,
            sound_enabled: row.sound_enabled != 0,
            rest_feedback_device: row.rest_feedback_device,
            workout_timer_auto_start: row.workout_timer_auto_start != 0,
            keep_screen_on_during_workout: row.keep_screen_on_during_workout != 0,
            haptic_on_set_complete: row.haptic_on_set_complete != 0,
            haptic_on_rest_end: row.haptic_on_rest_end != 0,
            reduced_motion: row.reduced_motion != 0,
            notifications_denied: row.notifications_denied != 0,
            automatic_backup_enabled: row.automatic_backup_enabled != 0,
        }
    }
}

const SELECT: &str = "SELECT weight_unit, default_rest_ms, rest_auto_start, \
     rest_replaces_running, vibrate_enabled, sound_enabled, rest_feedback_device, \
     workout_timer_auto_start, keep_screen_on_during_workout, haptic_on_set_complete, \
     haptic_on_rest_end, reduced_motion, notifications_denied, automatic_backup_enabled \
     FROM app_settings WHERE id = 1";

pub async fn get(conn: &mut SqliteConnection) -> Result<Settings> {
    let row: SettingsRow = sqlx::query_as(SELECT).fetch_one(conn).await?;
    Ok(row.into())
}

/// Every field is patched via `COALESCE(?, column)` in one static query — `None` leaves the
/// column unchanged, so a `SettingsPatch` never needs to build SQL dynamically per call.
pub async fn update(conn: &mut SqliteConnection, patch: &SettingsPatch) -> Result<Settings> {
    let now = chrono::Utc::now().timestamp_millis();
    sqlx::query(
        "UPDATE app_settings SET \
         weight_unit = COALESCE(?, weight_unit), \
         default_rest_ms = COALESCE(?, default_rest_ms), \
         rest_auto_start = COALESCE(?, rest_auto_start), \
         rest_replaces_running = COALESCE(?, rest_replaces_running), \
         vibrate_enabled = COALESCE(?, vibrate_enabled), \
         sound_enabled = COALESCE(?, sound_enabled), \
         rest_feedback_device = COALESCE(?, rest_feedback_device), \
         workout_timer_auto_start = COALESCE(?, workout_timer_auto_start), \
         keep_screen_on_during_workout = COALESCE(?, keep_screen_on_during_workout), \
         haptic_on_set_complete = COALESCE(?, haptic_on_set_complete), \
         haptic_on_rest_end = COALESCE(?, haptic_on_rest_end), \
         reduced_motion = COALESCE(?, reduced_motion), \
         notifications_denied = COALESCE(?, notifications_denied), \
         automatic_backup_enabled = COALESCE(?, automatic_backup_enabled), \
         updated_at_ms = ? \
         WHERE id = 1",
    )
    .bind(&patch.weight_unit)
    .bind(patch.default_rest_ms)
    .bind(patch.rest_auto_start)
    .bind(patch.rest_replaces_running)
    .bind(patch.vibrate_enabled)
    .bind(patch.sound_enabled)
    .bind(&patch.rest_feedback_device)
    .bind(patch.workout_timer_auto_start)
    .bind(patch.keep_screen_on_during_workout)
    .bind(patch.haptic_on_set_complete)
    .bind(patch.haptic_on_rest_end)
    .bind(patch.reduced_motion)
    .bind(patch.notifications_denied)
    .bind(patch.automatic_backup_enabled)
    .bind(now)
    .execute(&mut *conn)
    .await?;
    get(conn).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    #[tokio::test]
    async fn gets_the_seeded_default_settings() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let settings = get(&mut conn).await.unwrap();
        assert_eq!(settings.weight_unit, "kg");
        assert_eq!(settings.default_rest_ms, 120_000);
        assert!(settings.notifications_denied);
        assert!(settings.automatic_backup_enabled);
    }

    #[tokio::test]
    async fn update_patches_only_the_given_fields() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let patch = SettingsPatch {
            weight_unit: Some("lb".to_string()),
            vibrate_enabled: Some(false),
            ..Default::default()
        };
        let updated = update(&mut conn, &patch).await.unwrap();
        assert_eq!(updated.weight_unit, "lb");
        assert!(!updated.vibrate_enabled);
        // Untouched fields keep their prior values.
        assert_eq!(updated.default_rest_ms, 120_000);
        assert!(updated.notifications_denied);
    }

    #[tokio::test]
    async fn update_with_an_empty_patch_changes_nothing() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let before = get(&mut conn).await.unwrap();
        let after = update(&mut conn, &SettingsPatch::default()).await.unwrap();
        assert_eq!(before, after);
    }
}
