// Fetches a workout's exercises and sets in the shape formatSetSummary needs, and derives
// whether it has any completed set at all — shared glue between Calendar, List, and the day
// expansion, all of which need the same data
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LoggingRepository } from '../../domain/repository';
import type { Workout } from '../../domain/types';
import type { SetSummaryExerciseInput } from './formatSetSummary';

export interface WorkoutSummary {
	workout: Workout;
	exercises: SetSummaryExerciseInput[];
	hasCompletedSets: boolean;
	/** The first exercise's category — stands in for "the" category of a multi-exercise workout,
	 *  e.g. for the calendar's one-dot-per-workout colour. */
	primaryCategory?: string;
}

export async function loadWorkoutSummary(
	repository: LoggingRepository,
	workoutId: string,
): Promise<WorkoutSummary> {
	const workout = await repository.getWorkout(workoutId);
	const workoutExercises = await repository.listWorkoutExercisesByWorkout(workoutId);

	const exerciseDetails = await Promise.all(
		workoutExercises.map(async (we) => {
			const [exercise, sets] = await Promise.all([
				repository.getExercise(we.exerciseId),
				repository.listSets(we.id),
			]);
			return { exercise, sets };
		}),
	);

	const exercises = exerciseDetails.map(({ exercise, sets }) => ({
		name: exercise.name,
		metricProfile: exercise.metricProfile,
		archived: exercise.archived,
		sets,
	}));

	return {
		workout,
		exercises,
		hasCompletedSets: exercises.some((e) => e.sets.some((s) => s.status === 'completed')),
		primaryCategory: exerciseDetails[0]?.exercise.category,
	};
}
