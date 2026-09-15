// Covers per-metric applicability, the sum/max/average aggregation rules, and grouping by category vs exercise
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import {
	computeBreakdown,
	countTrainingDays,
	displayMetricUnit,
	displayMetricValue,
	formatEntrySummary,
} from './computeTrainingAnalysis';
import type { AnalysisSetEntry } from '../../domain/types';

function entry(overrides: Partial<AnalysisSetEntry>): AnalysisSetEntry {
	return {
		setId: 's',
		workoutId: 'w',
		exerciseId: 'ex-bench-press',
		exerciseName: 'Bench Press',
		categoryId: 'chest',
		categoryName: 'Chest',
		metricProfile: 'weight-reps',
		date: '2026-09-01',
		...overrides,
	};
}

describe('computeBreakdown', () => {
	it('sums volume within a group', () => {
		const rows = computeBreakdown(
			[
				entry({ setId: 's1', weightKg: 80, reps: 8 }),
				entry({ setId: 's2', weightKg: 80, reps: 9 }),
			],
			'volume',
			'exercise',
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].value).toBe(80 * 8 + 80 * 9);
		expect(rows[0].entries).toHaveLength(2);
	});

	it('takes the max, not the sum, for max weight', () => {
		const rows = computeBreakdown(
			[entry({ setId: 's1', weightKg: 80 }), entry({ setId: 's2', weightKg: 90 })],
			'maxWeight',
			'exercise',
		);
		expect(rows[0].value).toBe(90);
	});

	it('excludes a zero-rep set from estimated 1RM, rather than reading it as the bare weight', () => {
		const rows = computeBreakdown(
			[
				entry({ setId: 's1', weightKg: 120, reps: 0 }),
				entry({ setId: 's2', weightKg: 80, reps: 8 }),
			],
			'estimated1RM',
			'exercise',
		);
		expect(rows[0].value).toBeCloseTo(80 * (1 + 8 / 30));
	});

	it('counts one set each toward the sets total', () => {
		const rows = computeBreakdown(
			[entry({ setId: 's1' }), entry({ setId: 's2' }), entry({ setId: 's3' })],
			'sets',
			'exercise',
		);
		expect(rows[0].value).toBe(3);
	});

	it('skips a set whose inapplicable fields arrive as null, not undefined (the real backend serializes an absent field as JSON null)', () => {
		// Deliberately bypasses the `number | undefined` type — the real backend's JSON actually sends null for an absent field, which is what this covers.
		const withNulls = entry({ setId: 's1', weightKg: 80, reps: 8 });
		(withNulls as unknown as { distanceKm: null; durationSec: null }).distanceKm = null;
		(withNulls as unknown as { distanceKm: null; durationSec: null }).durationSec = null;
		const rows = computeBreakdown([withNulls], 'maxDistance', 'exercise');
		expect(rows).toEqual([]);
	});

	it('skips a set the metric does not apply to', () => {
		const rows = computeBreakdown(
			[
				entry({ setId: 's1', weightKg: 80, reps: 8 }),
				entry({
					setId: 's2',
					exerciseId: 'ex-running',
					exerciseName: 'Running',
					categoryId: 'cardio',
					categoryName: 'Cardio',
					metricProfile: 'distance-duration',
					distanceKm: 5,
					durationSec: 1500,
				}),
			],
			'volume',
			'exercise',
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].label).toBe('Bench Press');
	});

	it('averages pace and speed rather than summing them', () => {
		const rows = computeBreakdown(
			[
				entry({
					setId: 's1',
					exerciseId: 'ex-running',
					exerciseName: 'Running',
					distanceKm: 5,
					durationSec: 1500,
				}),
				entry({
					setId: 's2',
					exerciseId: 'ex-running',
					exerciseName: 'Running',
					distanceKm: 10,
					durationSec: 3600,
				}),
			],
			'pace',
			'exercise',
		);
		expect(rows[0].value).toBeCloseTo((1500 / 5 + 3600 / 10) / 2);
	});

	it('groups by category when asked', () => {
		const rows = computeBreakdown(
			[
				entry({ setId: 's1', weightKg: 80, reps: 8, exerciseId: 'ex-bench-press' }),
				entry({
					setId: 's2',
					weightKg: 40,
					reps: 10,
					exerciseId: 'ex-incline-press',
					exerciseName: 'Incline Press',
				}),
			],
			'volume',
			'category',
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].key).toBe('chest');
		expect(rows[0].entries).toHaveLength(2);
	});

	it('counts distinct training days within each group for the frequency metric', () => {
		const rows = computeBreakdown(
			[
				entry({ setId: 's1', date: '2026-09-01' }),
				entry({ setId: 's2', date: '2026-09-01' }),
				entry({ setId: 's3', date: '2026-09-03' }),
				entry({
					setId: 's4',
					date: '2026-09-01',
					exerciseId: 'ex-running',
					exerciseName: 'Running',
					categoryId: 'cardio',
					categoryName: 'Cardio',
				}),
			],
			'frequency',
			'exercise',
		);
		expect(rows.find((r) => r.label === 'Bench Press')?.value).toBe(2);
		expect(rows.find((r) => r.label === 'Running')?.value).toBe(1);
	});

	it('sorts rows by value, descending', () => {
		const rows = computeBreakdown(
			[
				entry({ setId: 's1', exerciseId: 'a', exerciseName: 'A', weightKg: 10, reps: 1 }),
				entry({ setId: 's2', exerciseId: 'b', exerciseName: 'B', weightKg: 100, reps: 1 }),
			],
			'volume',
			'exercise',
		);
		expect(rows.map((r) => r.label)).toEqual(['B', 'A']);
	});
});

describe('countTrainingDays', () => {
	it('counts distinct dates', () => {
		const count = countTrainingDays([
			entry({ setId: 's1', date: '2026-09-01' }),
			entry({ setId: 's2', date: '2026-09-01' }),
			entry({ setId: 's3', date: '2026-09-03' }),
		]);
		expect(count).toBe(2);
	});
});

describe('displayMetricUnit and displayMetricValue', () => {
	it('leaves a weight-based metric in kg when the user has configured kg', () => {
		expect(displayMetricUnit('volume', 'kg')).toBe('kg');
		expect(displayMetricValue(100, 'volume', 'kg')).toBe(100);
	});

	it('converts a weight-based metric to lb when the user has configured lb', () => {
		expect(displayMetricUnit('maxWeight', 'lb')).toBe('lb');
		expect(displayMetricValue(100, 'maxWeight', 'lb')).toBeCloseTo(220.462, 2);
	});

	it('leaves a non-weight metric unaffected by the weight unit', () => {
		expect(displayMetricUnit('maxDistance', 'lb')).toBe('km');
		expect(displayMetricValue(5, 'maxDistance', 'lb')).toBe(5);
	});
});

describe('formatEntrySummary', () => {
	it('formats a weight-reps entry', () => {
		expect(formatEntrySummary(entry({ weightKg: 80, reps: 8 }))).toBe('80 kg × 8');
	});

	it('formats a distance-duration entry', () => {
		expect(
			formatEntrySummary(
				entry({ metricProfile: 'distance-duration', distanceKm: 5, durationSec: 1500 }),
			),
		).toBe('5 km · 1500s');
	});

	it('distinguishes two sets on the same date and exercise', () => {
		const first = formatEntrySummary(entry({ weightKg: 80, reps: 8 }));
		const second = formatEntrySummary(entry({ weightKg: 82.5, reps: 6 }));
		expect(first).not.toBe(second);
	});
});
