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
	Exercise,
	PlateCalculationResult,
	RestTimerState,
	SetEntry,
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

	async duplicateWorkout(workoutId: string, targetDate: string): Promise<Workout> {
		return call('duplicate_workout', { workoutId, targetDate });
	}

	async updateWorkoutNote(workoutId: string, note: string | undefined): Promise<Workout> {
		return call('update_workout_note', { workoutId, note });
	}
}

export const tauriRepository = new TauriLoggingRepository();
