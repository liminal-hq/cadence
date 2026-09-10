// The SetEntry/SetValues DTOs, mirroring types.ts field-for-field.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::{Deserialize, Serialize};

/// Mirrors `types.ts`'s `SetEntry`. `is_record` is always `false` for now — personal-record
/// detection stays a cross-set aggregate query (matching the frontend's `computeRecords.ts`, and
/// SPEC.md section 10.3's warning against treating a record flag as an irreplaceable source of
/// truth) and is deferred to the PR that wires up the full command surface.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct SetEntry {
    pub id: String,
    pub workout_exercise_id: String,
    pub order: i32,
    pub status: String,
    #[cfg_attr(test, ts(optional))]
    pub weight_kg: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub reps: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub distance_km: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub duration_sec: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub completed_at: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub note: Option<String>,
    pub is_record: bool,
    pub pending_sync: bool,
}

/// The subset of `SetEntry`'s fields a caller supplies when logging or editing a set — mirrors
/// `logNewSet`'s `Partial<Pick<SetEntry, ...>>` parameter shape.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct SetValues {
    #[cfg_attr(test, ts(optional))]
    pub weight_kg: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub reps: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub distance_km: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub duration_sec: Option<i32>,
}
