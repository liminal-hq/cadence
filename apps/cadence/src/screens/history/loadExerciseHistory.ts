// Fetches every occurrence of an exercise across every workout, most recent first — the single
// query P-44's History, Graph, Records, and Stats tabs all build on
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LoggingRepository } from '../../domain/repository';
import type { SetEntry, Workout, WorkoutExercise } from '../../domain/types';

export interface ExerciseHistoryEntry {
	workoutExercise: WorkoutExercise;
	workout: Workout;
	sets: SetEntry[];
}

export async function loadExerciseHistory(
	repository: LoggingRepository,
	exerciseId: string,
): Promise<ExerciseHistoryEntry[]> {
	const workoutExercises = await repository.listWorkoutExercisesByExercise(exerciseId);

	const entries = await Promise.all(
		workoutExercises.map(async (workoutExercise) => {
			const [workout, sets] = await Promise.all([
				repository.getWorkout(workoutExercise.workoutId),
				repository.listSets(workoutExercise.id),
			]);
			return { workoutExercise, workout, sets };
		}),
	);

	return entries.sort((a, b) => b.workout.date.localeCompare(a.workout.date));
}
