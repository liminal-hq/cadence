// Thin Tauri command wrappers, one per LoggingRepository method, delegating to the Coordinator
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use tauri::State;

use crate::domain::analysis::models::{AnalysisFavourite, AnalysisSetEntry};
use crate::domain::barbells::models::{BarbellConfig, NewBarbellConfig};
use crate::domain::barbells::plates::PlateCalculationResult;
use crate::domain::categories::models::Category;
use crate::domain::error::Error;
use crate::domain::exercises::models::{Exercise, ExerciseValues};
use crate::domain::goals::models::{ExerciseGoal, ExerciseGoalValues};
use crate::domain::history::HistorySummary;
use crate::domain::measurements::models::{MeasurementDefinition, MeasurementRecord};
use crate::domain::rest_timer::models::{RestTimerState, StartRestTimerOptions};
use crate::domain::routines::models::{
    Routine, RoutineExercise, RoutineSection, RoutineSuperset, SetTemplate, SetTemplateValues,
};
use crate::domain::sets::models::{SetEntry, SetValues};
use crate::domain::settings::models::{Settings, SettingsPatch};
use crate::domain::workouts::models::{Workout, WorkoutExercise};
use crate::domain::Coordinator;

// ============ categories ============

#[tauri::command]
pub async fn get_category(state: State<'_, Coordinator>, id: String) -> Result<Category, Error> {
    state.get_category(&id).await
}

#[tauri::command]
pub async fn list_categories(state: State<'_, Coordinator>) -> Result<Vec<Category>, Error> {
    state.list_categories().await
}

#[tauri::command]
pub async fn create_category(
    state: State<'_, Coordinator>,
    id: String,
    name: String,
    colour_background: String,
    colour_text: String,
    colour_dot: String,
) -> Result<Category, Error> {
    state
        .create_category(&id, &name, &colour_background, &colour_text, &colour_dot)
        .await
}

#[tauri::command]
pub async fn rename_category(
    state: State<'_, Coordinator>,
    id: String,
    name: String,
) -> Result<Category, Error> {
    state.rename_category(&id, &name).await
}

#[tauri::command]
pub async fn recolour_category(
    state: State<'_, Coordinator>,
    id: String,
    colour_background: String,
    colour_text: String,
    colour_dot: String,
) -> Result<Category, Error> {
    state
        .recolour_category(&id, &colour_background, &colour_text, &colour_dot)
        .await
}

#[tauri::command]
pub async fn set_category_archived(
    state: State<'_, Coordinator>,
    id: String,
    archived: bool,
) -> Result<Category, Error> {
    state.set_category_archived(&id, archived).await
}

#[tauri::command]
pub async fn delete_category(state: State<'_, Coordinator>, id: String) -> Result<(), Error> {
    state.delete_category(&id).await
}

#[tauri::command]
pub async fn reorder_categories(
    state: State<'_, Coordinator>,
    ordered_ids: Vec<String>,
) -> Result<Vec<Category>, Error> {
    state.reorder_categories(&ordered_ids).await
}

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

#[tauri::command]
pub async fn create_exercise(
    state: State<'_, Coordinator>,
    values: ExerciseValues,
) -> Result<Exercise, Error> {
    state.create_exercise(&values).await
}

#[tauri::command]
pub async fn update_exercise(
    state: State<'_, Coordinator>,
    id: String,
    values: ExerciseValues,
) -> Result<Exercise, Error> {
    state.update_exercise(&id, &values).await
}

#[tauri::command]
pub async fn set_exercise_archived(
    state: State<'_, Coordinator>,
    id: String,
    archived: bool,
) -> Result<Exercise, Error> {
    state.set_exercise_archived(&id, archived).await
}

#[tauri::command]
pub async fn delete_exercise(state: State<'_, Coordinator>, id: String) -> Result<(), Error> {
    state.delete_exercise(&id).await
}

// ============ goals ============

#[tauri::command]
pub async fn get_exercise_goal(
    state: State<'_, Coordinator>,
    id: String,
) -> Result<ExerciseGoal, Error> {
    state.get_exercise_goal(&id).await
}

#[tauri::command]
pub async fn list_exercise_goals(
    state: State<'_, Coordinator>,
    exercise_id: String,
) -> Result<Vec<ExerciseGoal>, Error> {
    state.list_exercise_goals(&exercise_id).await
}

#[tauri::command]
pub async fn create_exercise_goal(
    state: State<'_, Coordinator>,
    values: ExerciseGoalValues,
) -> Result<ExerciseGoal, Error> {
    state.create_exercise_goal(&values).await
}

#[tauri::command]
pub async fn update_exercise_goal(
    state: State<'_, Coordinator>,
    id: String,
    values: ExerciseGoalValues,
) -> Result<ExerciseGoal, Error> {
    state.update_exercise_goal(&id, &values).await
}

