// Covers excluding not-yet-happened workouts from an exercise's history, and DatedSet flattening
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { flattenDatedSets, loadExerciseHistory } from './loadExerciseHistory';
import type { LoggingRepository } from '../../domain/repository';
import type { SetEntry, Workout, WorkoutExercise } from '../../domain/types';

function fakeRepository(
	workouts: Workout[],
	workoutExercises: WorkoutExercise[],
	sets: SetEntry[],
) {
	return {
		listWorkoutExercisesByExercise: async (exerciseId: string) =>
			workoutExercises.filter((we) => we.exerciseId === exerciseId),
		getWorkout: async (id: string) => {
			const workout = workouts.find((w) => w.id === id);
			if (!workout) throw new Error(`Unknown workout: ${id}`);
			return workout;
		},
		listSets: async (workoutExerciseId: string) =>
			sets.filter((s) => s.workoutExerciseId === workoutExerciseId),
	} as unknown as LoggingRepository;
}

describe('loadExerciseHistory', () => {
	it('excludes a future, all-planned workout from history', async () => {
		const repo = fakeRepository(
			[
				{
					id: 'w-past',
					date: '2026-09-01',
					title: 'Push A',
					status: 'completed',
					source: 'manual',
				},
				{
					id: 'w-future',
					date: '2026-09-20',
					title: 'Push A',
					status: 'active',
					source: 'manual',
				},
			],
			[
				{ id: 'we-past', exerciseId: 'ex-bench', workoutId: 'w-past', workoutLabel: '', order: 1 },
				{
					id: 'we-future',
					exerciseId: 'ex-bench',
					workoutId: 'w-future',
					workoutLabel: '',
					order: 1,
				},
			],
			[
				{
					id: 's-past',
					workoutExerciseId: 'we-past',
					order: 1,
					status: 'completed',
					weightKg: 80,
					reps: 8,
				},
				{
					id: 's-future',
					workoutExerciseId: 'we-future',
					order: 1,
					status: 'planned',
					weightKg: 80,
					reps: 8,
				},
			],
		);

		const history = await loadExerciseHistory(repo, 'ex-bench');
		expect(history.map((h) => h.workout.id)).toEqual(['w-past']);
	});

	it('includes an active workout once it has at least one completed set', async () => {
		const repo = fakeRepository(
			[
				{
					id: 'w-today',
					date: '2026-09-09',
					title: 'Push A',
					status: 'active',
					source: 'manual',
				},
			],
			[
				{
					id: 'we-today',
					exerciseId: 'ex-bench',
					workoutId: 'w-today',
					workoutLabel: '',
					order: 1,
				},
			],
			[
				{
					id: 's-today',
					workoutExerciseId: 'we-today',
					order: 1,
					status: 'completed',
					weightKg: 80,
					reps: 8,
				},
			],
		);

		const history = await loadExerciseHistory(repo, 'ex-bench');
		expect(history.map((h) => h.workout.id)).toEqual(['w-today']);
	});

	// SPEC.md 8.1's abandoning "does not lock history" — an abandoned workout counts as history the
	// same way a completed one does, even when this specific exercise's own sets never got marked
	// completed within it (only planned).
	it('includes an abandoned workout even when this exercise has no completed set', async () => {
		const repo = fakeRepository(
			[
				{
					id: 'w-abandoned',
					date: '2026-09-05',
					title: 'Push A',
					status: 'abandoned',
					source: 'manual',
				},
			],
			[
				{
					id: 'we-abandoned',
					exerciseId: 'ex-bench',
					workoutId: 'w-abandoned',
					workoutLabel: '',
					order: 1,
				},
			],
			[
				{
					id: 's-abandoned',
					workoutExerciseId: 'we-abandoned',
					order: 1,
					status: 'planned',
					weightKg: 80,
					reps: 8,
				},
			],
		);

		const history = await loadExerciseHistory(repo, 'ex-bench');
		expect(history.map((h) => h.workout.id)).toEqual(['w-abandoned']);
	});
});

describe('flattenDatedSets', () => {
	it('pairs each set with its workout date', () => {
		const flattened = flattenDatedSets([
			{
				workoutExercise: { id: 'we', exerciseId: 'ex', workoutId: 'w', workoutLabel: '', order: 1 },
				workout: {
					id: 'w',
					date: '2026-09-01',
					title: 'Push A',
					status: 'completed',
					source: 'manual',
				},
				sets: [{ id: 's', workoutExerciseId: 'we', order: 1, status: 'completed' }],
			},
		]);
		expect(flattened).toEqual([
			{
				set: { id: 's', workoutExerciseId: 'we', order: 1, status: 'completed' },
				date: '2026-09-01',
				workoutId: 'w',
			},
		]);
	});
});
