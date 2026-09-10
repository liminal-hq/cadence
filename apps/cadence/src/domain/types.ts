// Domain types for the logging and settings flows — the subset of SPEC.md section 10.1's
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
	/** Category id — see src/data/categoryColours.ts. */
	category: string;
	metricProfile: MetricProfile;
	/** Configured stepper increments, used by StepperCluster. */
	weightIncrementKg?: number;
	repsIncrement?: number;
	distanceIncrementKm?: number;
	durationIncrementSec?: number;
	/** Archived exercises keep their history but render italicised and can't be logged fresh. */
	archived?: boolean;
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
	/** ISO instant the timer will complete — the canonical model (SPEC 8.6), not a tick count. */
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
 * (kg or lb), not canonical kg — the calculator only ever does arithmetic
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
	/** At most one config is ever the default — PlateCalculatorSheet opens on it. */
	isDefault?: boolean;
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

export type RestFeedbackDevice = 'watch' | 'phone' | 'both';

/** Durable application preferences (SPEC.md section 8.10) — session-lifetime in the mock
 *  repository today, same persistence boundary as everything else it backs. */
export interface Settings {
	weightUnit: WeightUnit;
	defaultRestMs: number;
	restAutoStart: boolean;
	restReplacesRunning: boolean;
	vibrateEnabled: boolean;
	soundEnabled: boolean;
	restFeedbackDevice: RestFeedbackDevice;
	workoutTimerAutoStart: boolean;
	keepScreenOnDuringWorkout: boolean;
	hapticOnSetComplete: boolean;
	hapticOnRestEnd: boolean;
	reducedMotion: boolean;
	/** Drives P-61's notifications-denied banner; "Turn on" flips this rather than calling a
	 *  real OS permission API, which doesn't exist in this mock/desktop context. */
	notificationsDenied: boolean;
	automaticBackupEnabled: boolean;
}

/** SPEC.md section 10.1's Workout.source — 'watch' isn't a source, it's a *device* that logged
 *  into an otherwise-manual workout (see WorkoutExercise), not a distinct provenance. */
export type WorkoutSource = 'manual' | 'fitnotes-import' | 'health-connect-import';

export type WorkoutStatus = 'in-progress' | 'completed';

export interface WorkoutHealthConnectProvenance {
	sourceApp: string;
	/** The external record ID — SPEC 10.2's dedup key for re-imports, not used by the mock yet. */
	recordId: string;
	importedAt: string;
	/** Recognized-but-not-mapped-to-a-set metrics from the source record, shown but never turned
	 *  into sets (P-43's "Also recorded" card). */
	unmappedMetrics?: string[];
	/** Set when this import overlaps a manually logged workout on the same date, requiring
	 *  explicit user resolution (SPEC 10.2) — never silently merged or discarded. */
	overlapsWithWorkoutId?: string;
}

export interface Workout {
	id: string;
	/** The user's intended training date (local date, not an instant) — SPEC 10.2 keeps this
	 *  separate from start/end timestamps so a late-night session still counts for its day. */
	date: string;
	title: string;
	note?: string;
	startedAt?: string;
	completedAt?: string;
	status: WorkoutStatus;
	source: WorkoutSource;
	/** True when any set in this workout was logged from the paired watch. */
	loggedByWatch?: boolean;
	healthConnect?: WorkoutHealthConnectProvenance;
}
