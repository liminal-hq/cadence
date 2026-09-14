// The Category DTO.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::{Deserialize, Serialize};

/// A user-owned exercise category — three tonal colour roles, matching
/// `apps/cadence/src/data/categoryColours.ts`'s `CategoryColour` shape (P-35 retires that
/// hardcoded map in favour of reading these rows for real).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub colour_background: String,
    pub colour_text: String,
    pub colour_dot: String,
    pub sort_order: i32,
    pub archived: bool,
}
