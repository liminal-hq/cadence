// The Workout/WorkoutExercise DTOs, mirroring types.ts field-for-field.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::{Deserialize, Serialize};

/// Mirrors `types.ts`'s `Workout` — `date` is the authoritative local training date, always
/// stored and read separately from `startedAt`/`completedAt` (real instants), matching the
/// near-midnight-timezone invariant already proven out in the frontend's History feature.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct Workout {
    pub id: String,
    pub date: String,
    pub title: String,
    #[cfg_attr(test, ts(optional))]
    pub note: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub started_at: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub completed_at: Option<String>,
    pub status: String,
    pub source: String,
    pub logged_by_watch: bool,
    #[cfg_attr(test, ts(optional))]
    pub health_connect: Option<WorkoutHealthConnectProvenance>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct WorkoutHealthConnectProvenance {
    pub source_app: String,
    pub record_id: String,
    pub imported_at: String,
    #[cfg_attr(test, ts(optional))]
    pub unmapped_metrics: Option<Vec<String>>,
    #[cfg_attr(test, ts(optional))]
    pub overlaps_with_workout_id: Option<String>,
}

/// Mirrors `types.ts`'s `WorkoutExercise`. `last_time_reference` is always `None` for now — its
/// prior-performance lookup and label formatting are deferred to the PR that builds the frontend
/// adapter, per the backend design plan's split (backend returns facts, frontend formats labels).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct WorkoutExercise {
    pub id: String,
    pub exercise_id: String,
    pub workout_id: String,
    pub workout_label: String,
    pub order: i32,
    #[cfg_attr(test, ts(optional))]
    pub technical_note: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub today_note: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub superset_group_id: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub superset_position: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub superset_size: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub offline_since: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub last_time_reference: Option<LastTimeReference>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct LastTimeReference {
    pub date_label: String,
    pub best_label: String,
    pub sets: Vec<LastTimeReferenceSet>,
    #[cfg_attr(test, ts(optional))]
    pub quote: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct LastTimeReferenceSet {
    pub value_label: String,
}
