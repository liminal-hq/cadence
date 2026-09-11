// The BarbellConfig DTO, mirroring types.ts field-for-field
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct BarbellConfig {
    pub id: String,
    pub name: String,
    pub bar_weight: f64,
    pub display_unit: String,
    pub available_plates: Vec<f64>,
    pub is_default: bool,
}

/// The fields a caller supplies when creating a config — mirrors `Omit<BarbellConfig, 'id'>`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct NewBarbellConfig {
    pub name: String,
    pub bar_weight: f64,
    pub display_unit: String,
    pub available_plates: Vec<f64>,
    pub is_default: bool,
}
