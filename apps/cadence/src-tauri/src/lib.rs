// Configures the native Tauri runtime for the Cadence app shell.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

mod commands;
mod db;
mod domain;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // debug() keeps the context menu, devtools, and reload shortcuts enabled in debug builds
    // (so they're still there while developing) and disables everything in release builds.
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_prevent_default::debug())
        .plugin(tauri_plugin_predictive_back::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
    }

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .setup(|app| {
            let db_path = app.path().app_data_dir()?.join("cadence.db");
            let handle = app.handle().clone();
            let coordinator = tauri::async_runtime::block_on(async {
                let pool = db::init_pool(&db_path).await?;
                let coordinator = domain::Coordinator::new(pool, handle);
                // A timer left "running" when the process last exited has no scheduled-elapse
                // task anymore; reconcile it against the wall clock before anything else runs.
                coordinator.rehydrate_rest_timer().await?;
                Ok::<_, domain::error::Error>(coordinator)
            })?;
            app.manage(coordinator);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_category,
            commands::list_categories,
            commands::create_category,
            commands::rename_category,
            commands::recolour_category,
            commands::set_category_archived,
            commands::delete_category,
            commands::reorder_categories,
            commands::get_exercise,
            commands::list_exercises,
            commands::update_exercise_favourite,
            commands::create_exercise,
            commands::update_exercise,
            commands::set_exercise_archived,
            commands::delete_exercise,
            commands::get_exercise_goal,
            commands::list_exercise_goals,
            commands::create_exercise_goal,
            commands::update_exercise_goal,
            commands::set_exercise_goal_achieved,
            commands::set_exercise_goal_archived,
            commands::delete_exercise_goal,
            commands::get_measurement_definition,
            commands::list_measurement_definitions,
            commands::create_measurement_definition,
            commands::update_measurement_definition,
            commands::set_measurement_definition_archived,
            commands::reorder_measurement_definitions,
            commands::delete_measurement_definition,
            commands::get_measurement_record,
            commands::list_measurement_records,
            commands::create_measurement_record,
            commands::update_measurement_record,
            commands::delete_measurement_record,
            commands::list_analysis_sets,
            commands::get_analysis_favourite,
            commands::list_analysis_favourites,
            commands::create_analysis_favourite,
            commands::update_analysis_favourite,
            commands::reorder_analysis_favourites,
            commands::delete_analysis_favourite,
            commands::get_workout,
            commands::list_workouts_in_range,
            commands::update_workout_note,
            commands::create_workout,
            commands::duplicate_workout,
            commands::get_workout_exercise,
            commands::list_workout_exercises_by_workout,
            commands::list_workout_exercises_by_exercise,
            commands::add_workout_exercise,
            commands::delete_workout_exercise,
            commands::update_today_note,
            commands::get_routine,
            commands::list_routines,
            commands::create_routine,
            commands::rename_routine,
            commands::update_routine_note,
            commands::set_routine_archived,
            commands::delete_routine,
            commands::get_routine_section,
            commands::list_routine_sections,
            commands::add_routine_section,
            commands::rename_routine_section,
            commands::reorder_routine_sections,
            commands::delete_routine_section,
            commands::get_routine_superset,
            commands::create_routine_superset,
            commands::delete_routine_superset,
            commands::get_routine_exercise,
            commands::list_routine_exercises,
            commands::add_routine_exercise,
            commands::reorder_routine_exercises,
            commands::set_routine_exercise_superset,
            commands::update_routine_exercise_note,
            commands::delete_routine_exercise,
            commands::list_set_templates,
            commands::add_set_template,
            commands::delete_set_template,
            commands::most_recent_completed_set,
            commands::materialize_routine_section,
            commands::list_sets,
            commands::save_set,
            commands::complete_set,
            commands::add_set,
            commands::log_new_set,
            commands::duplicate_set,
            commands::delete_set,
            commands::update_set_note,
            commands::start_rest_timer,
            commands::pause_rest_timer,
            commands::resume_rest_timer,
            commands::extend_rest_timer,
            commands::dismiss_rest_timer,
            commands::get_rest_timer_state,
            commands::list_barbell_configs,
            commands::calculate_plates,
            commands::add_barbell_config,
            commands::update_barbell_config,
            commands::delete_barbell_config,
            commands::get_settings,
            commands::update_settings,
            commands::get_history_summary,
            commands::delete_all_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running the Cadence application");
}
