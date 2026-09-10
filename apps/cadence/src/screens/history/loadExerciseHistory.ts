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

/** A set paired with its workout's local training date — `Workout.date`, not `SetEntry.
 *  completedAt`, which `completeSet()` stores as a real UTC instant and can fall on a different
 *  calendar date near midnight outside UTC. Every date-bucketing derivation (graph points,
 *  records, stats) must group by this, not by slicing `completedAt`. */
export interface DatedSet {
	set: SetEntry;
	date: string;
}

export function flattenDatedSets(history: ExerciseHistoryEntry[]): DatedSet[] {
	return history.flatMap((entry) => entry.sets.map((set) => ({ set, date: entry.workout.date })));
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

	// A workout that's still all-planned hasn't happened yet — e.g. a future scheduled session —
	// so it isn't history. A workout with at least one completed set (or itself marked completed)
	// counts, even if it's today's still-in-progress session.
	const happened = entries.filter(
		(entry) =>
			entry.workout.status === 'completed' || entry.sets.some((s) => s.status === 'completed'),
	);

	return happened.sort((a, b) => b.workout.date.localeCompare(a.workout.date));
}
