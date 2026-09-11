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
    pub weight_increment_kg: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub reps_increment: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub distance_increment_km: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub duration_increment_sec: Option<i32>,
    pub archived: bool,
    pub favourite: bool,
}
