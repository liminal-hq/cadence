// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { computeRecords } from './computeRecords';
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

describe('computeRecords', () => {
	it('returns empty results with no completed sets', () => {
		expect(computeRecords([set({ status: 'planned', weightKg: 80, reps: 8 })])).toEqual({
			actual: [],
			estimatedOneRm: [],
			repRecordsByWeight: [],
		});
	});

	it('finds the single heaviest completed set as the actual record', () => {
		const result = computeRecords([
			set({ id: 'a', weightKg: 80, reps: 8 }),
			set({ id: 'b', weightKg: 82.5, reps: 6 }),
			set({ id: 'c', weightKg: 75, reps: 10 }),
		]);
		expect(result.actual).toEqual([{ weightKg: 82.5, reps: 6, date: '2026-09-01', setId: 'b' }]);
	});

	it('reports a tie when two different dates share the exact heaviest weight', () => {
		const result = computeRecords([
			set({ id: 'a', weightKg: 82.5, reps: 6, completedAt: '2026-08-01T09:00:00' }),
			set({ id: 'b', weightKg: 82.5, reps: 8, completedAt: '2026-09-01T09:00:00' }),
		]);
		expect(result.actual.map((e) => e.setId).sort()).toEqual(['a', 'b']);
	});

	it('collapses multiple same-day sets at the max weight into one entry, not one tie each', () => {
		const result = computeRecords([
			set({ id: 'a', weightKg: 80, reps: 8, completedAt: '2026-09-09T09:00:00' }),
			set({ id: 'b', weightKg: 80, reps: 9, completedAt: '2026-09-09T09:10:00' }),
			set({ id: 'c', weightKg: 80, reps: 8, completedAt: '2026-09-04T09:00:00' }),
		]);
		// Two distinct dates hit 80kg, so it's a two-way tie — not three entries for three sets.
		expect(result.actual).toHaveLength(2);
		// The higher-rep set wins as the representative for its date.
		expect(result.actual.find((e) => e.date === '2026-09-09')?.setId).toBe('b');
	});

	it('picks the highest estimated 1RM even from a lighter, higher-rep set', () => {
		// 80kg x 8 -> ~101.3kg estimated; 82.5kg x 1 -> 82.5kg estimated.
		const result = computeRecords([
			set({ id: 'heavy-single', weightKg: 82.5, reps: 1 }),
			set({ id: 'volume-set', weightKg: 80, reps: 8 }),
		]);
		expect(result.estimatedOneRm).toHaveLength(1);
		expect(result.estimatedOneRm[0].setId).toBe('volume-set');
	});

	it('builds one rep-record entry per distinct weight, heaviest first', () => {
		const result = computeRecords([
			set({ id: 'a', weightKg: 80, reps: 8 }),
			set({ id: 'b', weightKg: 80, reps: 6 }),
			set({ id: 'c', weightKg: 75, reps: 10 }),
		]);
		expect(result.repRecordsByWeight).toEqual([
			{ weightKg: 80, reps: 8, date: '2026-09-01', setId: 'a' },
			{ weightKg: 75, reps: 10, date: '2026-09-01', setId: 'c' },
		]);
	});
});
