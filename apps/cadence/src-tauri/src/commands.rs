// Thin Tauri command wrappers, one per LoggingRepository method, delegating to the Coordinator
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use tauri::State;

use crate::domain::barbells::models::{BarbellConfig, NewBarbellConfig};
use crate::domain::barbells::plates::PlateCalculationResult;
use crate::domain::error::Error;
use crate::domain::exercises::models::Exercise;
use crate::domain::history::HistorySummary;
use crate::domain::rest_timer::models::{RestTimerState, StartRestTimerOptions};
use crate::domain::sets::models::{SetEntry, SetValues};
use crate::domain::settings::models::{Settings, SettingsPatch};
use crate::domain::workouts::models::{Workout, WorkoutExercise};
use crate::domain::Coordinator;

// ============ exercises ============

#[tauri::command]
pub async fn get_exercise(state: State<'_, Coordinator>, id: String) -> Result<Exercise, Error> {
    state.get_exercise(&id).await
}

#[tauri::command]
pub async fn list_exercises(state: State<'_, Coordinator>) -> Result<Vec<Exercise>, Error> {
    state.list_exercises().await
}

#[tauri::command]
pub async fn update_exercise_favourite(
    state: State<'_, Coordinator>,
    id: String,
    favourite: bool,
) -> Result<Exercise, Error> {
    state.update_exercise_favourite(&id, favourite).await
}

// ============ workouts / workout-exercises ============

#[tauri::command]
pub async fn get_workout(state: State<'_, Coordinator>, id: String) -> Result<Workout, Error> {
    state.get_workout(&id).await
}

#[tauri::command]
pub async fn list_workouts_in_range(
    state: State<'_, Coordinator>,
    start_date: String,
    end_date: String,
) -> Result<Vec<Workout>, Error> {
    state.list_workouts_in_range(&start_date, &end_date).await
}

#[tauri::command]
pub async fn update_workout_note(
    state: State<'_, Coordinator>,
    workout_id: String,
    note: Option<String>,
) -> Result<Workout, Error> {
    state
        .update_workout_note(&workout_id, note.as_deref())
        .await
}

#[tauri::command]
pub async fn duplicate_workout(
    state: State<'_, Coordinator>,
    workout_id: String,
    target_date: String,
) -> Result<Workout, Error> {
    state.duplicate_workout(&workout_id, &target_date).await
}

#[tauri::command]
pub async fn get_workout_exercise(
    state: State<'_, Coordinator>,
    id: String,
) -> Result<WorkoutExercise, Error> {
    state.get_workout_exercise(&id).await
}

#[tauri::command]
pub async fn list_workout_exercises_by_workout(
    state: State<'_, Coordinator>,
    workout_id: String,
) -> Result<Vec<WorkoutExercise>, Error> {
    state.list_workout_exercises_by_workout(&workout_id).await
}

#[tauri::command]
pub async fn list_workout_exercises_by_exercise(
    state: State<'_, Coordinator>,
    exercise_id: String,
) -> Result<Vec<WorkoutExercise>, Error> {
    state.list_workout_exercises_by_exercise(&exercise_id).await
}

#[tauri::command]
pub async fn update_today_note(
    state: State<'_, Coordinator>,
    workout_exercise_id: String,
    note: Option<String>,
) -> Result<WorkoutExercise, Error> {
    state
        .update_today_note(&workout_exercise_id, note.as_deref())
        .await
}

// ============ sets ============

#[tauri::command]
pub async fn list_sets(
    state: State<'_, Coordinator>,
    workout_exercise_id: String,
) -> Result<Vec<SetEntry>, Error> {
    state.list_sets(&workout_exercise_id).await
}

#[tauri::command]
pub async fn save_set(state: State<'_, Coordinator>, set: SetEntry) -> Result<SetEntry, Error> {
    state.save_set(&set).await
}

#[tauri::command]
pub async fn complete_set(state: State<'_, Coordinator>, id: String) -> Result<SetEntry, Error> {
    state.complete_set(&id).await
}

