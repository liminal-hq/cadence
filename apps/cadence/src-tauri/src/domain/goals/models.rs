// The ExerciseGoal DTO, mirroring types.ts field-for-field.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::{Deserialize, Serialize};

/// A target attached to an exercise (SPEC.md 8.8) — start/target dates and achievement are tracked here, but whether the target has actually been *reached* is a pure function over logged history (mirroring how personal records are computed), not a stored value.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct ExerciseGoal {
    pub id: String,
    pub exercise_id: String,
    pub title: String,
    #[cfg_attr(test, ts(optional))]
    pub target_weight_kg: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub target_reps: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub target_distance_km: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub target_duration_sec: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub start_date: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub target_date: Option<String>,
    /// Set by the explicit `set_achieved` toggle, not inferred automatically — a user can mark a goal met (or clear that) independently of whatever the history-derived progress calculation shows, matching SPEC.md 8.8's "a goal and a record are different entities." Omitted rather than serialized as `null` when absent, matching the generated/frontend type's `achievedAt?: string` (a plain optional property, not `string | null`) and the mock's `undefined`.
    #[cfg_attr(test, ts(optional))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub achieved_at: Option<String>,
    pub archived: bool,
}

/// Fields a caller supplies when creating or editing a goal — mirrors `ExerciseGoal`'s own editable subset (id/achievedAt/archived are managed separately, by dedicated calls).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct ExerciseGoalValues {
    pub exercise_id: String,
    pub title: String,
    #[cfg_attr(test, ts(optional))]
    pub target_weight_kg: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub target_reps: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub target_distance_km: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub target_duration_sec: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub start_date: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub target_date: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn omits_achieved_at_rather_than_serializing_it_as_null() {
        let goal = ExerciseGoal {
            id: "goal-1".to_string(),
            exercise_id: "ex-1".to_string(),
            title: "Hit a new max".to_string(),
            target_weight_kg: None,
            target_reps: None,
            target_distance_km: None,
            target_duration_sec: None,
            start_date: None,
            target_date: None,
            achieved_at: None,
            archived: false,
        };
        let value = serde_json::to_value(&goal).unwrap();
        assert!(!value.as_object().unwrap().contains_key("achievedAt"));
    }
}
