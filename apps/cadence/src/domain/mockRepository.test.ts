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
