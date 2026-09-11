// The RestTimerState DTO, mirroring types.ts field-for-field
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct RestTimerState {
    pub status: String,
    #[cfg_attr(test, ts(optional))]
    pub target_instant: Option<String>,
    #[cfg_attr(test, ts(optional, type = "number"))]
    pub total_ms: Option<i64>,
    #[cfg_attr(test, ts(optional, type = "number"))]
    pub remaining_ms_at_pause: Option<i64>,
    #[cfg_attr(test, ts(optional))]
    pub owner_device: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub for_set_id: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub next_set_label: Option<String>,
}

impl RestTimerState {
    pub fn inactive() -> Self {
        RestTimerState {
            status: "inactive".to_string(),
            target_instant: None,
            total_ms: None,
            remaining_ms_at_pause: None,
            owner_device: None,
            for_set_id: None,
            next_set_label: None,
        }
    }
}

/// Mirrors `startRestTimer`'s options parameter.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct StartRestTimerOptions {
    #[cfg_attr(test, ts(optional))]
    pub for_set_id: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub next_set_label: Option<String>,
    #[cfg_attr(test, ts(optional))]
    pub owner_device: Option<String>,
}
