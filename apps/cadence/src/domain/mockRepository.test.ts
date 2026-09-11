// Covers set mutation, the rest timer state machine, and plate calculation branching.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockLoggingRepository, calculatePlatesPure } from './mockRepository';
import { BARBELL_CONFIGS } from './seedData';
import type { RestTimerState } from './types';

describe('MockLoggingRepository', () => {
	let repo: MockLoggingRepository;

	beforeEach(() => {
		repo = new MockLoggingRepository();
	});

	it('marks a set completed with a completion instant', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));

		const completed = await repo.completeSet('set-bp-3');

		expect(completed.status).toBe('completed');
		expect(completed.completedAt).toBe('2026-09-09T12:00:00.000Z');

		vi.useRealTimers();
	});

	it('appends a new set with the next order, seeded from the last set', async () => {
		const created = await repo.addSet('we-bench-press');

		expect(created.order).toBe(5);
		expect(created.status).toBe('planned');
		expect(created.weightKg).toBe(80);
		expect(created.reps).toBe(8);
	});

	it('logs a new set as already completed with the given values', async () => {
		const created = await repo.logNewSet('we-bench-press', { weightKg: 82.5, reps: 6 });

		expect(created.order).toBe(5);
		expect(created.status).toBe('completed');
		expect(created.completedAt).toBeDefined();
		expect(created.weightKg).toBe(82.5);
		expect(created.reps).toBe(6);
	});

	it('duplicates a set into a new planned set, clearing completion/record state', async () => {
		const duplicated = await repo.duplicateSet('set-bp-2');

		expect(duplicated.id).not.toBe('set-bp-2');
		expect(duplicated.status).toBe('planned');
		expect(duplicated.weightKg).toBe(80);
		expect(duplicated.reps).toBe(9);
		expect(duplicated.completedAt).toBeUndefined();
		expect(duplicated.isRecord).toBe(false);
	});

	it('deletes a set so it no longer appears when the workout exercise is reloaded', async () => {
		await repo.deleteSet('set-bp-2');

		const sets = await repo.listSets('we-bench-press');
		expect(sets.find((s) => s.id === 'set-bp-2')).toBeUndefined();
	});

	describe('rest timer', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it('transitions through running, paused, resumed, and elapsed, notifying subscribers', async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));

			const seen: RestTimerState[] = [];
			const unsubscribe = repo.subscribeRestTimer((state) => seen.push(state));

			await repo.startRestTimer(120_000, { nextSetLabel: 'Bench Press set 4 · 80 × 8' });
			expect(seen[seen.length - 1]?.status).toBe('running');
			expect(seen[seen.length - 1]?.targetInstant).toBe('2026-09-09T12:02:00.000Z');

			vi.advanceTimersByTime(60_000);
			await repo.pauseRestTimer();
			expect(seen[seen.length - 1]?.status).toBe('paused');
			expect(seen[seen.length - 1]?.remainingMsAtPause).toBe(60_000);

			vi.advanceTimersByTime(30_000);
			await repo.resumeRestTimer();
			expect(seen[seen.length - 1]?.status).toBe('running');
			// now = 12:01:30, remaining was 60s at pause -> new target 12:02:30.
			expect(seen[seen.length - 1]?.targetInstant).toBe('2026-09-09T12:02:30.000Z');

			await repo.extendRestTimer(30_000);
			expect(seen[seen.length - 1]?.targetInstant).toBe('2026-09-09T12:03:00.000Z');
			expect(seen[seen.length - 1]?.totalMs).toBe(150_000); // grows with the target, so the progress bar stays honest

			// now = 12:01:30, target = 12:03:00 -> 90s left.
			vi.advanceTimersByTime(90_000);
			expect(seen[seen.length - 1]?.status).toBe('elapsed');

			const countBeforeUnsubscribe = seen.length;
			unsubscribe();
			await repo.extendRestTimer(1);
			expect(seen).toHaveLength(countBeforeUnsubscribe);
		});

		it('resets to inactive on dismiss', async () => {
			await repo.startRestTimer(60_000);
			const dismissed = await repo.dismissRestTimer();
			expect(dismissed.status).toBe('inactive');
		});
	});

	describe('settings', () => {
		it('round-trips a partial update against the seeded defaults', async () => {
			const initial = await repo.getSettings();
			expect(initial.soundEnabled).toBe(true);

			const updated = await repo.updateSettings({ soundEnabled: false, vibrateEnabled: false });

			expect(updated.soundEnabled).toBe(false);
			expect(updated.vibrateEnabled).toBe(false);
			// Untouched fields survive a partial update.
			expect(updated.weightUnit).toBe(initial.weightUnit);
			expect(await repo.getSettings()).toEqual(updated);
		});
	});

	describe('barbell configs', () => {
		it('adds a config and clears the default off every other one', async () => {
			const created = await repo.addBarbellConfig({
				name: 'Trap bar',
				barWeight: 25,
				displayUnit: 'kg',
				availablePlates: [20, 10, 5],
				isDefault: true,
			});

			const all = await repo.listBarbellConfigs();
			expect(all.find((b) => b.id === created.id)?.isDefault).toBe(true);
			expect(all.find((b) => b.id === 'barbell-olympic')?.isDefault).toBe(false);
		});

		it('updates and deletes an existing config', async () => {
			const updated = await repo.updateBarbellConfig({
				id: 'barbell-standard',
				name: 'Standard (renamed)',
				barWeight: 45,
				displayUnit: 'lb',
				availablePlates: [45, 35, 25, 10, 5, 2.5],
			});
			expect(updated.name).toBe('Standard (renamed)');

			await repo.deleteBarbellConfig('barbell-standard');
			const all = await repo.listBarbellConfigs();
			expect(all.find((b) => b.id === 'barbell-standard')).toBeUndefined();
		});

		it('rejects updating a config that was never added', async () => {
			await expect(
				repo.updateBarbellConfig({
					id: 'no-such-barbell',
					name: 'Ghost',
					barWeight: 20,
					displayUnit: 'kg',
					availablePlates: [],
				}),
			).rejects.toThrow('Unknown barbell config: no-such-barbell');
		});
	});

	describe('history management', () => {
		it('summarizes the seeded completed workouts and sets', async () => {
			const summary = await repo.getHistorySummary();
			expect(summary.workoutCount).toBe(12);
			// Sets belonging to today's still-in-progress workouts aren't history yet, so they're
			// excluded from this count too — it must match exactly what deleteAllHistory removes.
			expect(summary.setCount).toBe(49);
		});

		it('clears sets and completed workouts, keeping in-progress workouts, workout exercises, exercises, and settings intact', async () => {
			await repo.deleteAllHistory();

			const summary = await repo.getHistorySummary();
			expect(summary).toEqual({ workoutCount: 0, setCount: 0 });
			// The routine scaffold survives, sets included — Today and Logging still resolve
			// these by id, and today's already-logged sets aren't history yet either.
			await expect(repo.getWorkoutExercise('we-bench-press')).resolves.toBeDefined();
			await expect(repo.listSets('we-bench-press')).resolves.not.toEqual([]);
			await expect(repo.getExercise('ex-bench-press')).resolves.toBeDefined();
			// Today's in-progress workouts aren't history yet, so they survive.
			await expect(repo.getWorkout('workout-push-a')).resolves.toBeDefined();
			// A completed workout is gone, and so is the workoutExercise occurrence that
			// belonged to it — otherwise loadExerciseHistory would try to resolve a deleted
			// workout and reject.
			await expect(repo.getWorkout('workout-2026-09-04')).rejects.toThrow();
			await expect(repo.getWorkoutExercise('we-2026-09-04-bench')).rejects.toThrow();
			expect(await repo.getSettings()).toEqual(await new MockLoggingRepository().getSettings());
		});
	});

	describe('exercises', () => {
		it('toggles an exercise favourite flag', async () => {
			const updated = await repo.updateExerciseFavourite('ex-bench-press', true);
			expect(updated.favourite).toBe(true);
			expect((await repo.getExercise('ex-bench-press')).favourite).toBe(true);

			const reverted = await repo.updateExerciseFavourite('ex-bench-press', false);
			expect(reverted.favourite).toBe(false);
		});

		it('lists every exercise in the library, name-ordered', async () => {
			const exercises = await repo.listExercises();
			expect(exercises.length).toBeGreaterThan(0);
			const names = exercises.map((e) => e.name);
			expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
		});
	});

	describe('workouts', () => {
		it('lists every occurrence of an exercise across all workouts', async () => {
			const occurrences = await repo.listWorkoutExercisesByExercise('ex-bench-press');
			expect(occurrences).toHaveLength(9);
			expect(occurrences.every((we) => we.exerciseId === 'ex-bench-press')).toBe(true);
		});

		it('lists workouts within an inclusive date range, ordered by date', async () => {
			const workouts = await repo.listWorkoutsInRange('2026-08-01', '2026-08-31');
			expect(workouts.map((w) => w.id)).toEqual([
				'workout-2026-08-07',
				'workout-2026-08-14',
				'workout-2026-08-19',
				'workout-2026-08-27-hc',
				'workout-2026-08-27-strength',
				'workout-2026-08-29',
			]);
		});

		it('rejects a lookup for an unknown workout', async () => {
			await expect(repo.getWorkout('no-such-workout')).rejects.toThrow(
				'Unknown workout: no-such-workout',
			);
		});

		it('duplicates a workout into a new planned workout on the target date', async () => {
			const duplicated = await repo.duplicateWorkout('workout-2026-09-04', '2026-09-20');

			expect(duplicated.id).not.toBe('workout-2026-09-04');
			expect(duplicated.date).toBe('2026-09-20');
			expect(duplicated.title).toBe('Push A');
			expect(duplicated.status).toBe('in-progress');

			const workoutExercises = await repo.listWorkoutExercisesByWorkout(duplicated.id);
			expect(workoutExercises).toHaveLength(2);
			for (const we of workoutExercises) {
				const sets = await repo.listSets(we.id);
				expect(sets.length).toBeGreaterThan(0);
				for (const set of sets) {
					expect(set.status).toBe('planned');
					expect(set.completedAt).toBeUndefined();
					expect(set.isRecord).toBe(false);
				}
			}

			// The source workout is untouched.
			const sourceExercise = await repo.getWorkoutExercise('we-2026-09-04-bench');
			expect((await repo.listSets(sourceExercise.id))[0].status).toBe('completed');
		});

		it('updates a workout note', async () => {
			const updated = await repo.updateWorkoutNote('workout-2026-09-04', 'Felt strong today');
			expect(updated.note).toBe('Felt strong today');
			expect(await repo.getWorkout('workout-2026-09-04')).toEqual(updated);
		});

		it('creates a fresh in-progress workout with no exercises', async () => {
			const created = await repo.createWorkout('2026-09-10', 'Push day');
			expect(created.date).toBe('2026-09-10');
			expect(created.title).toBe('Push day');
			expect(created.status).toBe('in-progress');
			expect(await repo.listWorkoutExercisesByWorkout(created.id)).toEqual([]);
		});

		it('adds an exercise to a workout, appending at the end of its order', async () => {
			const workout = await repo.createWorkout('2026-09-10', 'Push day');
			const first = await repo.addWorkoutExercise(workout.id, 'ex-bench-press');
			expect(first.order).toBe(1);
			expect(first.workoutId).toBe(workout.id);
			const second = await repo.addWorkoutExercise(workout.id, 'ex-goblet-squat');
			expect(second.order).toBe(2);
		});

		it('removes a workout exercise', async () => {
			const workout = await repo.createWorkout('2026-09-10', 'Push day');
			const added = await repo.addWorkoutExercise(workout.id, 'ex-bench-press');
			await repo.deleteWorkoutExercise(added.id);
			expect(await repo.listWorkoutExercisesByWorkout(workout.id)).toEqual([]);
		});

		it('is a no-op removing an unknown workout exercise', async () => {
			await expect(repo.deleteWorkoutExercise('no-such-we')).resolves.toBeUndefined();
		});
	});

	describe('calculatePlates', () => {
		it('finds an exact loadable combination', async () => {
			const olympic = BARBELL_CONFIGS.find((b) => b.id === 'barbell-olympic')!;
			const result = await repo.calculatePlates(82.5, olympic);

			expect(result.loadable).toBe(true);
			expect(result.perSidePlates).toEqual([25, 5, 1.25]);
			expect(result.perSideTotal).toBe(31.25);
			expect(result.achievedTotal).toBe(82.5);
			// Neighbours are still populated even when loadable, so the sheet's
			// stepper can browse to an adjacent total, not just resolve a miss.
			expect(result.nearestLower).toBeLessThan(82.5);
			expect(result.nearestHigher).toBeGreaterThan(82.5);
		});

		it('falls back to the nearest loadable totals when the target is unreachable', async () => {
			const standard = BARBELL_CONFIGS.find((b) => b.id === 'barbell-standard')!;
			const result = await repo.calculatePlates(137.5, standard);

			expect(result.loadable).toBe(false);
			expect(result.nearestLower).toBe(135);
			expect(result.nearestHigher).toBe(140);
			expect(result.smallestPlate).toBe(2.5);
			expect(result.shortfall).toBeCloseTo(1.25);
		});
	});
});

describe('calculatePlatesPure', () => {
	it('is a pure function of its inputs', () => {
		const olympic = BARBELL_CONFIGS.find((b) => b.id === 'barbell-olympic')!;
		expect(calculatePlatesPure(82.5, olympic)).toEqual(calculatePlatesPure(82.5, olympic));
	});
});
