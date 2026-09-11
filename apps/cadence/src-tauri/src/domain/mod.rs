// Domain modules: one per entity area, plus the Coordinator that ties them together
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

// Each entity area has a `models` submodule (the public DTO, matching
// apps/cadence/src/domain/types.ts field-for-field) and a `repo` submodule (row mapping + pure
// persistence — no events, no cross-entity invariants). Cross-entity coordination, transactions,
// and event emission live on the `Coordinator`, which `commands.rs`'s Tauri command surface calls
// into exclusively.

pub mod coordinator;
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

pub use coordinator::Coordinator;
