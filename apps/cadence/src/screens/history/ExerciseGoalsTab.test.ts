// Covers draftValidationError's integer-target and date-ordering checks
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { draftValidationError } from './ExerciseGoalsTab';
import type { ExerciseGoalValues } from '../../domain/types';

function draft(overrides: Partial<ExerciseGoalValues>): ExerciseGoalValues {
	return { exerciseId: 'ex-1', title: 'Bench 100kg', targetWeightKg: 100, ...overrides };
}

describe('draftValidationError', () => {
	it('accepts a well-formed weight-reps draft', () => {
		expect(draftValidationError(draft({}), 'weight-reps')).toBeUndefined();
	});

	it('rejects a blank title', () => {
		expect(draftValidationError(draft({ title: '  ' }), 'weight-reps')).toBeDefined();
	});

	it('rejects a draft with no target field set at all', () => {
		expect(draftValidationError(draft({ targetWeightKg: undefined }), 'weight-reps')).toBe(
			'Enter a target.',
		);
	});

	it('rejects a fractional target reps', () => {
		expect(draftValidationError(draft({ targetReps: 2.5 }), 'weight-reps')).toBe(
			'Target reps must be a whole number.',
		);
	});

	it('rejects a zero or negative target weight', () => {
		expect(draftValidationError(draft({ targetWeightKg: 0 }), 'weight-reps')).toBe(
			'Target weight must be greater than zero.',
		);
		expect(draftValidationError(draft({ targetWeightKg: -10 }), 'weight-reps')).toBe(
			'Target weight must be greater than zero.',
		);
	});

	it('rejects a zero or negative target reps', () => {
		expect(
			draftValidationError(draft({ targetWeightKg: undefined, targetReps: 0 }), 'weight-reps'),
		).toBe('Target reps must be greater than zero.');
		expect(
			draftValidationError(draft({ targetWeightKg: undefined, targetReps: -5 }), 'weight-reps'),
		).toBe('Target reps must be greater than zero.');
	});

	it('rejects a zero or negative target distance', () => {
		const value = draft({ targetWeightKg: undefined, targetDistanceKm: -5 });
		expect(draftValidationError(value, 'distance-duration')).toBe(
			'Target distance must be greater than zero.',
		);
	});

	it('rejects a zero or negative target duration', () => {
		const value = draft({
			targetWeightKg: undefined,
			targetDistanceKm: 5,
			targetDurationSec: -90,
		});
		expect(draftValidationError(value, 'distance-duration')).toBe(
			'Target duration must be greater than zero.',
		);
	});

	it('rejects a fractional target duration', () => {
		const value = draft({
			targetWeightKg: undefined,
			targetDistanceKm: 5,
			targetDurationSec: 90.5,
		});
		expect(draftValidationError(value, 'distance-duration')).toBe(
			'Target duration must be a whole number of seconds.',
		);
	});

	it('rejects a target date before the start date', () => {
		const value = draft({ startDate: '2026-09-10', targetDate: '2026-09-01' });
		expect(draftValidationError(value, 'weight-reps')).toBe(
			'Target date must be on or after the start date.',
		);
	});

	it('accepts a target date on the same day as the start date', () => {
		const value = draft({ startDate: '2026-09-10', targetDate: '2026-09-10' });
		expect(draftValidationError(value, 'weight-reps')).toBeUndefined();
	});
});
