// Covers the day-difference, relative-label, grouping, and month-boundary helpers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import {
	addDays,
	daysBefore,
	formatHistoryGroupLabel,
	formatRowDateLabel,
	monthEndOf,
	monthStartOf,
} from './historyDates';

const TODAY = '2026-09-09';

describe('daysBefore', () => {
	it('is zero for the same date', () => {
		expect(daysBefore(TODAY, TODAY)).toBe(0);
	});

	it('is positive for a date in the past', () => {
		expect(daysBefore(TODAY, '2026-09-02')).toBe(7);
	});

	it('is negative for a date in the future', () => {
		expect(daysBefore(TODAY, '2026-09-12')).toBe(-3);
	});
});

describe('formatRowDateLabel', () => {
	it('labels today and yesterday specially', () => {
		expect(formatRowDateLabel(TODAY, TODAY)).toBe('Today');
		expect(formatRowDateLabel('2026-09-08', TODAY)).toBe('Yesterday');
	});

	it('falls back to a weekday/day/month label otherwise', () => {
		expect(formatRowDateLabel('2026-09-04', TODAY)).toBe('Fri, Sep 4');
	});
});

describe('formatHistoryGroupLabel', () => {
	it('groups the last 7 days as This week', () => {
		expect(formatHistoryGroupLabel(TODAY, TODAY)).toBe('This week');
		expect(formatHistoryGroupLabel('2026-09-03', TODAY)).toBe('This week');
	});

	it('groups days 7-13 ago as Last week', () => {
		expect(formatHistoryGroupLabel('2026-09-02', TODAY)).toBe('Last week');
		expect(formatHistoryGroupLabel('2026-08-27', TODAY)).toBe('Last week');
	});

	it('groups anything older by month and year', () => {
		expect(formatHistoryGroupLabel('2026-08-19', TODAY)).toBe('August 2026');
		expect(formatHistoryGroupLabel('2026-06-19', TODAY)).toBe('June 2026');
	});

	it('groups a future date by its own month, not as a recency bucket', () => {
		expect(formatHistoryGroupLabel('2026-09-12', TODAY)).toBe('September 2026');
	});
});

describe('addDays', () => {
	it('shifts backward across a month boundary', () => {
		expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
	});

	it('shifts forward across a year boundary', () => {
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
	});
});

describe('monthStartOf / monthEndOf', () => {
	it('finds the first and last day of a 31-day month', () => {
		expect(monthStartOf('2026-08-19')).toBe('2026-08-01');
		expect(monthEndOf('2026-08-19')).toBe('2026-08-31');
	});

	it('finds the last day of February in a leap year', () => {
		expect(monthEndOf('2028-02-10')).toBe('2028-02-29');
	});

	it('finds the last day of a 30-day month', () => {
		expect(monthEndOf('2026-09-05')).toBe('2026-09-30');
	});
});
