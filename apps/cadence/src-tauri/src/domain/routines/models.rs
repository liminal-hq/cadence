// The Routine/RoutineSection/RoutineSuperset/RoutineExercise/SetTemplate DTOs
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::{Deserialize, Serialize};

/// A reusable workout template — SPEC.md 8.4: "templates, not a second kind of workout history."
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct Routine {
    pub id: String,
    pub name: String,
    #[cfg_attr(test, ts(optional))]
    pub note: Option<String>,
    pub sort_order: i32,
    pub archived: bool,
}

/// A named group of exercises within a routine — routines may have one or many sections (SPEC.md 8.4: "named sections, ordered exercises").
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct RoutineSection {
    pub id: String,
    pub routine_id: String,
    #[cfg_attr(test, ts(optional))]
    pub name: Option<String>,
    pub sort_order: i32,
}

/// A routine-authored superset template; materialization copies these into workout-level supersets, matching how `SetTemplate` materializes into `Set` (schema comment, 0001 migration).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct RoutineSuperset {
    pub id: String,
    pub routine_section_id: String,
    #[cfg_attr(test, ts(optional))]
    pub colour: Option<String>,
    pub auto_advance: bool,
    #[cfg_attr(test, ts(optional, type = "number"))]
    pub rest_ms: Option<i64>,
}

/// One exercise slot within a routine section.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct RoutineExercise {
    pub id: String,
    pub routine_section_id: String,
    pub exercise_id: String,
    pub order: i32,
    #[cfg_attr(test, ts(optional))]
    pub routine_superset_id: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub superset_position: Option<i32>,
    #[cfg_attr(test, ts(optional, type = "number"))]
    pub rest_ms: Option<i64>,
    #[cfg_attr(test, ts(optional))]
    pub note: Option<String>,
}

/// A planned set within a routine exercise — either explicit target values, or a rule to seed values from the most recent comparable performance at materialization time (SPEC.md 8.4/10.1). Exactly one of `values` or `population_rule` is meaningful for a given template; both are optional at the type level because the DB column set is shared, not because either is expected alongside the other.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct SetTemplate {
    pub id: String,
    pub routine_exercise_id: String,
    pub order: i32,
    #[cfg_attr(test, ts(optional))]
    pub weight_kg: Option<f64>,
    /// A fixed rep target is `reps_min == reps_max`; a true range has `reps_min < reps_max`. The repo layer enforces this invariant on write, so a reader only ever needs to check whether the two differ.
    #[cfg_attr(test, ts(optional))]
    pub reps_min: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub reps_max: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub distance_km: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub duration_sec: Option<i32>,
    /// The only value shipped in v1 is `"seed-last-performance"`; `None` means the explicit target values above are used as-is.
    #[cfg_attr(test, ts(optional))]
    pub population_rule: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub set_label: Option<String>,
}

/// The subset of `SetTemplate`'s fields a caller supplies when creating or editing one — mirrors `sets::models::SetValues`'s shape (plus the `reps_min`/`reps_max` pair in place of a single `reps`). A caller may supply only `reps_min` to mean a fixed target — the repo layer fills `reps_max` in to match.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct SetTemplateValues {
    #[cfg_attr(test, ts(optional))]
    pub weight_kg: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub reps_min: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub reps_max: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub distance_km: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub duration_sec: Option<i32>,
    #[cfg_attr(test, ts(optional))]
    pub population_rule: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub set_label: Option<String>,
}

/// The only `population_rule` value set_templates support in v1 — validated in the repo layer rather than a DB `CHECK` constraint, matching `exercises.category`'s "open TEXT, Rust-validated" convention, since more rules are expected later.
pub const SEED_LAST_PERFORMANCE: &str = "seed-last-performance";
