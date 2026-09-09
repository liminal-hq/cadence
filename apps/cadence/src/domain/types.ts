// Domain types for the logging flow -- the subset of SPEC.md section 10.1's
// core entities this UI needs. Lives under apps/cadence/src/domain rather
// than packages/core: nothing else consumes these yet (no wear app, no Rust
// domain layer to mirror against), so hoisting now would be premature.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

export type MetricProfile = 'weight-reps' | 'distance-duration';

export type SetStatus = 'planned' | 'completed';

export type WeightUnit = 'kg' | 'lb';

export interface Exercise {
	id: string;
	name: string;
	/** Category id -- see src/data/categoryColours.ts. */
	category: string;
	metricProfile: MetricProfile;
	/** Configured stepper increments, used by StepperCluster. */
	weightIncrementKg?: number;
	repsIncrement?: number;
	distanceIncrementKm?: number;
	durationIncrementSec?: number;
}

export interface WorkoutExercise {
	id: string;
	exerciseId: string;
	workoutId: string;
	workoutLabel: string;
	order: number;
	/** Permanent, exercise-level technique note. */
	technicalNote?: string;
	/** This-workout-only note, distinct from the technical note. */
	todayNote?: string;
	supersetGroupId?: string;
	/** 1-indexed position within the superset group. */
	supersetPosition?: number;
	supersetSize?: number;
	/** Set when a paired device (the watch) has been offline since this instant. */
	offlineSince?: string;
	lastTimeReference?: LastTimeReference;
}

export interface LastTimeReference {
	dateLabel: string;
	bestLabel: string;
	sets: { valueLabel: string }[];
	quote?: string;
}

export interface SetEntry {
	id: string;
	workoutExerciseId: string;
	order: number;
	status: SetStatus;
	/** Canonical storage is always kg/km/seconds; display unit is a UI concern. */
	weightKg?: number;
	reps?: number;
	distanceKm?: number;
	durationSec?: number;
	completedAt?: string;
	note?: string;
	isRecord?: boolean;
	/** True while a watch-logged set hasn't merged back from the phone's perspective. */
	pendingSync?: boolean;
}

export type RestTimerStatus = 'inactive' | 'running' | 'paused' | 'elapsed';
export type RestTimerOwner = 'phone' | 'watch';

export interface RestTimerState {
	status: RestTimerStatus;
	/** ISO instant the timer will complete -- the canonical model (SPEC 8.6), not a tick count. */
	targetInstant?: string;
	totalMs?: number;
	/** Captured remaining time so pausing/resuming doesn't need wall-clock math to round-trip. */
	remainingMsAtPause?: number;
	ownerDevice?: RestTimerOwner;
	forSetId?: string;
	nextSetLabel?: string;
}

/**
 * Barbell/plate values are all expressed in the config's own `displayUnit`
 * (kg or lb), not canonical kg -- the calculator only ever does arithmetic
 * within one consistent unit. Converting a set's canonical kg weight into
 * the chosen barbell's unit is the caller's job (see PlateCalculatorSheet),
 * matching SPEC 10.4's "define the conversion at the domain boundary".
 */
export interface BarbellConfig {
	id: string;
	name: string;
	barWeight: number;
	displayUnit: WeightUnit;
	/** Per-side available plate weights, descending. */
	availablePlates: number[];
}

export interface PlateCalculationResult {
	loadable: boolean;
	targetWeight: number;
	perSidePlates: number[];
	perSideTotal: number;
	achievedTotal: number;
	nearestLower?: number;
	nearestHigher?: number;
	shortfall?: number;
	smallestPlate?: number;
}
