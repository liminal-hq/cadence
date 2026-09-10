// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { computeStats } from './computeStats';
import type { SetEntry } from '../../domain/types';

function set(overrides: Partial<SetEntry>): SetEntry {
	return {
		id: 's',
		workoutExerciseId: 'we',
		order: 1,
		status: 'completed',
		completedAt: '2026-09-01T09:00:00',
		...overrides,
	};
}

describe('computeStats', () => {
	it('aggregates volume, sets, reps, and max weight from completed sets', () => {
		const stats = computeStats([
			set({ weightKg: 80, reps: 8 }),
			set({ weightKg: 82.5, reps: 6 }),
			set({ status: 'planned', weightKg: 100, reps: 1 }),
		]);
		expect(stats.setCount).toBe(2);
		expect(stats.repCount).toBe(14);
		expect(stats.volumeKg).toBe(80 * 8 + 82.5 * 6);
		expect(stats.maxWeightKg).toBe(82.5);
		expect(stats.bestEstimatedOneRm).toBeGreaterThan(82.5);
	});

	it('excludes sets outside the given date range', () => {
		const stats = computeStats(
			[
				set({ weightKg: 80, reps: 8, completedAt: '2026-08-01T09:00:00' }),
				set({ weightKg: 82.5, reps: 8, completedAt: '2026-09-05T09:00:00' }),
			],
			{ startDate: '2026-09-01', endDate: '2026-09-30' },
		);
		expect(stats.setCount).toBe(1);
		expect(stats.maxWeightKg).toBe(82.5);
	});

	it('leaves weight/distance fields undefined with no matching sets', () => {
		const stats = computeStats([]);
		expect(stats).toEqual({
			setCount: 0,
			repCount: 0,
			volumeKg: 0,
			maxWeightKg: undefined,
			bestEstimatedOneRm: undefined,
			totalDistanceKm: undefined,
		});
	});

	it('tracks total distance separately from weight-reps volume', () => {
		const stats = computeStats([set({ weightKg: undefined, reps: undefined, distanceKm: 5 })]);
		expect(stats.totalDistanceKm).toBe(5);
		expect(stats.volumeKg).toBe(0);
	});
});
