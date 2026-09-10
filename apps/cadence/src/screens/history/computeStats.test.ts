// Covers the core aggregates, date-range filtering, and the weight-reps/distance split
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { computeStats } from './computeStats';
import type { DatedSet } from './loadExerciseHistory';
import type { SetEntry } from '../../domain/types';

function dated(date: string, overrides: Partial<SetEntry>): DatedSet {
	return {
		date,
		set: { id: 's', workoutExerciseId: 'we', order: 1, status: 'completed', ...overrides },
	};
}

describe('computeStats', () => {
	it('aggregates volume, sets, reps, and max weight from completed sets', () => {
		const stats = computeStats([
			dated('2026-09-01', { weightKg: 80, reps: 8 }),
			dated('2026-09-01', { weightKg: 82.5, reps: 6 }),
			dated('2026-09-01', { status: 'planned', weightKg: 100, reps: 1 }),
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
				dated('2026-08-01', { weightKg: 80, reps: 8 }),
				dated('2026-09-05', { weightKg: 82.5, reps: 8 }),
			],
			{ startDate: '2026-09-01', endDate: '2026-09-30' },
		);
		expect(stats.setCount).toBe(1);
		expect(stats.maxWeightKg).toBe(82.5);
	});

	it('groups by the workout date, not by slicing a completedAt instant', () => {
		const stats = computeStats(
			[dated('2026-08-31', { weightKg: 80, reps: 8, completedAt: '2026-09-01T06:00:00Z' })],
			{ startDate: '2026-09-01', endDate: '2026-09-30' },
		);
		// The workout date (Aug 31) is outside the range even though the UTC instant rolled into it.
		expect(stats.setCount).toBe(0);
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
		const stats = computeStats([
			dated('2026-09-01', { weightKg: undefined, reps: undefined, distanceKm: 5 }),
		]);
		expect(stats.totalDistanceKm).toBe(5);
		expect(stats.volumeKg).toBe(0);
	});
});
