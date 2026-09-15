// Covers byDateThenRecordedAt's same-day tie-break, so a graph's chronologically-last point is the actually-last-recorded one
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { byDateThenRecordedAt } from './MeasurementDetailScreen';
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
