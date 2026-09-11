// The Settings DTO and its update-patch shape, mirroring types.ts field-for-field
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub weight_unit: String,
    #[cfg_attr(test, ts(type = "number"))]
    pub default_rest_ms: i64,
    pub rest_auto_start: bool,
    pub rest_replaces_running: bool,
    pub vibrate_enabled: bool,
    pub sound_enabled: bool,
    pub rest_feedback_device: String,
    pub workout_timer_auto_start: bool,
    pub keep_screen_on_during_workout: bool,
    pub haptic_on_set_complete: bool,
    pub haptic_on_rest_end: bool,
    pub reduced_motion: bool,
    pub notifications_denied: bool,
    pub automatic_backup_enabled: bool,
}

/// Mirrors `updateSettings`'s `Partial<Settings>` parameter — every field optional, `None` means
/// "leave unchanged."
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    #[cfg_attr(test, ts(optional))]
    pub weight_unit: Option<String>,
    #[cfg_attr(test, ts(optional, type = "number"))]
    pub default_rest_ms: Option<i64>,
    #[cfg_attr(test, ts(optional))]
    pub rest_auto_start: Option<bool>,
    #[cfg_attr(test, ts(optional))]
    pub rest_replaces_running: Option<bool>,
    #[cfg_attr(test, ts(optional))]
    pub vibrate_enabled: Option<bool>,
    #[cfg_attr(test, ts(optional))]
    pub sound_enabled: Option<bool>,
    #[cfg_attr(test, ts(optional))]
    pub rest_feedback_device: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub workout_timer_auto_start: Option<bool>,
    #[cfg_attr(test, ts(optional))]
    pub keep_screen_on_during_workout: Option<bool>,
    #[cfg_attr(test, ts(optional))]
    pub haptic_on_set_complete: Option<bool>,
    #[cfg_attr(test, ts(optional))]
    pub haptic_on_rest_end: Option<bool>,
    #[cfg_attr(test, ts(optional))]
    pub reduced_motion: Option<bool>,
    #[cfg_attr(test, ts(optional))]
    pub notifications_denied: Option<bool>,
    #[cfg_attr(test, ts(optional))]
    pub automatic_backup_enabled: Option<bool>,
}