#[tauri::command]
pub async fn add_set(
    state: State<'_, Coordinator>,
    workout_exercise_id: String,
) -> Result<SetEntry, Error> {
    state.add_set(&workout_exercise_id).await
}

#[tauri::command]
pub async fn log_new_set(
    state: State<'_, Coordinator>,
    workout_exercise_id: String,
    values: SetValues,
) -> Result<SetEntry, Error> {
    state.log_new_set(&workout_exercise_id, &values).await
}

#[tauri::command]
pub async fn duplicate_set(state: State<'_, Coordinator>, id: String) -> Result<SetEntry, Error> {
    state.duplicate_set(&id).await
}

#[tauri::command]
pub async fn delete_set(state: State<'_, Coordinator>, id: String) -> Result<(), Error> {
    state.delete_set(&id).await
}

#[tauri::command]
pub async fn update_set_note(
    state: State<'_, Coordinator>,
    id: String,
    note: Option<String>,
) -> Result<SetEntry, Error> {
    state.update_set_note(&id, note.as_deref()).await
}

// ============ rest timer ============

#[tauri::command]
pub async fn start_rest_timer(
    state: State<'_, Coordinator>,
    total_ms: i64,
    options: Option<StartRestTimerOptions>,
) -> Result<RestTimerState, Error> {
    state
        .start_rest_timer(total_ms, &options.unwrap_or_default())
        .await
}

#[tauri::command]
pub async fn pause_rest_timer(state: State<'_, Coordinator>) -> Result<RestTimerState, Error> {
    state.pause_rest_timer().await
}

#[tauri::command]
pub async fn resume_rest_timer(state: State<'_, Coordinator>) -> Result<RestTimerState, Error> {
    state.resume_rest_timer().await
}

#[tauri::command]
pub async fn extend_rest_timer(
    state: State<'_, Coordinator>,
    delta_ms: i64,
) -> Result<RestTimerState, Error> {
    state.extend_rest_timer(delta_ms).await
}

#[tauri::command]
pub async fn dismiss_rest_timer(state: State<'_, Coordinator>) -> Result<RestTimerState, Error> {
    state.dismiss_rest_timer().await
}

#[tauri::command]
pub async fn get_rest_timer_state(state: State<'_, Coordinator>) -> Result<RestTimerState, Error> {
    state.get_rest_timer_state().await
}

// ============ barbells / plates ============

#[tauri::command]
pub async fn list_barbell_configs(
    state: State<'_, Coordinator>,
) -> Result<Vec<BarbellConfig>, Error> {
    state.list_barbell_configs().await
}

#[tauri::command]
pub fn calculate_plates(
    state: State<'_, Coordinator>,
    target_weight: f64,
    barbell: BarbellConfig,
) -> PlateCalculationResult {
    state.calculate_plates(target_weight, &barbell)
}

#[tauri::command]
pub async fn add_barbell_config(
    state: State<'_, Coordinator>,
    config: NewBarbellConfig,
) -> Result<BarbellConfig, Error> {
    state.add_barbell_config(&config).await
}

#[tauri::command]
pub async fn update_barbell_config(
    state: State<'_, Coordinator>,
    config: BarbellConfig,
) -> Result<BarbellConfig, Error> {
    state.update_barbell_config(&config).await
}

#[tauri::command]
pub async fn delete_barbell_config(state: State<'_, Coordinator>, id: String) -> Result<(), Error> {
    state.delete_barbell_config(&id).await
}

// ============ settings ============

#[tauri::command]
pub async fn get_settings(state: State<'_, Coordinator>) -> Result<Settings, Error> {
    state.get_settings().await
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, Coordinator>,
    patch: SettingsPatch,
) -> Result<Settings, Error> {
    state.update_settings(&patch).await
}

// ============ history ============

#[tauri::command]
pub async fn get_history_summary(state: State<'_, Coordinator>) -> Result<HistorySummary, Error> {
    state.get_history_summary().await
}

#[tauri::command]
pub async fn delete_all_history(state: State<'_, Coordinator>) -> Result<(), Error> {
    state.delete_all_history().await
}
