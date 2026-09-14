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
    /// This set's `sort_order` within its own workout-exercise — the same ordinal a user sees as
    /// "Set N" while logging (`SetEntry.order` elsewhere). Two completed sets with identical
    /// logged values are otherwise indistinguishable in the drill-down list.
    pub set_order: i32,
    #[cfg_attr(test, ts(optional))]
    pub weight_kg: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub reps: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub distance_km: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub duration_sec: Option<i32>,
}

/// A pinned P-47 breakdown configuration (SPEC.md 8.7: "let users pin recurring breakdowns without changing their underlying workout data"). `config` is an opaque JSON blob the frontend defines and parses — this layer never inspects its shape.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct AnalysisFavourite {
    pub id: String,
    pub name: String,
    pub config: String,
    pub sort_order: i32,
}
