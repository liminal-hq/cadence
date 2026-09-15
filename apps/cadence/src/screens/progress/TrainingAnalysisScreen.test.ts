// Covers dateRangeFor's inclusive-window arithmetic — the backend's BETWEEN range is inclusive of both endpoints
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { dateRangeFor } from './TrainingAnalysisScreen';

describe('dateRangeFor', () => {
	it('spans exactly 7 dates for the 7-day period', () => {
		const { startDate, endDate } = dateRangeFor('7d', '2026-09-15');
		expect(startDate).toBe('2026-09-09');
		expect(endDate).toBe('2026-09-15');
	});

	it('spans exactly 30 dates for the 30-day period', () => {
		const { startDate, endDate } = dateRangeFor('30d', '2026-09-15');
		expect(startDate).toBe('2026-08-17');
		expect(endDate).toBe('2026-09-15');
	});

	it('does not shift the start date across a UTC day boundary', () => {
		// A UTC round-trip (toISOString) would have pulled this back an extra calendar day in a positive-offset timezone; the local-date arithmetic must not do that.
		const { startDate } = dateRangeFor('7d', '2026-01-01');
		expect(startDate).toBe('2025-12-26');
	});

	it('uses the earliest-supported date for all time', () => {
		const { startDate, endDate } = dateRangeFor('all', '2026-09-15');
		expect(startDate).toBe('2000-01-01');
		expect(endDate).toBe('2026-09-15');
	});
});
