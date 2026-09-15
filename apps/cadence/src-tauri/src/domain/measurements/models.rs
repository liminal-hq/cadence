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
    #[serde(skip_serializing_if = "Option::is_none")]
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn omits_a_definitions_absent_goal_rather_than_serializing_it_as_null() {
        let definition = MeasurementDefinition {
            id: "def-1".to_string(),
            name: "Bodyweight".to_string(),
            unit: "kg".to_string(),
            goal: None,
            sort_order: 0,
            archived: false,
        };
        let value = serde_json::to_value(&definition).unwrap();
        assert!(!value.as_object().unwrap().contains_key("goal"));
    }

    #[test]
    fn omits_a_records_absent_note_rather_than_serializing_it_as_null() {
        let record = MeasurementRecord {
            id: "rec-1".to_string(),
            definition_id: "def-1".to_string(),
            date: "2026-09-15".to_string(),
            recorded_at: "2026-09-15T00:00:00.000Z".to_string(),
            value: 80.0,
            note: None,
        };
        let value = serde_json::to_value(&record).unwrap();
        assert!(!value.as_object().unwrap().contains_key("note"));
    }
}
