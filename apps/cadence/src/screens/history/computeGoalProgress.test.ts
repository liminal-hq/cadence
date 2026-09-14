// Covers the achieved-if-any-single-set-meets-every-target rule and the closest-attempt ranking
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { computeGoalProgress } from './computeGoalProgress';
import type { DatedSet } from './loadExerciseHistory';
import type { ExerciseGoal, SetEntry } from '../../domain/types';

function dated(date: string, overrides: Partial<SetEntry>): DatedSet {
	return {
		date,
		set: { id: 's', workoutExerciseId: 'we', order: 1, status: 'completed', ...overrides },
	};
}

function goal(overrides: Partial<ExerciseGoal>): ExerciseGoal {
	return {
		id: 'g',
		exerciseId: 'ex-bench-press',
		title: 'Bench 100kg',
		archived: false,
		...overrides,
	};
}

describe('computeGoalProgress', () => {
	it('reports not achieved with no completed sets', () => {
		const result = computeGoalProgress(goal({ targetWeightKg: 100 }), []);
		expect(result).toEqual({ achieved: false, overdue: false, best: undefined });
	});

	it('is never achieved for a goal with no target field set', () => {
		const result = computeGoalProgress(goal({}), [dated('2026-09-10', { weightKg: 100, reps: 1 })]);
		expect(result.achieved).toBe(false);
	});

	it('is achieved once a single set meets every specified target', () => {
		const result = computeGoalProgress(goal({ targetWeightKg: 100, targetReps: 1 }), [
			dated('2026-09-01', { weightKg: 90, reps: 3 }),
			dated('2026-09-10', { weightKg: 100, reps: 1 }),
		]);
		expect(result.achieved).toBe(true);
	});

	it('is not achieved when weight is met but reps fall short', () => {
		const result = computeGoalProgress(goal({ targetWeightKg: 100, targetReps: 3 }), [
			dated('2026-09-10', { weightKg: 100, reps: 1 }),
		]);
		expect(result.achieved).toBe(false);
	});

	it('ranks the closest attempt by weight for a weight-reps goal', () => {
		const result = computeGoalProgress(goal({ targetWeightKg: 100 }), [
			dated('2026-09-01', { weightKg: 80, reps: 8 }),
			dated('2026-09-10', { weightKg: 90, reps: 3 }),
		]);
		expect(result.best).toMatchObject({ weightKg: 90, reps: 3, date: '2026-09-10' });
	});

	it('ranks the closest attempt by distance for a distance-duration goal', () => {
		const result = computeGoalProgress(
			goal({ exerciseId: 'ex-running', title: 'Run 10km', targetDistanceKm: 10 }),
			[
				dated('2026-09-01', { distanceKm: 5, durationSec: 1800 }),
				dated('2026-09-10', { distanceKm: 8, durationSec: 2700 }),
			],
		);
		expect(result.best).toMatchObject({ distanceKm: 8, durationSec: 2700 });
	});

	it('excludes sets before the goal start date', () => {
		const result = computeGoalProgress(goal({ targetWeightKg: 100, startDate: '2026-09-05' }), [
			dated('2026-09-01', { weightKg: 100, reps: 1 }),
		]);
		expect(result.achieved).toBe(false);
		expect(result.best).toBeUndefined();
	});

	it('ignores planned (not completed) sets', () => {
		const result = computeGoalProgress(goal({ targetWeightKg: 100 }), [
			dated('2026-09-10', { status: 'planned', weightKg: 120, reps: 1 }),
		]);
		expect(result.achieved).toBe(false);
		expect(result.best).toBeUndefined();
	});

	it('does not count a performance after the target date as achieving the goal', () => {
		const result = computeGoalProgress(
			goal({ targetWeightKg: 100, targetDate: '2026-09-05' }),
			[dated('2026-09-10', { weightKg: 100, reps: 1 })],
			'2026-09-15',
		);
		expect(result.achieved).toBe(false);
	});

	it('still ranks a late performance as the best attempt', () => {
		const result = computeGoalProgress(
			goal({ targetWeightKg: 100, targetDate: '2026-09-05' }),
			[dated('2026-09-10', { weightKg: 100, reps: 1 })],
			'2026-09-15',
		);
		expect(result.best).toMatchObject({ weightKg: 100, reps: 1, date: '2026-09-10' });
	});

	it('is overdue once the target date has passed unachieved', () => {
		const result = computeGoalProgress(
			goal({ targetWeightKg: 100, targetDate: '2026-09-05' }),
			[dated('2026-09-01', { weightKg: 80, reps: 1 })],
			'2026-09-15',
		);
		expect(result.overdue).toBe(true);
	});

	it('is not overdue once achieved by the target date', () => {
		const result = computeGoalProgress(
			goal({ targetWeightKg: 100, targetDate: '2026-09-05' }),
			[dated('2026-09-03', { weightKg: 100, reps: 1 })],
			'2026-09-15',
		);
		expect(result.achieved).toBe(true);
		expect(result.overdue).toBe(false);
	});

	it('is not overdue before the target date arrives', () => {
		const result = computeGoalProgress(
			goal({ targetWeightKg: 100, targetDate: '2026-09-20' }),
			[],
			'2026-09-15',
		);
		expect(result.overdue).toBe(false);
	});
});
