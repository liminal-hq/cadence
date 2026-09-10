// Domain modules: one per entity area, each with a `models` submodule (the public DTO, matching
// apps/cadence/src/domain/types.ts field-for-field) and a `repo` submodule (row mapping + pure
// persistence — no events, no cross-entity invariants). Cross-entity coordination and the
// Tauri-facing command surface land in a later PR once there's more than one area to compose.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

pub mod error;
pub mod events;
pub mod units;

pub mod barbells;
pub mod exercises;
pub mod history;
pub mod rest_timer;
pub mod sets;
pub mod settings;
pub mod workouts;
