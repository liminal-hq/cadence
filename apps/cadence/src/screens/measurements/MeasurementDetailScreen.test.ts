// Covers byDateThenRecordedAt's same-day tie-break, so a graph's chronologically-last point is the actually-last-recorded one, and isValidDate's calendar-strict validation
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { byDateThenRecordedAt, isValidDate } from './MeasurementDetailScreen';
import type { MeasurementRecord } from '../../domain/types';

function record(overrides: Partial<MeasurementRecord>): MeasurementRecord {
	return {
		id: 'r',
		definitionId: 'd',
		date: '2026-09-01',
		recordedAt: '2026-09-01T08:00:00.000Z',
		value: 80,
		...overrides,
	};
}

describe('byDateThenRecordedAt', () => {
	it('orders by date first', () => {
		const a = record({ id: 'a', date: '2026-09-02' });
		const b = record({ id: 'b', date: '2026-09-01' });
		expect([a, b].sort(byDateThenRecordedAt(1)).map((r) => r.id)).toEqual(['b', 'a']);
	});

	it('breaks a same-day tie by recordedAt, ascending', () => {
		const earlier = record({ id: 'earlier', recordedAt: '2026-09-01T08:00:00.000Z' });
		const later = record({ id: 'later', recordedAt: '2026-09-01T18:00:00.000Z' });
		expect([later, earlier].sort(byDateThenRecordedAt(1)).map((r) => r.id)).toEqual([
			'earlier',
			'later',
		]);
	});

	it('breaks a same-day tie by recordedAt, descending', () => {
		const earlier = record({ id: 'earlier', recordedAt: '2026-09-01T08:00:00.000Z' });
		const later = record({ id: 'later', recordedAt: '2026-09-01T18:00:00.000Z' });
		expect([earlier, later].sort(byDateThenRecordedAt(-1)).map((r) => r.id)).toEqual([
			'later',
			'earlier',
		]);
	});
});

describe('isValidDate', () => {
	it('accepts a real calendar date', () => {
		expect(isValidDate('2026-09-01')).toBe(true);
	});

	it('rejects a calendar-invalid date instead of letting it silently roll over', () => {
		expect(isValidDate('2026-02-30')).toBe(false);
		expect(isValidDate('2026-13-01')).toBe(false);
		expect(isValidDate('2026-04-31')).toBe(false);
	});

	it('accepts a leap-day date only in a leap year', () => {
		expect(isValidDate('2028-02-29')).toBe(true);
		expect(isValidDate('2026-02-29')).toBe(false);
	});

	it('rejects a blank or malformed value', () => {
		expect(isValidDate('')).toBe(false);
		expect(isValidDate('not-a-date')).toBe(false);
		expect(isValidDate('2026-9-1')).toBe(false);
	});
});
