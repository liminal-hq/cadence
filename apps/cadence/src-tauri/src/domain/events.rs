// Event names pushed to the frontend, following Threshold's `domain:verb-in-kebab` convention.
// Payloads are the same DTOs already used for command responses — no separate payload structs
// needed yet, since the one event this crate emits so far carries a full RestTimerState.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/// Emitted on every rest-timer transition, carrying the full new `RestTimerState` — the
/// `TauriLoggingRepository` adapter's `subscribeRestTimer` listens for this instead of polling.
pub const REST_TIMER_CHANGED: &str = "rest-timer:changed";
