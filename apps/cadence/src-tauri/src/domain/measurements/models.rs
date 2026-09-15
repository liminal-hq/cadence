// The MeasurementDefinition/MeasurementRecord DTOs, mirroring types.ts field-for-field
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::{Deserialize, Serialize};

/// A user-owned (or built-in-but-editable) measurement kind — SPEC.md 8.8: "name, unit, optional goal, enabled state, and order." `archived` doubles as the "enabled state": an archived definition is disabled, matching every other entity in this crate's archive convention rather than introducing a second boolean.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct MeasurementDefinition {
    pub id: String,
    pub name: String,
    pub unit: String,
    #[cfg_attr(test, ts(optional))]
    pub goal: Option<f64>,
    pub sort_order: i32,
    pub archived: bool,
}

/// One logged value for a `MeasurementDefinition` — a distinct entity from a goal (SPEC.md 8.8: "a goal and a record are different entities; reaching a goal must not rewrite the record").
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct MeasurementRecord {
    pub id: String,
    pub definition_id: String,
    pub date: String,
    pub recorded_at: String,
    pub value: f64,
    #[cfg_attr(test, ts(optional))]
    pub note: Option<String>,
}