#[tauri::command]
pub async fn set_exercise_goal_achieved(
    state: State<'_, Coordinator>,
    id: String,
    achieved: bool,
) -> Result<ExerciseGoal, Error> {
    state.set_exercise_goal_achieved(&id, achieved).await
}

#[tauri::command]
pub async fn set_exercise_goal_archived(
    state: State<'_, Coordinator>,
    id: String,
    archived: bool,
) -> Result<ExerciseGoal, Error> {
    state.set_exercise_goal_archived(&id, archived).await
}

#[tauri::command]
pub async fn delete_exercise_goal(state: State<'_, Coordinator>, id: String) -> Result<(), Error> {
    state.delete_exercise_goal(&id).await
}

// ============ measurements ============

#[tauri::command]
pub async fn get_measurement_definition(
    state: State<'_, Coordinator>,
    id: String,
) -> Result<MeasurementDefinition, Error> {
    state.get_measurement_definition(&id).await
}

#[tauri::command]
pub async fn list_measurement_definitions(
    state: State<'_, Coordinator>,
) -> Result<Vec<MeasurementDefinition>, Error> {
    state.list_measurement_definitions().await
}

#[tauri::command]
pub async fn create_measurement_definition(
    state: State<'_, Coordinator>,
    name: String,
    unit: String,
) -> Result<MeasurementDefinition, Error> {
    state.create_measurement_definition(&name, &unit).await
}

#[tauri::command]
pub async fn update_measurement_definition(
    state: State<'_, Coordinator>,
    id: String,
    name: String,
    unit: String,
    goal: Option<f64>,
) -> Result<MeasurementDefinition, Error> {
    state
        .update_measurement_definition(&id, &name, &unit, goal)
        .await
}

#[tauri::command]
pub async fn set_measurement_definition_archived(
    state: State<'_, Coordinator>,
    id: String,
    archived: bool,
) -> Result<MeasurementDefinition, Error> {
    state
        .set_measurement_definition_archived(&id, archived)
        .await
}

#[tauri::command]
pub async fn reorder_measurement_definitions(
    state: State<'_, Coordinator>,
    ordered_ids: Vec<String>,
) -> Result<Vec<MeasurementDefinition>, Error> {
    state.reorder_measurement_definitions(&ordered_ids).await
}

#[tauri::command]
pub async fn delete_measurement_definition(
    state: State<'_, Coordinator>,
    id: String,
) -> Result<(), Error> {
    state.delete_measurement_definition(&id).await
}

#[tauri::command]
pub async fn get_measurement_record(
    state: State<'_, Coordinator>,
    id: String,
) -> Result<MeasurementRecord, Error> {
    state.get_measurement_record(&id).await
}

#[tauri::command]
pub async fn list_measurement_records(
    state: State<'_, Coordinator>,
    definition_id: String,
) -> Result<Vec<MeasurementRecord>, Error> {
    state.list_measurement_records(&definition_id).await
}

#[tauri::command]
pub async fn create_measurement_record(
    state: State<'_, Coordinator>,
    definition_id: String,
    date: String,
    value: f64,
    note: Option<String>,
    recorded_at: Option<String>,
) -> Result<MeasurementRecord, Error> {
    state
        .create_measurement_record(
            &definition_id,
            &date,
            value,
            note.as_deref(),
            recorded_at.as_deref(),
        )
        .await
}

#[tauri::command]
pub async fn update_measurement_record(
    state: State<'_, Coordinator>,
    id: String,
    date: String,
    value: f64,
    note: Option<String>,
    recorded_at: Option<String>,
) -> Result<MeasurementRecord, Error> {
    state
        .update_measurement_record(&id, &date, value, note.as_deref(), recorded_at.as_deref())
        .await
}

#[tauri::command]
pub async fn delete_measurement_record(
    state: State<'_, Coordinator>,
    id: String,
) -> Result<(), Error> {
    state.delete_measurement_record(&id).await
}

// ============ analysis ============

#[tauri::command]
pub async fn list_analysis_sets(
    state: State<'_, Coordinator>,
    start_date: String,
    end_date: String,
) -> Result<Vec<AnalysisSetEntry>, Error> {
    state.list_analysis_sets(&start_date, &end_date).await
}

#[tauri::command]
pub async fn get_analysis_favourite(
    state: State<'_, Coordinator>,
    id: String,
) -> Result<AnalysisFavourite, Error> {
    state.get_analysis_favourite(&id).await
}

#[tauri::command]
pub async fn list_analysis_favourites(
    state: State<'_, Coordinator>,
) -> Result<Vec<AnalysisFavourite>, Error> {
    state.list_analysis_favourites().await
}

