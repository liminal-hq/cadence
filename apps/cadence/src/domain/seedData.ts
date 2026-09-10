// Reference fixture data for the logging flow's three demo scenarios,
// written with stable ids and realistic values a future migration can
// crib from — not a literal claim that this file becomes SQL seed data
// (fields like `pendingSync`/`isRecord` are derived/sync state, not real
// columns), but shaped the way real seed rows would be.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { BarbellConfig, Exercise, SetEntry, Settings, WorkoutExercise } from './types';

export type Scenario = 'sam-default' | 'sam-superset-dark' | 'priya-first-run';

export const SCENARIO_TO_WORKOUT_EXERCISE_ID: Record<Scenario, string> = {
	'sam-default': 'we-bench-press',
	'sam-superset-dark': 'we-lateral-raise',
	'priya-first-run': 'we-goblet-squat',
};

export const EXERCISES: Exercise[] = [
	{
		id: 'ex-bench-press',
		name: 'Bench Press',
		category: 'chest',
		metricProfile: 'weight-reps',
		weightIncrementKg: 2.5,
		repsIncrement: 1,
	},
	{
		id: 'ex-lateral-raise',
		name: 'Lateral Raise',
		category: 'shoulders',
		metricProfile: 'weight-reps',
		weightIncrementKg: 1,
		repsIncrement: 1,
	},
	{
		id: 'ex-triceps-pushdown',
		name: 'Triceps Rope Pushdown',
		category: 'triceps',
		metricProfile: 'weight-reps',
		weightIncrementKg: 2.5,
		repsIncrement: 1,
	},
	{
		id: 'ex-running',
		name: 'Running',
		category: 'cardio',
		metricProfile: 'distance-duration',
		distanceIncrementKm: 0.1,
		durationIncrementSec: 10,
	},
	{
		id: 'ex-goblet-squat',
		name: 'Goblet Squat',
		category: 'legs',
		metricProfile: 'weight-reps',
		weightIncrementKg: 2.5,
		repsIncrement: 1,
	},
];

export const WORKOUT_EXERCISES: WorkoutExercise[] = [
	{
		id: 'we-bench-press',
		exerciseId: 'ex-bench-press',
		workoutId: 'workout-push-a',
		workoutLabel: 'Push A · exercise 1 of 6',
		order: 1,
		technicalNote: 'Pause at chest · pinky on ring · feet back',
		todayNote: 'Bench 3 was taken — used the Smith rack, felt different',
		lastTimeReference: {
			dateLabel: 'Thu 4 Sept',
			bestLabel: 'Best 82.5 × 8',
			sets: [
				{ valueLabel: '80 × 8' },
				{ valueLabel: '80 × 8' },
				{ valueLabel: '80 × 7' },
				{ valueLabel: '80 × 6' },
			],
			quote: 'felt heavy',
		},
	},
	{
		id: 'we-running',
		exerciseId: 'ex-running',
		workoutId: 'workout-push-a',
		workoutLabel: 'Push A · exercise 2 of 6',
		order: 2,
		lastTimeReference: {
			dateLabel: 'Sun 6 Sept',
			bestLabel: 'Best 5.0 km · 27:40',
			sets: [{ valueLabel: '5.0 km · 27:40' }],
		},
	},
	{
		id: 'we-lateral-raise',
		exerciseId: 'ex-lateral-raise',
		workoutId: 'workout-push-b',
		workoutLabel: 'Superset A · round 2/3 · 1 of 2',
		order: 1,
		supersetGroupId: 'ss-1',
		supersetPosition: 1,
		supersetSize: 2,
		offlineSince: '2026-09-09T10:09:00',
		lastTimeReference: {
			dateLabel: 'Fri 5 Sept',
			bestLabel: 'Best 12.5 × 15',
			sets: [{ valueLabel: '10 × 15' }, { valueLabel: '10 × 15' }, { valueLabel: '10 × 13' }],
		},
	},
	{
		id: 'we-triceps-pushdown',
		exerciseId: 'ex-triceps-pushdown',
		workoutId: 'workout-push-b',
		workoutLabel: 'Superset A · round 2/3 · 2 of 2',
		order: 2,
		supersetGroupId: 'ss-1',
		supersetPosition: 2,
		supersetSize: 2,
		offlineSince: '2026-09-09T10:09:00',
	},
	{
		id: 'we-goblet-squat',
		exerciseId: 'ex-goblet-squat',
		workoutId: 'workout-priya-1',
		workoutLabel: 'Workout · exercise 1 of 1',
		order: 1,
	},
];

