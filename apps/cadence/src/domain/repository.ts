// The logging flow's data-access boundary. Every method is async, even
// though the mock implementation resolves immediately, so a future
// Tauri `invoke()`-backed implementation is a drop-in swap with no
// call-site changes.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

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

export type Unsubscribe = () => void;

export interface LoggingRepository {
	getWorkoutExercise(id: string): Promise<WorkoutExercise>;
	/** Sibling exercises in the same workout, ordered — drives P-14's previous/next-exercise navigation. */
	listWorkoutExercisesByWorkout(workoutId: string): Promise<WorkoutExercise[]>;
	/** Every occurrence of this exercise across every workout — Exercise detail's (P-44) durable
	 *  history, graph, records, and stats are all derived from this one query. */
	listWorkoutExercisesByExercise(exerciseId: string): Promise<WorkoutExercise[]>;
	getExercise(id: string): Promise<Exercise>;
	updateExerciseFavourite(exerciseId: string, favourite: boolean): Promise<Exercise>;
	listSets(workoutExerciseId: string): Promise<SetEntry[]>;
	saveSet(set: SetEntry): Promise<SetEntry>;
	completeSet(setId: string): Promise<SetEntry>;
	addSet(workoutExerciseId: string): Promise<SetEntry>;
	/** Creates a set that's already completed with the given values — used to log a fresh set
	 *  directly from the cluster's "next" draft, rather than creating a planned set first. */
	logNewSet(
		workoutExerciseId: string,
		values: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'distanceKm' | 'durationSec'>>,
	): Promise<SetEntry>;
	duplicateSet(setId: string): Promise<SetEntry>;
	deleteSet(setId: string): Promise<void>;
	updateSetNote(setId: string, note: string | undefined): Promise<SetEntry>;
	updateTodayNote(workoutExerciseId: string, note: string | undefined): Promise<WorkoutExercise>;

	startRestTimer(
		totalMs: number,
		options?: {
			forSetId?: string;
			nextSetLabel?: string;
			ownerDevice?: RestTimerState['ownerDevice'];
		},
	): Promise<RestTimerState>;
	pauseRestTimer(): Promise<RestTimerState>;
	resumeRestTimer(): Promise<RestTimerState>;
	extendRestTimer(deltaMs: number): Promise<RestTimerState>;
	dismissRestTimer(): Promise<RestTimerState>;
	getRestTimerState(): Promise<RestTimerState>;
	/** Pushed on every transition — mirrors how the real backend will notify over a Tauri event, not a poll. */
	subscribeRestTimer(onChange: (state: RestTimerState) => void): Unsubscribe;

	listBarbellConfigs(): Promise<BarbellConfig[]>;
	/** `targetWeight` is in `barbell.displayUnit` — see the note on BarbellConfig. */
	calculatePlates(targetWeight: number, barbell: BarbellConfig): Promise<PlateCalculationResult>;
	/** Setting `isDefault: true` clears it on every other config — at most one default at a time. */
	addBarbellConfig(config: Omit<BarbellConfig, 'id'>): Promise<BarbellConfig>;
	updateBarbellConfig(config: BarbellConfig): Promise<BarbellConfig>;
	/** A no-op when this is the last remaining config — the plate calculator has no empty state. */
	deleteBarbellConfig(id: string): Promise<void>;

	getSettings(): Promise<Settings>;
	updateSettings(patch: Partial<Settings>): Promise<Settings>;
	/** Counts of what P-62's delete-all confirmation is about to remove. */
	getHistorySummary(): Promise<{ workoutCount: number; setCount: number }>;
	/** Clears completed workouts, the workoutExercise occurrences and sets that belonged to them,
	 *  and nothing else — an in-progress workout's own workoutExercises/sets, plus exercises,
	 *  barbells, and settings, all survive, since Today and Logging resolve workout exercises by
	 *  id independently of whether they have any recorded history. */
	deleteAllHistory(): Promise<void>;

	getWorkout(id: string): Promise<Workout>;
	/** Inclusive of both bounds, ordered by date — drives both Calendar's month queries and
	 *  List's pagination. */
	listWorkoutsInRange(startDate: string, endDate: string): Promise<Workout[]>;
	/** Creates a new planned-status copy of every set in `workoutId`, dated `targetDate` — the
	 *  "Copy to today" action, one level up from duplicateSet's already-established pattern. */
	duplicateWorkout(workoutId: string, targetDate: string): Promise<Workout>;
	updateWorkoutNote(workoutId: string, note: string | undefined): Promise<Workout>;
}
