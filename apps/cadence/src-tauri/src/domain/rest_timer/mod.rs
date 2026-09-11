// Rest timer domain module: the persisted singleton timer row
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

// The actual state machine (start/pause/resume/extend/dismiss, the settings-gated
// replaces-running check, and the scheduled-elapse task) lives on the Coordinator, since it
// crosses into settings and needs an AppHandle to emit events — this module only reads and
// writes the raw row.

pub mod models;
pub mod repo;