export const SETS: SetEntry[] = [
	// Sam default — Bench Press: 2 completed (one a PR), 2 planned.
	{
		id: 'set-bp-1',
		workoutExerciseId: 'we-bench-press',
		order: 1,
		status: 'completed',
		weightKg: 80,
		reps: 8,
		completedAt: '2026-09-09T09:40:00',
	},
	{
		id: 'set-bp-2',
		workoutExerciseId: 'we-bench-press',
		order: 2,
		status: 'completed',
		weightKg: 80,
		reps: 9,
		isRecord: true,
		completedAt: '2026-09-09T09:52:00',
		note: 'Spotter touched the bar on rep 9 — count it as 8 clean. Grip felt narrow, try one finger wider next',
	},
	{
		id: 'set-bp-3',
		workoutExerciseId: 'we-bench-press',
		order: 3,
		status: 'planned',
		weightKg: 80,
		reps: 8,
	},
	{
		id: 'set-bp-4',
		workoutExerciseId: 'we-bench-press',
		order: 4,
		status: 'planned',
		weightKg: 80,
		reps: 8,
	},

	// Sam default — Running (distance+duration), reached via next-exercise nav; the
	// invalid/draft-restored Set editor demo just opens this seeded set directly.
	{
		id: 'set-run-1',
		workoutExerciseId: 'we-running',
		order: 1,
		status: 'planned',
		distanceKm: 5.2,
	},

	// Superset scenario — Lateral Raise: one watch-logged set pending sync, one open, one planned.
	{
		id: 'set-lr-1',
		workoutExerciseId: 'we-lateral-raise',
		order: 1,
		status: 'completed',
		weightKg: 10,
		reps: 15,
		completedAt: '2026-09-09T10:08:00',
		pendingSync: true,
	},
	{
		id: 'set-lr-2',
		workoutExerciseId: 'we-lateral-raise',
		order: 2,
		status: 'planned',
		weightKg: 10,
		reps: 15,
	},
	{
		id: 'set-lr-3',
		workoutExerciseId: 'we-lateral-raise',
		order: 3,
		status: 'planned',
		weightKg: 10,
		reps: 15,
	},
	{
		id: 'set-tp-1',
		workoutExerciseId: 'we-triceps-pushdown',
		order: 1,
		status: 'planned',
		weightKg: 25,
		reps: 12,
	},

	// Priya first-run — Goblet Squat: a single empty set, nothing logged yet.
	{
		id: 'set-gs-1',
		workoutExerciseId: 'we-goblet-squat',
		order: 1,
		status: 'planned',
	},
];

export const BARBELL_CONFIGS: BarbellConfig[] = [
	{
		id: 'barbell-olympic',
		name: 'Olympic',
		barWeight: 20,
		displayUnit: 'kg',
		availablePlates: [25, 20, 15, 10, 5, 2.5, 1.25],
		isDefault: true,
	},
	{
		id: 'barbell-standard',
		name: 'Standard',
		barWeight: 45,
		displayUnit: 'lb',
		availablePlates: [45, 35, 25, 10, 5, 2.5],
	},
];

export const DEFAULT_SETTINGS: Settings = {
	weightUnit: 'kg',
	defaultRestMs: 120_000,
	restAutoStart: true,
	restReplacesRunning: true,
	vibrateEnabled: true,
	soundEnabled: true,
	restFeedbackDevice: 'phone',
	workoutTimerAutoStart: true,
	keepScreenOnDuringWorkout: true,
	hapticOnSetComplete: true,
	hapticOnRestEnd: true,
	reducedMotion: false,
	// Seeded denied so P-61's notifications banner has something real to demonstrate.
	notificationsDenied: true,
	automaticBackupEnabled: true,
};
