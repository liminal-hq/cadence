// Configures the native Tauri runtime for the Cadence app shell.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

// `db`/`domain` are built out incrementally, ahead of the Tauri command surface that will call
// into them once every entity area exists — dead_code is expected here until that later PR wires
// them into `run()`'s `invoke_handler!`. Remove these two `allow`s at that point.
#[allow(dead_code)]
mod db;
#[allow(dead_code)]
mod domain;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // debug() keeps the context menu, devtools, and reload shortcuts enabled in debug builds
    // (so they're still there while developing) and disables everything in release builds.
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_prevent_default::debug());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
    }

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running the Cadence application");
}
