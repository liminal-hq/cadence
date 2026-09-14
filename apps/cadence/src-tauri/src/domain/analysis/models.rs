// The AnalysisSetEntry DTO, mirroring types.ts field-for-field.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::{Deserialize, Serialize};

/// One completed set, denormalized with its exercise/category context so P-47's breakdown and drill-down can group and re-navigate without a second round trip per row.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct AnalysisSetEntry {
    pub set_id: String,
    pub workout_id: String,
    pub exercise_id: String,
    pub exercise_name: String,
    pub category_id: String,
    pub category_name: String,
    pub metric_profile: String,
    pub date: String,
    #[cfg_attr(test, ts(optional))]
    pub weight_kg: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub reps: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub distance_km: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub duration_sec: Option<i32>,
}
