// Regression coverage for two Codex-review findings on the P-20 materialization review screen:
// blocking materialization while a workout is already active, and previewing a seeded target via
// a direct lookup instead of fetching an exercise's entire history.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { loadReviewState, resolveSeedPreview } from './RoutineSectionStartScreen';
import { MockLoggingRepository } from '../../domain/mockRepository';

describe('resolveSeedPreview', () => {
	// A synthetic exercise id, deliberately not one of the seeded fixture exercises with
	// pre-existing history -- these two tests want full control over what history exists.
	const EXERCISE_ID = 'ex-seed-preview-test-only';

	it('resolves via the direct most-recent-completed-set lookup, not a full history fetch', async () => {
		const repo = new MockLoggingRepository();
		const workout = await repo.createWorkout('2026-09-01', 'Session');
		const we = await repo.addWorkoutExercise(workout.id, EXERCISE_ID);
		await repo.logNewSet(we.id, { weightKg: 82.5, reps: 6 });

		const preview = await resolveSeedPreview(repo, EXERCISE_ID, '2026-09-20');
		expect(preview).toEqual({
			weightKg: 82.5,
			reps: 6,
			distanceKm: undefined,
			durationSec: undefined,
		});
	});

	it("returns null, not an empty object, when there's no completed history yet", async () => {
		const repo = new MockLoggingRepository();
		const preview = await resolveSeedPreview(repo, EXERCISE_ID, '2026-09-20');
		expect(preview).toBeNull();
	});
});

describe('loadReviewState', () => {
	// The mock's default seed data includes several already-open workouts — abandon all of them
	// first so these tests start from a genuinely clean "nothing open" state, matching what
	// they're testing. `getOpenWorkout` only ever surfaces one at a time, so loop until it's clear.
	async function withNoOpenWorkout(repo: MockLoggingRepository) {
		let seeded = await repo.getOpenWorkout();
		while (seeded) {
			await repo.abandonWorkout(seeded.id);
			seeded = await repo.getOpenWorkout();
		}
	}

	it("sets activeWorkoutId to null when there's no open workout at all", async () => {
		const repo = new MockLoggingRepository();
		await withNoOpenWorkout(repo);
		const routine = await repo.createRoutine('Push day');
		const section = await repo.addRoutineSection(routine.id, 'A');
		await repo.addRoutineExercise(section.id, 'ex-bench-press');

		const state = await loadReviewState(repo, section.id, '2026-09-20');
		expect(state.activeWorkoutId).toBeNull();
	});

	it('resolves an open workout as activeWorkoutId even when dated well before the target date', async () => {
		// SPEC.md 8.1's single-active-workout model is global, not scoped to a date — this is
		// exactly the shape reopening an older completed/abandoned workout produces.
		const repo = new MockLoggingRepository();
		await withNoOpenWorkout(repo);
		const routine = await repo.createRoutine('Push day');
		const section = await repo.addRoutineSection(routine.id, 'A');
		await repo.addRoutineExercise(section.id, 'ex-bench-press');
		const active = await repo.createWorkout('2020-01-01', 'Old workout');

		const state = await loadReviewState(repo, section.id, '2026-09-20');
		expect(state.activeWorkoutId).toBe(active.id);
	});
});
