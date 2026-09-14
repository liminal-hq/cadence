// The Exercise DTO, mirroring types.ts field-for-field.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::{Deserialize, Serialize};

/// Mirrors `apps/cadence/src/domain/types.ts`'s `Exercise` field-for-field — `metricProfile` and
/// `category` stay open `String`s (validated where written, not CHECK-constrained) so adding a
/// new profile or category is a Rust change, never a migration.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct Exercise {
    pub id: String,
    pub name: String,
    pub category: String,
    pub metric_profile: String,
    #[cfg_attr(test, ts(optional))]
    pub note: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub url: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub weight_increment_kg: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub reps_increment: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub distance_increment_km: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub duration_increment_sec: Option<i32>,
    #[cfg_attr(test, ts(optional, type = "number"))]
    pub rest_default_ms: Option<i64>,
    /// One of `history/computeGraphPoints.ts`'s `GraphMetric` keys (`"weight"`, `"estimated-1rm"`, `"volume"`, `"distance"`, `"pace"`) — validated against that set in the repo layer, not a DB `CHECK` constraint, matching `metric_profile`'s "open TEXT, Rust-validated" convention.
    #[cfg_attr(test, ts(optional))]
    pub graph_default_metric: Option<String>,
    pub archived: bool,
    pub favourite: bool,
}

/// Fields a caller supplies when creating or editing an exercise — mirrors `Exercise`'s own editable subset (id/archived/favourite are managed separately, by dedicated calls).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct ExerciseValues {
    pub name: String,
    pub category: String,
    pub metric_profile: String,
    #[cfg_attr(test, ts(optional))]
    pub note: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub url: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub weight_increment_kg: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub reps_increment: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub distance_increment_km: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub duration_increment_sec: Option<i32>,
    #[cfg_attr(test, ts(optional, type = "number"))]
    pub rest_default_ms: Option<i64>,
    #[cfg_attr(test, ts(optional))]
    pub graph_default_metric: Option<String>,
}

/// The `GraphMetric` keys `graph_default_metric` accepts — kept as a function, matching `routines::set_templates::validate_population_rule`'s reasoning, so the check has one call site as more metrics are added later.
pub fn is_known_graph_metric(value: &str) -> bool {
    matches!(
        value,
        "weight" | "estimated-1rm" | "volume" | "distance" | "pace"
    )
}
