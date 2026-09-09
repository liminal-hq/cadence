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
	WorkoutExercise,
} from './types';

export type Unsubscribe = () => void;

export interface LoggingRepository {
	getWorkoutExercise(id: string): Promise<WorkoutExercise>;
	/** Sibling exercises in the same workout, ordered -- drives P-14's previous/next-exercise navigation. */
	listWorkoutExercisesByWorkout(workoutId: string): Promise<WorkoutExercise[]>;
	getExercise(id: string): Promise<Exercise>;
	listSets(workoutExerciseId: string): Promise<SetEntry[]>;
	saveSet(set: SetEntry): Promise<SetEntry>;
	completeSet(setId: string): Promise<SetEntry>;
	addSet(workoutExerciseId: string): Promise<SetEntry>;
	duplicateSet(setId: string): Promise<SetEntry>;
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
	/** Pushed on every transition -- mirrors how the real backend will notify over a Tauri event, not a poll. */
	subscribeRestTimer(onChange: (state: RestTimerState) => void): Unsubscribe;

	listBarbellConfigs(): Promise<BarbellConfig[]>;
	/** `targetWeight` is in `barbell.displayUnit` -- see the note on BarbellConfig. */
	calculatePlates(targetWeight: number, barbell: BarbellConfig): Promise<PlateCalculationResult>;
}
