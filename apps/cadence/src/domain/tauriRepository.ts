// A LoggingRepository backed by the real Tauri/Rust/SQLite backend, invoking one command per
// method — see apps/cadence/src-tauri/src/commands.rs for the Rust side of this mapping.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { LoggingRepository, Unsubscribe } from './repository';
import type {
	BarbellConfig,
	Category,
	Exercise,
	PlateCalculationResult,
	RestTimerState,
	Routine,
	RoutineExercise,
	RoutineSection,
	RoutineSuperset,
	SetEntry,
	SetTemplate,
	SetTemplateValues,
	Settings,
	Workout,
	WorkoutExercise,
} from './types';

/** The `{kind, message}` shape every Rust domain::Error serializes as (see error.rs) — invoke()
 *  rejects with this plain object, not an Error instance, so callers get a real Error back. */
interface BackendError {
	kind: string;
	message: string;
}

function isBackendError(value: unknown): value is BackendError {
	return (
		typeof value === 'object' &&
		value !== null &&
		'kind' in value &&
		'message' in value &&
		typeof (value as BackendError).message === 'string'
	);
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
	try {
		return await invoke<T>(command, args);
	} catch (error) {
		if (isBackendError(error)) {
			throw Object.assign(new Error(error.message), { kind: error.kind });
		}
		throw error;
	}
}

export class TauriLoggingRepository implements LoggingRepository {
	async getWorkoutExercise(id: string): Promise<WorkoutExercise> {
		return call('get_workout_exercise', { id });
	}

	async listWorkoutExercisesByWorkout(workoutId: string): Promise<WorkoutExercise[]> {
		return call('list_workout_exercises_by_workout', { workoutId });
	}

	async listWorkoutExercisesByExercise(exerciseId: string): Promise<WorkoutExercise[]> {
		return call('list_workout_exercises_by_exercise', { exerciseId });
	}

	async getExercise(id: string): Promise<Exercise> {
		return call('get_exercise', { id });
	}

	async listExercises(): Promise<Exercise[]> {
		return call('list_exercises');
	}

	async updateExerciseFavourite(exerciseId: string, favourite: boolean): Promise<Exercise> {
		return call('update_exercise_favourite', { id: exerciseId, favourite });
	}

	async listSets(workoutExerciseId: string): Promise<SetEntry[]> {
		return call('list_sets', { workoutExerciseId });
	}

	async saveSet(set: SetEntry): Promise<SetEntry> {
		return call('save_set', { set });
	}

	async completeSet(setId: string): Promise<SetEntry> {
		return call('complete_set', { id: setId });
	}

	async addSet(workoutExerciseId: string): Promise<SetEntry> {
		return call('add_set', { workoutExerciseId });
	}

	async logNewSet(
		workoutExerciseId: string,
		values: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'distanceKm' | 'durationSec'>>,
	): Promise<SetEntry> {
		return call('log_new_set', { workoutExerciseId, values });
	}

	async duplicateSet(setId: string): Promise<SetEntry> {
		return call('duplicate_set', { id: setId });
	}

	async deleteSet(setId: string): Promise<void> {
		return call('delete_set', { id: setId });
	}

	async updateSetNote(setId: string, note: string | undefined): Promise<SetEntry> {
		return call('update_set_note', { id: setId, note });
	}

	async updateTodayNote(
		workoutExerciseId: string,
		note: string | undefined,
	): Promise<WorkoutExercise> {
		return call('update_today_note', { workoutExerciseId, note });
	}

	async startRestTimer(
		totalMs: number,
		options?: {
			forSetId?: string;
			nextSetLabel?: string;
			ownerDevice?: RestTimerState['ownerDevice'];
		},
	): Promise<RestTimerState> {
		return call('start_rest_timer', { totalMs, options });
	}

	async pauseRestTimer(): Promise<RestTimerState> {
		return call('pause_rest_timer');
	}

	async resumeRestTimer(): Promise<RestTimerState> {
		return call('resume_rest_timer');
	}

