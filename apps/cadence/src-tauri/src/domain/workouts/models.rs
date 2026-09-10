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
    pub note: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub status: String,
    pub source: String,
    pub logged_by_watch: bool,
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
    pub unmapped_metrics: Option<Vec<String>>,
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
    pub technical_note: Option<String>,
    pub today_note: Option<String>,
    pub superset_group_id: Option<String>,
    pub superset_position: Option<i32>,
    pub superset_size: Option<i32>,
    pub offline_since: Option<String>,
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
    pub quote: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct LastTimeReferenceSet {
    pub value_label: String,
}
