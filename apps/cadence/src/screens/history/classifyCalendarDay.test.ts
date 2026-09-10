// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { classifyCalendarDay } from './classifyCalendarDay';

describe('classifyCalendarDay', () => {
	it('classifies an empty day as no-workout', () => {
		expect(classifyCalendarDay([])).toBe('no-workout');
	});

	it('classifies a single completed workout as has-workout', () => {
		expect(classifyCalendarDay([{ hasCompletedSets: true }])).toBe('has-workout');
	});

	it('classifies a single fully planned workout as planned-only', () => {
		expect(classifyCalendarDay([{ hasCompletedSets: false }])).toBe('planned-only');
	});

	it('classifies more than one workout as multi-workout regardless of completion', () => {
		expect(classifyCalendarDay([{ hasCompletedSets: true }, { hasCompletedSets: false }])).toBe(
			'multi-workout',
		);
		expect(classifyCalendarDay([{ hasCompletedSets: false }, { hasCompletedSets: false }])).toBe(
			'multi-workout',
		);
	});
});