#[tauri::command]
pub async fn create_analysis_favourite(
    state: State<'_, Coordinator>,
    name: String,
    config: String,
) -> Result<AnalysisFavourite, Error> {
    state.create_analysis_favourite(&name, &config).await
}

#[tauri::command]
pub async fn update_analysis_favourite(
    state: State<'_, Coordinator>,
    id: String,
    name: String,
    config: String,
) -> Result<AnalysisFavourite, Error> {
    state.update_analysis_favourite(&id, &name, &config).await
}

#[tauri::command]
pub async fn reorder_analysis_favourites(
    state: State<'_, Coordinator>,
    ordered_ids: Vec<String>,
) -> Result<Vec<AnalysisFavourite>, Error> {
    state.reorder_analysis_favourites(&ordered_ids).await
}

#[tauri::command]
pub async fn delete_analysis_favourite(
    state: State<'_, Coordinator>,
    id: String,
) -> Result<(), Error> {
    state.delete_analysis_favourite(&id).await
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
pub async fn complete_workout(
    state: State<'_, Coordinator>,
    workout_id: String,
) -> Result<Workout, Error> {
    state.complete_workout(&workout_id).await
}

#[tauri::command]
pub async fn abandon_workout(
    state: State<'_, Coordinator>,
    workout_id: String,
) -> Result<Workout, Error> {
    state.abandon_workout(&workout_id).await
}

#[tauri::command]
pub async fn reopen_workout(
    state: State<'_, Coordinator>,
    workout_id: String,
) -> Result<Workout, Error> {
    state.reopen_workout(&workout_id).await
}

#[tauri::command]
pub async fn create_workout(
    state: State<'_, Coordinator>,
    local_date: String,
    title: String,
) -> Result<Workout, Error> {
    state.create_workout(&local_date, &title).await
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
pub async fn add_workout_exercise(
    state: State<'_, Coordinator>,
    workout_id: String,
    exercise_id: String,
) -> Result<WorkoutExercise, Error> {
    state.add_workout_exercise(&workout_id, &exercise_id).await
}

#[tauri::command]
pub async fn delete_workout_exercise(
    state: State<'_, Coordinator>,
    id: String,
) -> Result<(), Error> {
    state.delete_workout_exercise(&id).await
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

// ============ routines ============

#[tauri::command]
pub async fn get_routine(state: State<'_, Coordinator>, id: String) -> Result<Routine, Error> {
    state.get_routine(&id).await
}

#[tauri::command]
pub async fn list_routines(state: State<'_, Coordinator>) -> Result<Vec<Routine>, Error> {
    state.list_routines().await
}

#[tauri::command]
pub async fn create_routine(state: State<'_, Coordinator>, name: String) -> Result<Routine, Error> {
    state.create_routine(&name).await
}

#[tauri::command]
pub async fn rename_routine(
    state: State<'_, Coordinator>,
    id: String,
    name: String,
) -> Result<Routine, Error> {
    state.rename_routine(&id, &name).await
}

#[tauri::command]
pub async fn update_routine_note(
    state: State<'_, Coordinator>,
    id: String,
    note: Option<String>,
) -> Result<Routine, Error> {
    state.update_routine_note(&id, note.as_deref()).await
}

#[tauri::command]
pub async fn set_routine_archived(
    state: State<'_, Coordinator>,
    id: String,
    archived: bool,
) -> Result<Routine, Error> {
    state.set_routine_archived(&id, archived).await
}

#[tauri::command]
pub async fn delete_routine(state: State<'_, Coordinator>, id: String) -> Result<(), Error> {
    state.delete_routine(&id).await
}

#[tauri::command]
pub async fn get_routine_section(
    state: State<'_, Coordinator>,
    id: String,
) -> Result<RoutineSection, Error> {
    state.get_routine_section(&id).await
}

#[tauri::command]
pub async fn list_routine_sections(
    state: State<'_, Coordinator>,
    routine_id: String,
) -> Result<Vec<RoutineSection>, Error> {
    state.list_routine_sections(&routine_id).await
}

#[tauri::command]
pub async fn add_routine_section(
    state: State<'_, Coordinator>,
    routine_id: String,
    name: Option<String>,
) -> Result<RoutineSection, Error> {
    state
        .add_routine_section(&routine_id, name.as_deref())
        .await
}

#[tauri::command]
pub async fn rename_routine_section(
    state: State<'_, Coordinator>,
    id: String,
    name: Option<String>,
) -> Result<RoutineSection, Error> {
    state.rename_routine_section(&id, name.as_deref()).await
}

#[tauri::command]
pub async fn reorder_routine_sections(
    state: State<'_, Coordinator>,
    routine_id: String,
    ordered_ids: Vec<String>,
) -> Result<Vec<RoutineSection>, Error> {
    state
        .reorder_routine_sections(&routine_id, &ordered_ids)
        .await
}

#[tauri::command]
pub async fn delete_routine_section(
    state: State<'_, Coordinator>,
    id: String,
) -> Result<(), Error> {
    state.delete_routine_section(&id).await
}

#[tauri::command]
pub async fn get_routine_superset(
    state: State<'_, Coordinator>,
    id: String,
) -> Result<RoutineSuperset, Error> {
    state.get_routine_superset(&id).await
}

#[tauri::command]
pub async fn create_routine_superset(
    state: State<'_, Coordinator>,
    routine_section_id: String,
    colour: Option<String>,
    auto_advance: bool,
    rest_ms: Option<i64>,
) -> Result<RoutineSuperset, Error> {
    state
        .create_routine_superset(
            &routine_section_id,
            colour.as_deref(),
            auto_advance,
            rest_ms,
        )
        .await
}

#[tauri::command]
pub async fn delete_routine_superset(
    state: State<'_, Coordinator>,
    id: String,
) -> Result<(), Error> {
    state.delete_routine_superset(&id).await
}

#[tauri::command]
pub async fn get_routine_exercise(
    state: State<'_, Coordinator>,
    id: String,
) -> Result<RoutineExercise, Error> {
    state.get_routine_exercise(&id).await
}

#[tauri::command]
pub async fn list_routine_exercises(
    state: State<'_, Coordinator>,
    routine_section_id: String,
) -> Result<Vec<RoutineExercise>, Error> {
    state.list_routine_exercises(&routine_section_id).await
}

#[tauri::command]
pub async fn add_routine_exercise(
    state: State<'_, Coordinator>,
    routine_section_id: String,
    exercise_id: String,
) -> Result<RoutineExercise, Error> {
    state
        .add_routine_exercise(&routine_section_id, &exercise_id)
        .await
}

#[tauri::command]
pub async fn reorder_routine_exercises(
    state: State<'_, Coordinator>,
    routine_section_id: String,
    ordered_ids: Vec<String>,
) -> Result<Vec<RoutineExercise>, Error> {
    state
        .reorder_routine_exercises(&routine_section_id, &ordered_ids)
        .await
}

#[tauri::command]
pub async fn set_routine_exercise_superset(
    state: State<'_, Coordinator>,
    id: String,
    routine_superset_id: Option<String>,
    superset_position: Option<i32>,
) -> Result<RoutineExercise, Error> {
    state
        .set_routine_exercise_superset(&id, routine_superset_id.as_deref(), superset_position)
        .await
}

#[tauri::command]
pub async fn update_routine_exercise_note(
    state: State<'_, Coordinator>,
    id: String,
    note: Option<String>,
) -> Result<RoutineExercise, Error> {
    state
        .update_routine_exercise_note(&id, note.as_deref())
        .await
}

#[tauri::command]
pub async fn update_routine_exercise_rest(
    state: State<'_, Coordinator>,
    id: String,
    rest_ms: Option<i64>,
) -> Result<RoutineExercise, Error> {
    state.update_routine_exercise_rest(&id, rest_ms).await
}

#[tauri::command]
pub async fn delete_routine_exercise(
    state: State<'_, Coordinator>,
    id: String,
) -> Result<(), Error> {
    state.delete_routine_exercise(&id).await
}

#[tauri::command]
pub async fn list_set_templates(
    state: State<'_, Coordinator>,
    routine_exercise_id: String,
) -> Result<Vec<SetTemplate>, Error> {
    state.list_set_templates(&routine_exercise_id).await
}

#[tauri::command]
pub async fn add_set_template(
    state: State<'_, Coordinator>,
    routine_exercise_id: String,
    values: SetTemplateValues,
) -> Result<SetTemplate, Error> {
    state.add_set_template(&routine_exercise_id, &values).await
}

#[tauri::command]
pub async fn delete_set_template(state: State<'_, Coordinator>, id: String) -> Result<(), Error> {
    state.delete_set_template(&id).await
}

#[tauri::command]
pub async fn most_recent_completed_set(
    state: State<'_, Coordinator>,
    exercise_id: String,
    on_or_before_date: String,
) -> Result<Option<SetValues>, Error> {
    state
        .most_recent_completed_set(&exercise_id, &on_or_before_date)
        .await
}

#[tauri::command]
pub async fn materialize_routine_section(
    state: State<'_, Coordinator>,
    routine_section_id: String,
    target_date: String,
    selected_routine_exercise_ids: Vec<String>,
) -> Result<Workout, Error> {
    state
        .materialize_routine_section(
            &routine_section_id,
            &target_date,
            &selected_routine_exercise_ids,
        )
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
