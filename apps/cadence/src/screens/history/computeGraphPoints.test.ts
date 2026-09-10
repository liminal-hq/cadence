// Covers same-day collapsing, gap omission, sort order, and each metric's own value formula
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { computeGraphPoints } from './computeGraphPoints';
import type { DatedSet } from './loadExerciseHistory';
import type { SetEntry } from '../../domain/types';

function dated(date: string, overrides: Partial<SetEntry>): DatedSet {
	return {
		date,
		set: { id: 's', workoutExerciseId: 'we', order: 1, status: 'completed', ...overrides },
	};
}

describe('computeGraphPoints', () => {
	it('collapses same-day sets to the single best value', () => {
		const points = computeGraphPoints(
			[
				dated('2026-09-01', { id: 'a', weightKg: 80, reps: 8 }),
				dated('2026-09-01', { id: 'b', weightKg: 82.5, reps: 8 }),
			],
			'weight',
		);
		expect(points).toHaveLength(1);
		expect(points[0]).toMatchObject({ date: '2026-09-01', value: 82.5, setId: 'b' });
	});

	it('omits days with no completed data rather than inserting a zero', () => {
		const points = computeGraphPoints(
			[
				dated('2026-09-01', { weightKg: 80, reps: 8 }),
				dated('2026-09-05', { status: 'planned', weightKg: 82.5, reps: 8 }),
				dated('2026-09-10', { weightKg: 85, reps: 8 }),
			],
			'weight',
		);
		expect(points.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-10']);
	});

	it('sorts points chronologically regardless of input order', () => {
		const points = computeGraphPoints(
			[
				dated('2026-09-10', { weightKg: 85, reps: 8 }),
				dated('2026-09-01', { weightKg: 80, reps: 8 }),
			],
			'weight',
		);
		expect(points.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-10']);
	});

	it('groups by the workout date, not by slicing a completedAt instant', () => {
		// A UTC instant that rolls to the next calendar day still belongs to its workout's date.
		const points = computeGraphPoints(
			[dated('2026-09-09', { weightKg: 80, reps: 8, completedAt: '2026-09-10T06:00:00Z' })],
			'weight',
		);
		expect(points[0].date).toBe('2026-09-09');
	});

	it('computes the estimated-1rm metric per set', () => {
		const points = computeGraphPoints(
			[dated('2026-09-01', { weightKg: 80, reps: 8 })],
			'estimated-1rm',
		);
		expect(points[0].value).toBeCloseTo(80 * (1 + 8 / 30));
	});

	it('computes pace as seconds per kilometre for distance sets', () => {
		const points = computeGraphPoints(
			[dated('2026-09-01', { distanceKm: 5, durationSec: 1500 })],
			'pace',
		);
		expect(points[0].value).toBe(300);
	});

	it('picks the fastest (lowest) pace among same-day sets, not the largest value', () => {
		const points = computeGraphPoints(
			[
				dated('2026-09-01', { id: 'slow', distanceKm: 5, durationSec: 1800 }),
				dated('2026-09-01', { id: 'fast', distanceKm: 5, durationSec: 1500 }),
			],
			'pace',
		);
		expect(points).toHaveLength(1);
		expect(points[0]).toMatchObject({ setId: 'fast', value: 300 });
	});

	it('returns nothing for a metric the sets have no data for', () => {
		expect(
			computeGraphPoints([dated('2026-09-01', { weightKg: 80, reps: 8 })], 'distance'),
		).toEqual([]);
	});
});