	async extendRestTimer(deltaMs: number): Promise<RestTimerState> {
		return call('extend_rest_timer', { deltaMs });
	}

	async dismissRestTimer(): Promise<RestTimerState> {
		return call('dismiss_rest_timer');
	}

	async getRestTimerState(): Promise<RestTimerState> {
		return call('get_rest_timer_state');
	}

	subscribeRestTimer(onChange: (state: RestTimerState) => void): Unsubscribe {
		const unlistenPromise = listen<RestTimerState>('rest-timer:changed', (event) =>
			onChange(event.payload),
		);
		let unsubscribed = false;
		unlistenPromise.catch(() => {
			// Handled by the .then() below once the promise settles; swallowed here so an
			// unsubscribe-before-connect race never surfaces as an unhandled rejection.
		});
		return () => {
			unsubscribed = true;
			void unlistenPromise.then((unlisten) => {
				if (unsubscribed) unlisten();
			});
		};
	}

	async listBarbellConfigs(): Promise<BarbellConfig[]> {
		return call('list_barbell_configs');
	}

	async calculatePlates(
		targetWeight: number,
		barbell: BarbellConfig,
	): Promise<PlateCalculationResult> {
		return call('calculate_plates', { targetWeight, barbell });
	}

	async addBarbellConfig(config: Omit<BarbellConfig, 'id'>): Promise<BarbellConfig> {
		return call('add_barbell_config', { config });
	}

	async updateBarbellConfig(config: BarbellConfig): Promise<BarbellConfig> {
		return call('update_barbell_config', { config });
	}

	async deleteBarbellConfig(id: string): Promise<void> {
		return call('delete_barbell_config', { id });
	}

	async getSettings(): Promise<Settings> {
		return call('get_settings');
	}

	async updateSettings(patch: Partial<Settings>): Promise<Settings> {
		return call('update_settings', { patch });
	}

	async getHistorySummary(): Promise<{ workoutCount: number; setCount: number }> {
		return call('get_history_summary');
	}

	async deleteAllHistory(): Promise<void> {
		return call('delete_all_history');
	}

	async getWorkout(id: string): Promise<Workout> {
		return call('get_workout', { id });
	}

	async listWorkoutsInRange(startDate: string, endDate: string): Promise<Workout[]> {
		return call('list_workouts_in_range', { startDate, endDate });
	}

	async createWorkout(localDate: string, title: string): Promise<Workout> {
		return call('create_workout', { localDate, title });
	}

	async duplicateWorkout(workoutId: string, targetDate: string): Promise<Workout> {
		return call('duplicate_workout', { workoutId, targetDate });
	}

	async updateWorkoutNote(workoutId: string, note: string | undefined): Promise<Workout> {
		return call('update_workout_note', { workoutId, note });
	}

	async addWorkoutExercise(workoutId: string, exerciseId: string): Promise<WorkoutExercise> {
		return call('add_workout_exercise', { workoutId, exerciseId });
	}

	async deleteWorkoutExercise(id: string): Promise<void> {
		return call('delete_workout_exercise', { id });
	}

	async getRoutine(id: string): Promise<Routine> {
		return call('get_routine', { id });
	}

	async listRoutines(): Promise<Routine[]> {
		return call('list_routines');
	}

	async createRoutine(name: string): Promise<Routine> {
		return call('create_routine', { name });
	}

	async renameRoutine(id: string, name: string): Promise<Routine> {
		return call('rename_routine', { id, name });
	}

	async updateRoutineNote(id: string, note: string | undefined): Promise<Routine> {
		return call('update_routine_note', { id, note });
	}

	async setRoutineArchived(id: string, archived: boolean): Promise<Routine> {
		return call('set_routine_archived', { id, archived });
	}

	async deleteRoutine(id: string): Promise<void> {
		return call('delete_routine', { id });
	}

	async getRoutineSection(id: string): Promise<RoutineSection> {
		return call('get_routine_section', { id });
	}

	async listRoutineSections(routineId: string): Promise<RoutineSection[]> {
		return call('list_routine_sections', { routineId });
	}

