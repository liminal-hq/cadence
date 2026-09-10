// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { computeGraphPoints } from './computeGraphPoints';
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

describe('computeGraphPoints', () => {
	it('collapses same-day sets to the single best value', () => {
		const points = computeGraphPoints(
			[set({ id: 'a', weightKg: 80, reps: 8 }), set({ id: 'b', weightKg: 82.5, reps: 8 })],
			'weight',
		);
		expect(points).toHaveLength(1);
		expect(points[0]).toMatchObject({ date: '2026-09-01', value: 82.5, setId: 'b' });
	});

	it('omits days with no completed data rather than inserting a zero', () => {
		const points = computeGraphPoints(
			[
				set({ weightKg: 80, reps: 8, completedAt: '2026-09-01T09:00:00' }),
				set({ status: 'planned', weightKg: 82.5, reps: 8, completedAt: '2026-09-05T09:00:00' }),
				set({ weightKg: 85, reps: 8, completedAt: '2026-09-10T09:00:00' }),
			],
			'weight',
		);
		expect(points.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-10']);
	});

	it('sorts points chronologically regardless of input order', () => {
		const points = computeGraphPoints(
			[
				set({ weightKg: 85, reps: 8, completedAt: '2026-09-10T09:00:00' }),
				set({ weightKg: 80, reps: 8, completedAt: '2026-09-01T09:00:00' }),
			],
			'weight',
		);
		expect(points.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-10']);
	});

	it('computes the estimated-1rm metric per set', () => {
		const points = computeGraphPoints([set({ weightKg: 80, reps: 8 })], 'estimated-1rm');
		expect(points[0].value).toBeCloseTo(80 * (1 + 8 / 30));
	});

	it('computes pace as seconds per kilometre for distance sets', () => {
		const points = computeGraphPoints(
			[set({ weightKg: undefined, reps: undefined, distanceKm: 5, durationSec: 1500 })],
			'pace',
		);
		expect(points[0].value).toBe(300);
	});

	it('returns nothing for a metric the sets have no data for', () => {
		expect(computeGraphPoints([set({ weightKg: 80, reps: 8 })], 'distance')).toEqual([]);
	});
});
