// Covers actual/estimated record selection, tie detection and its per-date deduping, and the
// rep-records-by-weight grid
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { computeRecords } from './computeRecords';
import type { DatedSet } from './loadExerciseHistory';
import type { SetEntry } from '../../domain/types';

function dated(date: string, overrides: Partial<SetEntry>): DatedSet {
	return {
		date,
		set: { id: 's', workoutExerciseId: 'we', order: 1, status: 'completed', ...overrides },
	};
}

describe('computeRecords', () => {
	it('returns empty results with no completed sets', () => {
		expect(
			computeRecords([dated('2026-09-01', { status: 'planned', weightKg: 80, reps: 8 })]),
		).toEqual({
			actual: [],
			estimatedOneRm: [],
			repRecordsByWeight: [],
		});
	});

	it('finds the single heaviest completed set as the actual record', () => {
		const result = computeRecords([
			dated('2026-09-01', { id: 'a', weightKg: 80, reps: 8 }),
			dated('2026-09-01', { id: 'b', weightKg: 82.5, reps: 6 }),
			dated('2026-09-01', { id: 'c', weightKg: 75, reps: 10 }),
		]);
		expect(result.actual).toEqual([{ weightKg: 82.5, reps: 6, date: '2026-09-01', setId: 'b' }]);
	});

	it('reports a tie when two different dates share the exact heaviest weight', () => {
		const result = computeRecords([
			dated('2026-08-01', { id: 'a', weightKg: 82.5, reps: 6 }),
			dated('2026-09-01', { id: 'b', weightKg: 82.5, reps: 8 }),
		]);
		expect(result.actual.map((e) => e.setId).sort()).toEqual(['a', 'b']);
	});

	it('collapses multiple same-day sets at the max weight into one entry, not one tie each', () => {
		const result = computeRecords([
			dated('2026-09-09', { id: 'a', weightKg: 80, reps: 8 }),
			dated('2026-09-09', { id: 'b', weightKg: 80, reps: 9 }),
			dated('2026-09-04', { id: 'c', weightKg: 80, reps: 8 }),
		]);
		// Two distinct dates hit 80kg, so it's a two-way tie — not three entries for three sets.
		expect(result.actual).toHaveLength(2);
		// The higher-rep set wins as the representative for its date.
		expect(result.actual.find((e) => e.date === '2026-09-09')?.setId).toBe('b');
	});

	it('groups by the workout date, not by slicing a completedAt instant', () => {
		const result = computeRecords([
			dated('2026-09-09', { weightKg: 80, reps: 8, completedAt: '2026-09-10T06:00:00Z' }),
		]);
		expect(result.actual[0].date).toBe('2026-09-09');
	});

	it('picks the highest estimated 1RM even from a lighter, higher-rep set', () => {
		// 80kg x 8 -> ~101.3kg estimated; 82.5kg x 1 -> 82.5kg estimated.
		const result = computeRecords([
			dated('2026-09-01', { id: 'heavy-single', weightKg: 82.5, reps: 1 }),
			dated('2026-09-01', { id: 'volume-set', weightKg: 80, reps: 8 }),
		]);
		expect(result.estimatedOneRm).toHaveLength(1);
		expect(result.estimatedOneRm[0].setId).toBe('volume-set');
	});

	it('builds one rep-record entry per distinct weight, heaviest first', () => {
		const result = computeRecords([
			dated('2026-09-01', { id: 'a', weightKg: 80, reps: 8 }),
			dated('2026-09-01', { id: 'b', weightKg: 80, reps: 6 }),
			dated('2026-09-01', { id: 'c', weightKg: 75, reps: 10 }),
		]);
		expect(result.repRecordsByWeight).toEqual([
			{ weightKg: 80, reps: 8, date: '2026-09-01', setId: 'a' },
			{ weightKg: 75, reps: 10, date: '2026-09-01', setId: 'c' },
		]);
	});
});