	async addRoutineSection(routineId: string, name: string | undefined): Promise<RoutineSection> {
		return call('add_routine_section', { routineId, name });
	}

	async reorderRoutineSections(routineId: string, orderedIds: string[]): Promise<RoutineSection[]> {
		return call('reorder_routine_sections', { routineId, orderedIds });
	}

	async deleteRoutineSection(id: string): Promise<void> {
		return call('delete_routine_section', { id });
	}

	async getRoutineSuperset(id: string): Promise<RoutineSuperset> {
		return call('get_routine_superset', { id });
	}

	async createRoutineSuperset(
		routineSectionId: string,
		colour: string | undefined,
		autoAdvance: boolean,
		restMs: number | undefined,
	): Promise<RoutineSuperset> {
		return call('create_routine_superset', { routineSectionId, colour, autoAdvance, restMs });
	}

	async deleteRoutineSuperset(id: string): Promise<void> {
		return call('delete_routine_superset', { id });
	}

	async getRoutineExercise(id: string): Promise<RoutineExercise> {
		return call('get_routine_exercise', { id });
	}

	async listRoutineExercises(routineSectionId: string): Promise<RoutineExercise[]> {
		return call('list_routine_exercises', { routineSectionId });
	}

	async addRoutineExercise(routineSectionId: string, exerciseId: string): Promise<RoutineExercise> {
		return call('add_routine_exercise', { routineSectionId, exerciseId });
	}

	async reorderRoutineExercises(
		routineSectionId: string,
		orderedIds: string[],
	): Promise<RoutineExercise[]> {
		return call('reorder_routine_exercises', { routineSectionId, orderedIds });
	}

	async setRoutineExerciseSuperset(
		id: string,
		assignment: { routineSupersetId: string; supersetPosition: number } | undefined,
	): Promise<RoutineExercise> {
		return call('set_routine_exercise_superset', {
			id,
			routineSupersetId: assignment?.routineSupersetId,
			supersetPosition: assignment?.supersetPosition,
		});
	}

	async updateRoutineExerciseNote(id: string, note: string | undefined): Promise<RoutineExercise> {
		return call('update_routine_exercise_note', { id, note });
	}

	async deleteRoutineExercise(id: string): Promise<void> {
		return call('delete_routine_exercise', { id });
	}

	async listSetTemplates(routineExerciseId: string): Promise<SetTemplate[]> {
		return call('list_set_templates', { routineExerciseId });
	}

	async addSetTemplate(routineExerciseId: string, values: SetTemplateValues): Promise<SetTemplate> {
		return call('add_set_template', { routineExerciseId, values });
	}

	async deleteSetTemplate(id: string): Promise<void> {
		return call('delete_set_template', { id });
	}

	async materializeRoutineSection(
		routineSectionId: string,
		targetDate: string,
		selectedRoutineExerciseIds: string[],
	): Promise<Workout> {
		return call('materialize_routine_section', {
			routineSectionId,
			targetDate,
			selectedRoutineExerciseIds,
		});
	}

	async getCategory(id: string): Promise<Category> {
		return call('get_category', { id });
	}

	async listCategories(): Promise<Category[]> {
		return call('list_categories');
	}

	async createCategory(
		id: string,
		name: string,
		colourBackground: string,
		colourText: string,
		colourDot: string,
	): Promise<Category> {
		return call('create_category', { id, name, colourBackground, colourText, colourDot });
	}

	async renameCategory(id: string, name: string): Promise<Category> {
		return call('rename_category', { id, name });
	}

	async recolourCategory(
		id: string,
		colourBackground: string,
		colourText: string,
		colourDot: string,
	): Promise<Category> {
		return call('recolour_category', { id, colourBackground, colourText, colourDot });
	}

	async setCategoryArchived(id: string, archived: boolean): Promise<Category> {
		return call('set_category_archived', { id, archived });
	}

	async deleteCategory(id: string): Promise<void> {
		return call('delete_category', { id });
	}
}

export const tauriRepository = new TauriLoggingRepository();
