// Precise, non-trivial grouping/formatting logic — thorough case coverage per the standing
// "tests land alongside each piece" preference
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { formatSetSummary, type SetSummaryExerciseInput } from './formatSetSummary';
import type { SetEntry } from '../../domain/types';

function set(overrides: Partial<SetEntry>): SetEntry {
	return { id: 's', workoutExerciseId: 'we', order: 1, status: 'completed', ...overrides };
}

describe('formatSetSummary', () => {
	it('collapses consecutive identical weight/rep sets into one group', () => {
		const exercises: SetSummaryExerciseInput[] = [
			{
				name: 'Bench Press',
				metricProfile: 'weight-reps',
				sets: [
					set({ weightKg: 80, reps: 8 }),
					set({ weightKg: 80, reps: 8 }),
					set({ weightKg: 80, reps: 8 }),
				],
			},
		];

		const result = formatSetSummary(exercises);

		expect(result.segments).toEqual([
			{ exerciseName: 'Bench Press', valueText: '3×8 @ 80 kg', archived: false, isRecord: false },
		]);
		expect(result.overflowCount).toBe(0);
	});

	it('keeps varying sets as separate groups, in order', () => {
		const exercises: SetSummaryExerciseInput[] = [
			{
				name: 'Bench Press',
				metricProfile: 'weight-reps',
				sets: [
					set({ weightKg: 80, reps: 8 }),
					set({ weightKg: 80, reps: 8 }),
					set({ weightKg: 80, reps: 6 }),
					set({ weightKg: 75, reps: 8 }),
				],
			},
		];

		expect(formatSetSummary(exercises).segments[0].valueText).toBe(
			'2×8 @ 80 kg, 1×6 @ 80 kg, 1×8 @ 75 kg',
		);
	});

	it('does not merge non-consecutive sets that happen to share the same values', () => {
		const exercises: SetSummaryExerciseInput[] = [
			{
				name: 'Bench Press',
				metricProfile: 'weight-reps',
				sets: [
					set({ weightKg: 80, reps: 8 }),
					set({ weightKg: 75, reps: 8 }),
					set({ weightKg: 80, reps: 8 }),
				],
			},
		];

		expect(formatSetSummary(exercises).segments[0].valueText).toBe(
			'1×8 @ 80 kg, 1×8 @ 75 kg, 1×8 @ 80 kg',
		);
	});

	it('formats distance-duration sets without collapsing', () => {
		const exercises: SetSummaryExerciseInput[] = [
			{
				name: 'Running',
				metricProfile: 'distance-duration',
				sets: [set({ distanceKm: 5, durationSec: 1680, weightKg: undefined, reps: undefined })],
			},
		];

		expect(formatSetSummary(exercises).segments[0].valueText).toBe('5 km · 28:00');
	});

	it('excludes planned sets from the summary', () => {
		const exercises: SetSummaryExerciseInput[] = [
			{
				name: 'Bench Press',
				metricProfile: 'weight-reps',
				sets: [set({ weightKg: 80, reps: 8 }), set({ weightKg: 80, reps: 8, status: 'planned' })],
			},
		];

		expect(formatSetSummary(exercises).segments[0].valueText).toBe('1×8 @ 80 kg');
	});

	it('excludes an exercise entirely when it has no completed sets', () => {
		const exercises: SetSummaryExerciseInput[] = [
			{ name: 'Bench Press', metricProfile: 'weight-reps', sets: [set({ status: 'planned' })] },
			{
				name: 'Running',
				metricProfile: 'distance-duration',
				sets: [set({ distanceKm: 5, durationSec: 1680 })],
			},
		];

		const result = formatSetSummary(exercises);
		expect(result.segments).toHaveLength(1);
		expect(result.segments[0].exerciseName).toBe('Running');
	});

	it('flags an exercise as a record when any of its completed sets is one', () => {
		const exercises: SetSummaryExerciseInput[] = [
			{
				name: 'Bench Press',
				metricProfile: 'weight-reps',
				sets: [set({ weightKg: 80, reps: 8 }), set({ weightKg: 82.5, reps: 8, isRecord: true })],
			},
		];

		expect(formatSetSummary(exercises).segments[0].isRecord).toBe(true);
	});

	it('carries the archived flag through to the segment', () => {
		const exercises: SetSummaryExerciseInput[] = [
			{
				name: 'Cable Fly',
				metricProfile: 'weight-reps',
				archived: true,
				sets: [set({ weightKg: 15, reps: 12 })],
			},
		];

		expect(formatSetSummary(exercises).segments[0].archived).toBe(true);
	});

	it('truncates to maxSegments and reports the overflow count', () => {
		const exercises: SetSummaryExerciseInput[] = ['A', 'B', 'C', 'D'].map((name) => ({
			name,
			metricProfile: 'weight-reps',
			sets: [set({ weightKg: 10, reps: 10 })],
		}));

		const result = formatSetSummary(exercises, 3);
		expect(result.segments.map((s) => s.exerciseName)).toEqual(['A', 'B', 'C']);
		expect(result.overflowCount).toBe(1);
	});

	it('returns no segments and no overflow for a fully planned workout', () => {
		const exercises: SetSummaryExerciseInput[] = [
			{ name: 'Bench Press', metricProfile: 'weight-reps', sets: [set({ status: 'planned' })] },
		];

		const result = formatSetSummary(exercises);
		expect(result.segments).toEqual([]);
		expect(result.overflowCount).toBe(0);
	});
});
