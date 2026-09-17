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

/** A user-owned exercise category — three tonal colour roles, matching
 *  `src/data/categoryColours.ts`'s `CategoryColour` shape (P-35 retires that hardcoded map in
 *  favour of reading these rows for real). */
export interface Category {
	id: string;
	name: string;
	colourBackground: string;
	colourText: string;
	colourDot: string;
	sortOrder: number;
	archived: boolean;
}

export interface Exercise {
	id: string;
	name: string;
	/** Category id — see domain/repository.ts's listCategories(). */
	category: string;
	metricProfile: MetricProfile;
	note?: string;
	url?: string;
	/** Configured stepper increments, used by StepperCluster. */
	weightIncrementKg?: number;
	repsIncrement?: number;
	distanceIncrementKm?: number;
	durationIncrementSec?: number;
	restDefaultMs?: number;
	/** One of history/computeGraphPoints.ts's GraphMetric keys — the graph tab's initial metric. */
	graphDefaultMetric?: string;
	/** Archived exercises keep their history but render italicised and can't be logged fresh. */
	archived?: boolean;
	/** P-44's star toggle in the exercise detail header. */
	favourite?: boolean;
}

/** Fields a caller supplies when creating or editing an exercise — mirrors Exercise's own editable subset (id/archived/favourite are managed separately, by dedicated calls). */
export interface ExerciseValues {
	name: string;
	category: string;
	metricProfile: MetricProfile;
	note?: string;
	url?: string;
	weightIncrementKg?: number;
	repsIncrement?: number;
	distanceIncrementKm?: number;
	durationIncrementSec?: number;
	restDefaultMs?: number;
	graphDefaultMetric?: string;
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
	/** Only ever populated by routine materialization today (SPEC.md 8.4's set-template label, e.g. "warm-up" or "drop"). */
	setLabel?: string;
	/** The SetTemplate this set was materialized from (SPEC.md 8.4's provenance requirement) — undefined for any set logged directly rather than via a routine. */
	sourceTemplateId?: string;
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
	useMaterialYou: boolean;
}

/** SPEC.md section 10.1's Workout.source — 'watch' isn't a source, it's a *device* that logged
 *  into an otherwise-manual workout (see WorkoutExercise), not a distinct provenance. */
export type WorkoutSource = 'manual' | 'fitnotes-import' | 'health-connect-import';

export type WorkoutStatus = 'draft' | 'active' | 'completed' | 'abandoned';

/** `draft`/`active` are still open — the workout Today's "Continue workout" resumes, and the one
 *  P-20 materialization checks for before offering to start a second one. Kept as one predicate so
 *  those two call sites can't drift on what "open" means. */
export function isWorkoutOpen(status: WorkoutStatus): boolean {
	return status === 'draft' || status === 'active';
}

/** `completed`/`abandoned` are both terminal, and SPEC.md 8.1 treats them as equivalent for
 *  history purposes — abandoning never locks or discards what was already logged. Kept as one
 *  predicate so history summary/deletion and per-exercise history don't drift on what counts. */
export function isHistoryWorkout(status: WorkoutStatus): boolean {
	return status === 'completed' || status === 'abandoned';
}

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
	/** Set when this workout was created by materializing a routine section (SPEC.md 8.4) — provenance only. */
	sourceRoutineId?: string;
	sourceRoutineName?: string;
	healthConnect?: WorkoutHealthConnectProvenance;
}

/** A reusable workout template — SPEC.md 8.4: "templates, not a second kind of workout history." */
export interface Routine {
	id: string;
	name: string;
	note?: string;
	sortOrder: number;
	archived: boolean;
}

/** A named group of exercises within a routine — routines may have one or many sections. */
export interface RoutineSection {
	id: string;
	routineId: string;
	name?: string;
	sortOrder: number;
}

/** A routine-authored superset template; materialization copies these into a workout-level superset, matching how a SetTemplate materializes into a Set. */
export interface RoutineSuperset {
	id: string;
	routineSectionId: string;
	colour?: string;
	autoAdvance: boolean;
	restMs?: number;
}

/** One exercise slot within a routine section. */
export interface RoutineExercise {
	id: string;
	routineSectionId: string;
	exerciseId: string;
	order: number;
	routineSupersetId?: string;
	supersetPosition?: number;
	restMs?: number;
	note?: string;
}

/** The only `populationRule` value shipped in v1 — more may be added later. */
export const SEED_LAST_PERFORMANCE = 'seed-last-performance' as const;

/** A planned set within a routine exercise — either explicit target values, or a rule to seed values from the most recent comparable performance at materialization time (SPEC.md 8.4/10.1). A fixed rep target is repsMin === repsMax; a true range has repsMin < repsMax. */
export interface SetTemplate {
	id: string;
	routineExerciseId: string;
	order: number;
	weightKg?: number;
	repsMin?: number;
	repsMax?: number;
	distanceKm?: number;
	durationSec?: number;
	populationRule?: string;
	setLabel?: string;
}

/** The subset of SetTemplate's fields a caller supplies when creating one. Supplying only repsMin means a fixed target — the backend fills repsMax in to match. */
export interface SetTemplateValues {
	weightKg?: number;
	repsMin?: number;
	repsMax?: number;
	distanceKm?: number;
	durationSec?: number;
	populationRule?: string;
	setLabel?: string;
}

/** A target attached to an exercise (SPEC.md 8.8). Whether the target has actually been reached is computed over logged history, not stored — achievedAt is a manual toggle, distinct from that calculation. */
export interface ExerciseGoal {
	id: string;
	exerciseId: string;
	title: string;
	targetWeightKg?: number;
	targetReps?: number;
	targetDistanceKm?: number;
	targetDurationSec?: number;
	startDate?: string;
	targetDate?: string;
	achievedAt?: string;
	archived: boolean;
}

/** Fields a caller supplies when creating or editing a goal. */
export interface ExerciseGoalValues {
	exerciseId: string;
	title: string;
	targetWeightKg?: number;
	targetReps?: number;
	targetDistanceKm?: number;
	targetDurationSec?: number;
	startDate?: string;
	targetDate?: string;
}

/** A user-owned (or built-in-but-editable) measurement kind (SPEC.md 8.8). `archived` doubles as the enabled state. */
export interface MeasurementDefinition {
	id: string;
	name: string;
	unit: string;
	goal?: number;
	sortOrder: number;
	archived: boolean;
}

/** One logged value for a MeasurementDefinition — a distinct entity from a goal. */
export interface MeasurementRecord {
	id: string;
	definitionId: string;
	date: string;
	recordedAt: string;
	value: number;
	note?: string;
}

/** One completed set, denormalized with its exercise/category context for P-47's training analysis — grouping and drill-down happen entirely in TS, mirroring computeStats.ts/computeRecords.ts's own "pure function over fetched rows" pattern. */
export interface AnalysisSetEntry {
	setId: string;
	workoutId: string;
	exerciseId: string;
	exerciseName: string;
	categoryId: string;
	categoryName: string;
	metricProfile: MetricProfile;
	date: string;
	/** This set's order within its own workout-exercise (`SetEntry.order` elsewhere) — distinguishes two completed sets with otherwise-identical logged values in the drill-down list. */
	setOrder: number;
	weightKg?: number;
	reps?: number;
	distanceKm?: number;
	durationSec?: number;
}

/** A pinned P-47 breakdown configuration (SPEC.md 8.7: "pin recurring breakdowns without changing their underlying workout data"). `config` is an opaque JSON blob the frontend defines and parses — the backend never inspects its shape. */
export interface AnalysisFavourite {
	id: string;
	name: string;
	config: string;
	sortOrder: number;
}
