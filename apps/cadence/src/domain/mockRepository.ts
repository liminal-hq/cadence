// In-memory LoggingRepository over seedData.ts. Session-lifetime only —
// resets on reload. Swapping in a real backend later means constructing a
// Tauri `invoke()`-backed LoggingRepository and changing the one line in
// RepositoryProvider's default, not touching any call site.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LoggingRepository, Unsubscribe } from './repository';
import type {
	AnalysisSetEntry,
	BarbellConfig,
	Category,
	Exercise,
	ExerciseGoal,
	ExerciseGoalValues,
	ExerciseValues,
	MeasurementDefinition,
	MeasurementRecord,
	PlateCalculationResult,
	RestTimerState,
	Routine,
	RoutineExercise,
	RoutineSection,
	RoutineSuperset,
	SetEntry,
	SetTemplate,
	SetTemplateValues,
	Settings,
	Workout,
	WorkoutExercise,
} from './types';
import { SEED_LAST_PERFORMANCE } from './types';
import {
	BARBELL_CONFIGS,
	CATEGORIES,
	DEFAULT_SETTINGS,
	EXERCISES,
	MEASUREMENT_DEFINITIONS,
	SETS,
	WORKOUT_EXERCISES,
	WORKOUTS,
} from './seedData';

const EPSILON = 0.001;

const KNOWN_METRIC_PROFILES = new Set(['weight-reps', 'distance-duration']);
const KNOWN_GRAPH_METRICS = new Set(['weight', 'estimated-1rm', 'volume', 'distance', 'pace']);

interface PlateCombo {
	total: number;
	plates: number[];
}

/**
 * Sorted by total descending; ties broken by fewer plates, then by
 * preferring larger plates first — e.g. 25+5+1.25 sorts ahead of
 * 20+10+1.25 for the same 31.25 total, matching how a lifter would
 * actually prefer to load a bar.
 */
function comparePlateCombos(a: PlateCombo, b: PlateCombo): number {
	if (Math.abs(a.total - b.total) > EPSILON) return b.total - a.total;
	if (a.plates.length !== b.plates.length) return a.plates.length - b.plates.length;
	const aDesc = [...a.plates].sort((x, y) => y - x);
	const bDesc = [...b.plates].sort((x, y) => y - x);
	for (let i = 0; i < aDesc.length; i++) {
		if (aDesc[i] !== bDesc[i]) return bDesc[i] - aDesc[i];
	}
	return 0;
}

/** Every achievable per-side plate total from one instance of each plate. */
function achievableTotals(plates: number[]): PlateCombo[] {
	const results: PlateCombo[] = [{ total: 0, plates: [] }];
	for (const plate of plates) {
		const additions = results.map((r) => ({
			total: r.total + plate,
			plates: [...r.plates, plate],
		}));
		results.push(...additions);
	}
	return results.sort(comparePlateCombos);
}

export function calculatePlatesPure(
	targetWeight: number,
	barbell: BarbellConfig,
): PlateCalculationResult {
	const perSideTarget = (targetWeight - barbell.barWeight) / 2;
	const totals = achievableTotals(barbell.availablePlates);

	const exact = totals.find((t) => Math.abs(t.total - perSideTarget) < EPSILON);
	// Neighbours are always computed (not just when unloadable) so the sheet's
	// stepper can browse to the adjacent achievable total either way.
	const below = totals.filter((t) => t.total < perSideTarget - EPSILON);
	const above = totals.filter((t) => t.total > perSideTarget + EPSILON);
	const nearestLowerCombo = below.length > 0 ? below[0] : undefined;
	const nearestHigherCombo = above.length > 0 ? above[above.length - 1] : undefined;

	const shown = exact ?? nearestLowerCombo ?? { total: 0, plates: [] };

	return {
		loadable: Boolean(exact),
		targetWeight,
		perSidePlates: [...shown.plates].sort((a, b) => b - a),
		perSideTotal: shown.total,
		achievedTotal: barbell.barWeight + 2 * shown.total,
		nearestLower: nearestLowerCombo ? barbell.barWeight + 2 * nearestLowerCombo.total : undefined,
		nearestHigher: nearestHigherCombo
			? barbell.barWeight + 2 * nearestHigherCombo.total
			: undefined,
		shortfall: exact ? undefined : perSideTarget - (nearestLowerCombo?.total ?? 0),
		smallestPlate: exact ? undefined : Math.min(...barbell.availablePlates),
	};
}

function newId(prefix: string): string {
	return `${prefix}-${crypto.randomUUID()}`;
}

/** Mirrors the real repository's `iso_to_ms` validation — rejects a malformed instant rather than silently storing it, since `new Date(garbage)` would otherwise produce an `Invalid Date` that only fails much later, at display time. */
function validateRecordedAt(recordedAt: string | undefined): string | undefined {
	if (recordedAt === undefined) return undefined;
	if (Number.isNaN(new Date(recordedAt).getTime())) {
		throw new Error(`Invalid ISO 8601 instant: ${recordedAt}`);
	}
	return recordedAt;
}

export class MockLoggingRepository implements LoggingRepository {
	private exercises = new Map(EXERCISES.map((e) => [e.id, e]));
	private workoutExercises = new Map(WORKOUT_EXERCISES.map((we) => [we.id, { ...we }]));
	private sets = new Map(SETS.map((s) => [s.id, { ...s }]));
	private workouts = new Map(WORKOUTS.map((w) => [w.id, { ...w }]));
	private restTimer: RestTimerState = { status: 'inactive' };
	private restTimerListeners = new Set<(state: RestTimerState) => void>();
	private restTimerTimeout: ReturnType<typeof setTimeout> | undefined;
	private barbells = new Map(BARBELL_CONFIGS.map((b) => [b.id, { ...b }]));
	private settings: Settings = { ...DEFAULT_SETTINGS };
	// No seed data — real routines start empty too (0001_initial_schema.sql ships no rows).
	private routines = new Map<string, Routine>();
	private routineSections = new Map<string, RoutineSection>();
	private routineSupersets = new Map<string, RoutineSuperset>();
	private routineExercises = new Map<string, RoutineExercise>();
	private setTemplates = new Map<string, SetTemplate>();
	private categories = new Map(CATEGORIES.map((c) => [c.id, { ...c }]));
	private exerciseGoals = new Map<string, ExerciseGoal>();
	private measurementDefinitions = new Map(MEASUREMENT_DEFINITIONS.map((d) => [d.id, { ...d }]));
	private measurementRecords = new Map<string, MeasurementRecord>();

	async getExercise(id: string): Promise<Exercise> {
		const exercise = this.exercises.get(id);
		if (!exercise) throw new Error(`Unknown exercise: ${id}`);
		return exercise;
	}

	async listExercises(): Promise<Exercise[]> {
		return [...this.exercises.values()].sort((a, b) => a.name.localeCompare(b.name));
	}

	async updateExerciseFavourite(exerciseId: string, favourite: boolean): Promise<Exercise> {
		const existing = await this.getExercise(exerciseId);
		const updated = { ...existing, favourite };
		this.exercises.set(exerciseId, updated);
		return updated;
	}

	private validateExerciseValues(values: ExerciseValues) {
		if (!KNOWN_METRIC_PROFILES.has(values.metricProfile)) {
			throw new Error(`Unknown metric profile: ${values.metricProfile}`);
		}
		if (values.graphDefaultMetric && !KNOWN_GRAPH_METRICS.has(values.graphDefaultMetric)) {
			throw new Error(`Unknown graph default metric: ${values.graphDefaultMetric}`);
		}
		if (values.weightIncrementKg != null && !(values.weightIncrementKg > 0)) {
			throw new Error('Weight increment must be positive');
		}
		if (values.weightIncrementKg != null && Math.round(values.weightIncrementKg * 1000) < 1) {
			throw new Error('Weight increment is too small to represent in whole grams');
		}
		if (values.repsIncrement != null && !(values.repsIncrement > 0)) {
			throw new Error('Reps increment must be positive');
		}
		if (values.distanceIncrementKm != null && !(values.distanceIncrementKm > 0)) {
			throw new Error('Distance increment must be positive');
		}
		if (values.distanceIncrementKm != null && Math.round(values.distanceIncrementKm * 1000) < 1) {
			throw new Error('Distance increment is too small to represent in whole metres');
		}
		if (values.durationIncrementSec != null && !(values.durationIncrementSec > 0)) {
			throw new Error('Duration increment must be positive');
		}
		if (values.restDefaultMs != null && !(values.restDefaultMs > 0)) {
			throw new Error('Default rest must be positive');
		}
	}

	private rejectDuplicateExerciseName(name: string, excludingId?: string) {
		const collides = [...this.exercises.values()].some(
			(e) => e.id !== excludingId && e.name.toLowerCase() === name.toLowerCase(),
		);
		if (collides) throw new Error(`An exercise named "${name}" already exists`);
	}

	async createExercise(values: ExerciseValues): Promise<Exercise> {
		this.validateExerciseValues(values);
		const name = values.name.trim();
		this.rejectDuplicateExerciseName(name);
		const exercise: Exercise = {
			...values,
			name,
			id: newId('exercise'),
			archived: false,
			favourite: false,
		};
		this.exercises.set(exercise.id, exercise);
		return exercise;
	}

	async updateExercise(id: string, values: ExerciseValues): Promise<Exercise> {
		this.validateExerciseValues(values);
		const name = values.name.trim();
		this.rejectDuplicateExerciseName(name, id);
		const existing = await this.getExercise(id);
		// Mirrors the real backend's guard: the frontend's own metric-profile lock only looks at
		// workout history, so an exercise referenced solely by a routine's set templates would
		// otherwise still be editable here.
		if (existing.metricProfile !== values.metricProfile) {
			const routineReferenced = [...this.routineExercises.values()].some(
				(re) => re.exerciseId === id,
			);
			if (routineReferenced) {
				throw new Error(
					"This exercise is used in a routine — its metric profile can't change while a routine still references it",
				);
			}
		}
		const updated: Exercise = { ...existing, ...values, name };
		this.exercises.set(id, updated);
		return updated;
	}

	async setExerciseArchived(id: string, archived: boolean): Promise<Exercise> {
		const existing = await this.getExercise(id);
		const updated = { ...existing, archived };
		this.exercises.set(id, updated);
		return updated;
	}

	async deleteExercise(id: string): Promise<void> {
		const referenceCount =
			[...this.workoutExercises.values()].filter((we) => we.exerciseId === id).length +
			[...this.routineExercises.values()].filter((re) => re.exerciseId === id).length +
			[...this.exerciseGoals.values()].filter((g) => g.exerciseId === id).length;
		if (referenceCount > 0) {
			throw new Error(
				`Exercise ${id} is still referenced by ${referenceCount} record(s) — archive it instead`,
			);
		}
		this.exercises.delete(id);
	}

	async getWorkoutExercise(id: string): Promise<WorkoutExercise> {
		const workoutExercise = this.workoutExercises.get(id);
		if (!workoutExercise) throw new Error(`Unknown workout exercise: ${id}`);
		return workoutExercise;
	}

	async listWorkoutExercisesByWorkout(workoutId: string): Promise<WorkoutExercise[]> {
		return [...this.workoutExercises.values()]
			.filter((we) => we.workoutId === workoutId)
			.sort((a, b) => a.order - b.order);
	}

	async listWorkoutExercisesByExercise(exerciseId: string): Promise<WorkoutExercise[]> {
		return [...this.workoutExercises.values()].filter((we) => we.exerciseId === exerciseId);
	}

	async listSets(workoutExerciseId: string): Promise<SetEntry[]> {
		return [...this.sets.values()]
			.filter((s) => s.workoutExerciseId === workoutExerciseId)
			.sort((a, b) => a.order - b.order);
	}

	async saveSet(set: SetEntry): Promise<SetEntry> {
		const saved = { ...set };
		this.sets.set(saved.id, saved);
		return saved;
	}

	async completeSet(setId: string): Promise<SetEntry> {
		const existing = this.sets.get(setId);
		if (!existing) throw new Error(`Unknown set: ${setId}`);
		const completed: SetEntry = {
			...existing,
			status: 'completed',
			completedAt: new Date().toISOString(),
		};
		this.sets.set(setId, completed);
		return completed;
	}

	async addSet(workoutExerciseId: string): Promise<SetEntry> {
		const siblings = await this.listSets(workoutExerciseId);
		const previous = siblings[siblings.length - 1];
		const created: SetEntry = {
			id: newId('set'),
			workoutExerciseId,
			order: siblings.length + 1,
			status: 'planned',
			weightKg: previous?.weightKg,
			reps: previous?.reps,
			distanceKm: previous?.distanceKm,
			durationSec: previous?.durationSec,
		};
		this.sets.set(created.id, created);
		return created;
	}

	async logNewSet(
		workoutExerciseId: string,
		values: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'distanceKm' | 'durationSec'>>,
	): Promise<SetEntry> {
		const siblings = await this.listSets(workoutExerciseId);
		const created: SetEntry = {
			id: newId('set'),
			workoutExerciseId,
			order: siblings.length + 1,
			status: 'completed',
			completedAt: new Date().toISOString(),
			...values,
		};
		this.sets.set(created.id, created);
		return created;
	}

	async duplicateSet(setId: string): Promise<SetEntry> {
		const existing = this.sets.get(setId);
		if (!existing) throw new Error(`Unknown set: ${setId}`);
		const siblings = await this.listSets(existing.workoutExerciseId);
		const duplicated: SetEntry = {
			...existing,
			id: newId('set'),
			order: siblings.length + 1,
			status: 'planned',
			completedAt: undefined,
			isRecord: false,
			pendingSync: false,
		};
		this.sets.set(duplicated.id, duplicated);
		return duplicated;
	}

	async deleteSet(setId: string): Promise<void> {
		this.sets.delete(setId);
	}

	async updateSetNote(setId: string, note: string | undefined): Promise<SetEntry> {
		const existing = this.sets.get(setId);
		if (!existing) throw new Error(`Unknown set: ${setId}`);
		const updated = { ...existing, note };
		this.sets.set(setId, updated);
		return updated;
	}

	async updateTodayNote(
		workoutExerciseId: string,
		note: string | undefined,
	): Promise<WorkoutExercise> {
		const existing = this.workoutExercises.get(workoutExerciseId);
		if (!existing) throw new Error(`Unknown workout exercise: ${workoutExerciseId}`);
		const updated = { ...existing, todayNote: note };
		this.workoutExercises.set(workoutExerciseId, updated);
		return updated;
	}

	private setRestTimer(next: RestTimerState) {
		this.restTimer = next;
		for (const listener of this.restTimerListeners) listener(next);
	}

	private clearScheduledElapse() {
		if (this.restTimerTimeout !== undefined) {
			clearTimeout(this.restTimerTimeout);
			this.restTimerTimeout = undefined;
		}
	}

	private scheduleElapse(remainingMs: number) {
		this.clearScheduledElapse();
		this.restTimerTimeout = setTimeout(() => {
			if (this.restTimer.status === 'running') {
				this.setRestTimer({ ...this.restTimer, status: 'elapsed' });
			}
		}, remainingMs);
	}

	async startRestTimer(
		totalMs: number,
		options?: {
			forSetId?: string;
			nextSetLabel?: string;
			ownerDevice?: RestTimerState['ownerDevice'];
		},
	): Promise<RestTimerState> {
		// "New rest replaces a running one" off: a request that arrives while one is already
		// counting down is dropped rather than restarting the clock.
		if (this.restTimer.status === 'running' && !this.settings.restReplacesRunning) {
			return this.restTimer;
		}
		const targetInstant = new Date(Date.now() + totalMs).toISOString();
		this.scheduleElapse(totalMs);
		this.setRestTimer({
			status: 'running',
			targetInstant,
			totalMs,
			ownerDevice: options?.ownerDevice ?? 'phone',
			forSetId: options?.forSetId,
			nextSetLabel: options?.nextSetLabel,
		});
		return this.restTimer;
	}

	async pauseRestTimer(): Promise<RestTimerState> {
		if (this.restTimer.status !== 'running' || !this.restTimer.targetInstant) return this.restTimer;
		this.clearScheduledElapse();
		const remainingMsAtPause = new Date(this.restTimer.targetInstant).getTime() - Date.now();
		this.setRestTimer({ ...this.restTimer, status: 'paused', remainingMsAtPause });
		return this.restTimer;
	}

	async resumeRestTimer(): Promise<RestTimerState> {
		if (this.restTimer.status !== 'paused' || this.restTimer.remainingMsAtPause === undefined)
			return this.restTimer;
		const remainingMs = this.restTimer.remainingMsAtPause;
		const targetInstant = new Date(Date.now() + remainingMs).toISOString();
		this.scheduleElapse(remainingMs);
		this.setRestTimer({
			...this.restTimer,
			status: 'running',
			targetInstant,
			remainingMsAtPause: undefined,
		});
		return this.restTimer;
	}

	async extendRestTimer(deltaMs: number): Promise<RestTimerState> {
		if (this.restTimer.status === 'running' && this.restTimer.targetInstant) {
			const targetInstant = new Date(
				new Date(this.restTimer.targetInstant).getTime() + deltaMs,
			).toISOString();
			this.scheduleElapse(new Date(targetInstant).getTime() - Date.now());
			this.setRestTimer({
				...this.restTimer,
				targetInstant,
				totalMs: (this.restTimer.totalMs ?? 0) + deltaMs,
			});
		} else if (
			this.restTimer.status === 'paused' &&
			this.restTimer.remainingMsAtPause !== undefined
		) {
			this.setRestTimer({
				...this.restTimer,
				remainingMsAtPause: this.restTimer.remainingMsAtPause + deltaMs,
			});
		}
		return this.restTimer;
	}

	async dismissRestTimer(): Promise<RestTimerState> {
		this.clearScheduledElapse();
		this.setRestTimer({ status: 'inactive' });
		return this.restTimer;
	}

	async getRestTimerState(): Promise<RestTimerState> {
		return this.restTimer;
	}

	subscribeRestTimer(onChange: (state: RestTimerState) => void): Unsubscribe {
		this.restTimerListeners.add(onChange);
		return () => this.restTimerListeners.delete(onChange);
	}

	async listBarbellConfigs(): Promise<BarbellConfig[]> {
		return [...this.barbells.values()];
	}

	async calculatePlates(
		targetWeight: number,
		barbell: BarbellConfig,
	): Promise<PlateCalculationResult> {
		return calculatePlatesPure(targetWeight, barbell);
	}

	private clearOtherDefaults(exceptId: string) {
		for (const [id, config] of this.barbells) {
			if (id !== exceptId && config.isDefault)
				this.barbells.set(id, { ...config, isDefault: false });
		}
	}

	async addBarbellConfig(config: Omit<BarbellConfig, 'id'>): Promise<BarbellConfig> {
		const created: BarbellConfig = { ...config, id: newId('barbell') };
		this.barbells.set(created.id, created);
		if (created.isDefault) this.clearOtherDefaults(created.id);
		return created;
	}

	async updateBarbellConfig(config: BarbellConfig): Promise<BarbellConfig> {
		if (!this.barbells.has(config.id)) throw new Error(`Unknown barbell config: ${config.id}`);
		this.barbells.set(config.id, config);
		if (config.isDefault) this.clearOtherDefaults(config.id);
		return config;
	}

	async deleteBarbellConfig(id: string): Promise<void> {
		// Never allow the list to reach zero — PlateCalculatorSheet has no empty-state to fall
		// back to, and every set editor's Plates chip assumes at least one config exists.
		if (this.barbells.size <= 1) return;
		this.barbells.delete(id);
	}

	async getSettings(): Promise<Settings> {
		return { ...this.settings };
	}

	async updateSettings(patch: Partial<Settings>): Promise<Settings> {
		this.settings = { ...this.settings, ...patch };
		return this.settings;
	}

	/** The workoutExercise ids that belong to a completed workout — exactly what
	 *  `deleteAllHistory` removes, and what `getHistorySummary`'s counts must agree with. */
	private completedWorkoutExerciseIds(): Set<string> {
		const completedWorkoutIds = new Set(
			[...this.workouts.values()].filter((w) => w.status === 'completed').map((w) => w.id),
		);
		return new Set(
			[...this.workoutExercises.values()]
				.filter((we) => completedWorkoutIds.has(we.workoutId))
				.map((we) => we.id),
		);
	}

	async getHistorySummary(): Promise<{ workoutCount: number; setCount: number }> {
		const completedWorkouts = [...this.workouts.values()].filter((w) => w.status === 'completed');
		const workoutExerciseIds = this.completedWorkoutExerciseIds();
		const setCount = [...this.sets.values()].filter((s) =>
			workoutExerciseIds.has(s.workoutExerciseId),
		).length;
		return { workoutCount: completedWorkouts.length, setCount };
	}

	async deleteAllHistory(): Promise<void> {
		// Clears logged sets, completed workouts, and the workoutExercise occurrences that
		// belonged to them — the in-progress routine scaffold Today and Logging navigate
		// against survives, since none of its workouts (or their sets) are ever touched here.
		const workoutExerciseIds = this.completedWorkoutExerciseIds();
		for (const id of workoutExerciseIds) {
			this.workoutExercises.delete(id);
		}
		for (const [id, set] of this.sets) {
			if (workoutExerciseIds.has(set.workoutExerciseId)) this.sets.delete(id);
		}
		for (const [id, workout] of this.workouts) {
			if (workout.status === 'completed') this.workouts.delete(id);
		}
		this.clearScheduledElapse();
		this.setRestTimer({ status: 'inactive' });
	}

	async getWorkout(id: string): Promise<Workout> {
		const workout = this.workouts.get(id);
		if (!workout) throw new Error(`Unknown workout: ${id}`);
		return workout;
	}

	async listWorkoutsInRange(startDate: string, endDate: string): Promise<Workout[]> {
		return [...this.workouts.values()]
			.filter((w) => w.date >= startDate && w.date <= endDate)
			.sort((a, b) => a.date.localeCompare(b.date));
	}

	async createWorkout(localDate: string, title: string): Promise<Workout> {
		const created: Workout = {
			id: newId('workout'),
			date: localDate,
			title,
			status: 'in-progress',
			source: 'manual',
		};
		this.workouts.set(created.id, created);
		return created;
	}

	async addWorkoutExercise(workoutId: string, exerciseId: string): Promise<WorkoutExercise> {
		const workout = await this.getWorkout(workoutId);
		const siblings = [...this.workoutExercises.values()].filter((we) => we.workoutId === workoutId);
		const nextOrder = siblings.reduce((max, we) => Math.max(max, we.order), 0) + 1;
		const created: WorkoutExercise = {
			id: newId('we'),
			exerciseId,
			workoutId,
			workoutLabel: `${workout.title} · ${nextOrder} of ${siblings.length + 1}`,
			order: nextOrder,
		};
		this.workoutExercises.set(created.id, created);
		return created;
	}

	async deleteWorkoutExercise(id: string): Promise<void> {
		this.workoutExercises.delete(id);
	}

	async duplicateWorkout(workoutId: string, targetDate: string): Promise<Workout> {
		const source = await this.getWorkout(workoutId);
		const sourceWorkoutExercises = [...this.workoutExercises.values()]
			.filter((we) => we.workoutId === workoutId)
			.sort((a, b) => a.order - b.order);

		const duplicated: Workout = {
			id: newId('workout'),
			date: targetDate,
			title: source.title,
			status: 'in-progress',
			source: 'manual',
		};
		this.workouts.set(duplicated.id, duplicated);

		for (const sourceWe of sourceWorkoutExercises) {
			const newWe: WorkoutExercise = {
				...sourceWe,
				id: newId('we'),
				workoutId: duplicated.id,
				// Day-specific to the source session — a fresh copy starts without them.
				todayNote: undefined,
				offlineSince: undefined,
				lastTimeReference: undefined,
			};
			this.workoutExercises.set(newWe.id, newWe);

			const sourceSets = await this.listSets(sourceWe.id);
			for (const sourceSet of sourceSets) {
				const newSet: SetEntry = {
					...sourceSet,
					id: newId('set'),
					workoutExerciseId: newWe.id,
					status: 'planned',
					completedAt: undefined,
					isRecord: false,
					pendingSync: false,
				};
				this.sets.set(newSet.id, newSet);
			}
		}

		return duplicated;
	}

	async updateWorkoutNote(workoutId: string, note: string | undefined): Promise<Workout> {
		const existing = await this.getWorkout(workoutId);
		const updated = { ...existing, note };
		this.workouts.set(workoutId, updated);
		return updated;
	}

	async getRoutine(id: string): Promise<Routine> {
		const routine = this.routines.get(id);
		if (!routine) throw new Error(`Unknown routine: ${id}`);
		return routine;
	}

	async listRoutines(): Promise<Routine[]> {
		return [...this.routines.values()].sort((a, b) => a.sortOrder - b.sortOrder);
	}

	async createRoutine(name: string): Promise<Routine> {
		const siblings = [...this.routines.values()];
		const nextOrder = siblings.reduce((max, r) => Math.max(max, r.sortOrder), 0) + 1;
		const created: Routine = { id: newId('routine'), name, sortOrder: nextOrder, archived: false };
		this.routines.set(created.id, created);
		return created;
	}

	async renameRoutine(id: string, name: string): Promise<Routine> {
		const existing = await this.getRoutine(id);
		const updated = { ...existing, name };
		this.routines.set(id, updated);
		return updated;
	}

	async updateRoutineNote(id: string, note: string | undefined): Promise<Routine> {
		const existing = await this.getRoutine(id);
		const updated = { ...existing, note };
		this.routines.set(id, updated);
		return updated;
	}

	async setRoutineArchived(id: string, archived: boolean): Promise<Routine> {
		const existing = await this.getRoutine(id);
		const updated = { ...existing, archived };
		this.routines.set(id, updated);
		return updated;
	}

	async deleteRoutine(id: string): Promise<void> {
		this.routines.delete(id);
		for (const section of [...this.routineSections.values()].filter((s) => s.routineId === id)) {
			await this.deleteRoutineSection(section.id);
		}
	}

	async getRoutineSection(id: string): Promise<RoutineSection> {
		const section = this.routineSections.get(id);
		if (!section) throw new Error(`Unknown routine section: ${id}`);
		return section;
	}

	async listRoutineSections(routineId: string): Promise<RoutineSection[]> {
		return [...this.routineSections.values()]
			.filter((s) => s.routineId === routineId)
			.sort((a, b) => a.sortOrder - b.sortOrder);
	}

	async addRoutineSection(routineId: string, name: string | undefined): Promise<RoutineSection> {
		const siblings = await this.listRoutineSections(routineId);
		const nextOrder = siblings.reduce((max, s) => Math.max(max, s.sortOrder), 0) + 1;
		const created: RoutineSection = {
			id: newId('routine-section'),
			routineId,
			name,
			sortOrder: nextOrder,
		};
		this.routineSections.set(created.id, created);
		return created;
	}

	async renameRoutineSection(id: string, name: string | undefined): Promise<RoutineSection> {
		const existing = await this.getRoutineSection(id);
		const updated = { ...existing, name };
		this.routineSections.set(id, updated);
		return updated;
	}

	async reorderRoutineSections(routineId: string, orderedIds: string[]): Promise<RoutineSection[]> {
		const existing = await this.listRoutineSections(routineId);
		const remaining = new Set(existing.map((s) => s.id));
		for (const id of orderedIds) {
			if (!remaining.delete(id)) {
				throw new Error(
					`Routine section ${id} does not belong to routine ${routineId}, or is listed more than once`,
				);
			}
		}
		if (remaining.size > 0) {
			throw new Error(
				`Reorder for routine ${routineId} omits ${remaining.size} existing section(s)`,
			);
		}
		orderedIds.forEach((id, index) => {
			const section = this.routineSections.get(id);
			if (section) this.routineSections.set(id, { ...section, sortOrder: index + 1 });
		});
		return this.listRoutineSections(routineId);
	}

	async deleteRoutineSection(id: string): Promise<void> {
		this.routineSections.delete(id);
		for (const exercise of [...this.routineExercises.values()].filter(
			(e) => e.routineSectionId === id,
		)) {
			await this.deleteRoutineExercise(exercise.id);
		}
		for (const superset of [...this.routineSupersets.values()].filter(
			(s) => s.routineSectionId === id,
		)) {
			this.routineSupersets.delete(superset.id);
		}
	}

	async getRoutineSuperset(id: string): Promise<RoutineSuperset> {
		const superset = this.routineSupersets.get(id);
		if (!superset) throw new Error(`Unknown routine superset: ${id}`);
		return superset;
	}

	async createRoutineSuperset(
		routineSectionId: string,
		colour: string | undefined,
		autoAdvance: boolean,
		restMs: number | undefined,
	): Promise<RoutineSuperset> {
		const created: RoutineSuperset = {
			id: newId('routine-superset'),
			routineSectionId,
			colour,
			autoAdvance,
			restMs,
		};
		this.routineSupersets.set(created.id, created);
		return created;
	}

	async deleteRoutineSuperset(id: string): Promise<void> {
		this.routineSupersets.delete(id);
		for (const exercise of [...this.routineExercises.values()].filter(
			(e) => e.routineSupersetId === id,
		)) {
			this.routineExercises.set(exercise.id, {
				...exercise,
				routineSupersetId: undefined,
				supersetPosition: undefined,
			});
		}
	}

	async getRoutineExercise(id: string): Promise<RoutineExercise> {
		const exercise = this.routineExercises.get(id);
		if (!exercise) throw new Error(`Unknown routine exercise: ${id}`);
		return exercise;
	}

	async listRoutineExercises(routineSectionId: string): Promise<RoutineExercise[]> {
		return [...this.routineExercises.values()]
			.filter((e) => e.routineSectionId === routineSectionId)
			.sort((a, b) => a.order - b.order);
	}

	async addRoutineExercise(routineSectionId: string, exerciseId: string): Promise<RoutineExercise> {
		const siblings = await this.listRoutineExercises(routineSectionId);
		const nextOrder = siblings.reduce((max, e) => Math.max(max, e.order), 0) + 1;
		const created: RoutineExercise = {
			id: newId('routine-exercise'),
			routineSectionId,
			exerciseId,
			order: nextOrder,
		};
		this.routineExercises.set(created.id, created);
		return created;
	}

	async reorderRoutineExercises(
		routineSectionId: string,
		orderedIds: string[],
	): Promise<RoutineExercise[]> {
		const existing = await this.listRoutineExercises(routineSectionId);
		const remaining = new Set(existing.map((e) => e.id));
		for (const id of orderedIds) {
			if (!remaining.delete(id)) {
				throw new Error(
					`Routine exercise ${id} does not belong to section ${routineSectionId}, or is listed more than once`,
				);
			}
		}
		if (remaining.size > 0) {
			throw new Error(
				`Reorder for section ${routineSectionId} omits ${remaining.size} existing exercise(s)`,
			);
		}
		orderedIds.forEach((id, index) => {
			const exercise = this.routineExercises.get(id);
			if (exercise) this.routineExercises.set(id, { ...exercise, order: index + 1 });
		});
		return this.listRoutineExercises(routineSectionId);
	}

	async setRoutineExerciseSuperset(
		id: string,
		assignment: { routineSupersetId: string; supersetPosition: number } | undefined,
	): Promise<RoutineExercise> {
		const existing = await this.getRoutineExercise(id);
		if (assignment) {
			const superset = await this.getRoutineSuperset(assignment.routineSupersetId);
			if (superset.routineSectionId !== existing.routineSectionId) {
				throw new Error(
					`Routine superset ${assignment.routineSupersetId} belongs to a different section than routine exercise ${id}`,
				);
			}
		}
		const updated = {
			...existing,
			routineSupersetId: assignment?.routineSupersetId,
			supersetPosition: assignment?.supersetPosition,
		};
		this.routineExercises.set(id, updated);
		return updated;
	}

	async updateRoutineExerciseNote(id: string, note: string | undefined): Promise<RoutineExercise> {
		const existing = await this.getRoutineExercise(id);
		const updated = { ...existing, note };
		this.routineExercises.set(id, updated);
		return updated;
	}

	async deleteRoutineExercise(id: string): Promise<void> {
		this.routineExercises.delete(id);
		for (const template of [...this.setTemplates.values()].filter(
			(t) => t.routineExerciseId === id,
		)) {
			this.setTemplates.delete(template.id);
		}
	}

	async listSetTemplates(routineExerciseId: string): Promise<SetTemplate[]> {
		return [...this.setTemplates.values()]
			.filter((t) => t.routineExerciseId === routineExerciseId)
			.sort((a, b) => a.order - b.order);
	}

	async addSetTemplate(routineExerciseId: string, values: SetTemplateValues): Promise<SetTemplate> {
		if (values.populationRule !== undefined) {
			if (values.populationRule !== SEED_LAST_PERFORMANCE) {
				throw new Error(`Unknown set-template population rule: ${values.populationRule}`);
			}
			const hasExplicitValue =
				values.weightKg !== undefined ||
				values.reps !== undefined ||
				values.distanceKm !== undefined ||
				values.durationSec !== undefined;
			if (hasExplicitValue) {
				throw new Error(
					"A set template can't combine a population rule with explicit target values",
				);
			}
		}
		const siblings = await this.listSetTemplates(routineExerciseId);
		const nextOrder = siblings.reduce((max, t) => Math.max(max, t.order), 0) + 1;
		const created: SetTemplate = {
			id: newId('set-template'),
			routineExerciseId,
			order: nextOrder,
			...values,
		};
		this.setTemplates.set(created.id, created);
		return created;
	}

	async deleteSetTemplate(id: string): Promise<void> {
		this.setTemplates.delete(id);
	}

	/** The most recent completed set for this exercise, across every workout — mirrors the Rust Coordinator's `sets::repo::most_recent_completed`, preferring the owning workout's date over completion order. `null` when there's no history yet, matching the real backend's `Option<SetValues>` (which serializes to `null` over Tauri's IPC, not `undefined`). */
	async mostRecentCompletedSet(
		exerciseId: string,
		onOrBeforeDate: string,
	): Promise<Pick<SetEntry, 'weightKg' | 'reps' | 'distanceKm' | 'durationSec'> | null> {
		let best: SetEntry | undefined;
		let bestDate: string | undefined;
		for (const we of this.workoutExercises.values()) {
			if (we.exerciseId !== exerciseId) continue;
			const owningWorkout = this.workouts.get(we.workoutId);
			// A backdated materialization must not seed from performance that, relative to the
			// workout being created, hasn't happened yet.
			if (!owningWorkout || owningWorkout.date > onOrBeforeDate) continue;
			for (const set of this.sets.values()) {
				if (set.workoutExerciseId !== we.id || set.status !== 'completed') continue;
				// The nearer training day wins even if it was entered/completed later than a
				// farther one — a same-day tie falls back to completion order.
				const isBetter =
					!best ||
					owningWorkout.date > (bestDate ?? '') ||
					(owningWorkout.date === bestDate && (set.completedAt ?? '') > (best.completedAt ?? ''));
				if (isBetter) {
					best = set;
					bestDate = owningWorkout.date;
				}
			}
		}
		if (!best) return null;
		return {
			weightKg: best.weightKg,
			reps: best.reps,
			distanceKm: best.distanceKm,
			durationSec: best.durationSec,
		};
	}

	async materializeRoutineSection(
		routineSectionId: string,
		targetDate: string,
		selectedRoutineExerciseIds: string[],
	): Promise<Workout> {
		const section = await this.getRoutineSection(routineSectionId);
		const routine = await this.getRoutine(section.routineId);
		// Ordered by the caller's selectedRoutineExerciseIds — the reviewed order from the materialization review screen — not the routine's own order.
		const byId = new Map(
			(await this.listRoutineExercises(routineSectionId)).map((re) => [re.id, re]),
		);
		const selected = selectedRoutineExerciseIds
			.map((id) => byId.get(id))
			.filter((re): re is RoutineExercise => re != null);

		const workout: Workout = {
			id: newId('workout'),
			date: targetDate,
			title: routine.name,
			status: 'in-progress',
			source: 'manual',
			sourceRoutineId: routine.id,
			sourceRoutineName: routine.name,
		};
		this.workouts.set(workout.id, workout);

		const supersetIdMap = new Map<string, string>();
		// Positions are recomputed densely among only the *selected* members of each superset, in reviewed order — carrying over a member's original supersetPosition verbatim would leave gaps or an out-of-range position once an earlier member is deselected.
		const supersetPositionCounters = new Map<string, number>();
		// A group's final size is only known once every selected member has been counted, so the
		// materialized workout exercises are backfilled with it in a second pass below, mirroring
		// how the real backend's `superset_size` is a live COUNT rather than a stored value.
		const materializedExerciseIds: string[] = [];

		for (const [index, re] of selected.entries()) {
			const newOrder = index + 1;
			let newSupersetId: string | undefined;
			let newSupersetPosition: number | undefined;
			if (re.routineSupersetId) {
				newSupersetId = supersetIdMap.get(re.routineSupersetId);
				if (!newSupersetId) {
					newSupersetId = newId('superset');
					supersetIdMap.set(re.routineSupersetId, newSupersetId);
				}
				const position = (supersetPositionCounters.get(re.routineSupersetId) ?? 0) + 1;
				supersetPositionCounters.set(re.routineSupersetId, position);
				newSupersetPosition = position;
			}

			const newWorkoutExercise: WorkoutExercise = {
				id: newId('we'),
				exerciseId: re.exerciseId,
				workoutId: workout.id,
				workoutLabel: `${workout.title} · ${newOrder} of ${selected.length}`,
				order: newOrder,
				todayNote: re.note,
				supersetGroupId: newSupersetId,
				supersetPosition: newSupersetPosition,
			};
			this.workoutExercises.set(newWorkoutExercise.id, newWorkoutExercise);
			materializedExerciseIds.push(newWorkoutExercise.id);

			const templates = await this.listSetTemplates(re.id);
			for (const template of templates) {
				const values =
					template.populationRule === SEED_LAST_PERFORMANCE
						? ((await this.mostRecentCompletedSet(re.exerciseId, targetDate)) ?? {})
						: {
								weightKg: template.weightKg,
								reps: template.reps,
								distanceKm: template.distanceKm,
								durationSec: template.durationSec,
							};
				const set: SetEntry = {
					id: newId('set'),
					workoutExerciseId: newWorkoutExercise.id,
					order: template.order,
					status: 'planned',
					setLabel: template.setLabel,
					sourceTemplateId: template.id,
					...values,
				};
				this.sets.set(set.id, set);
			}
		}

		for (const id of materializedExerciseIds) {
			const we = this.workoutExercises.get(id);
			if (we?.supersetGroupId) {
				const size = [...this.workoutExercises.values()].filter(
					(other) => other.supersetGroupId === we.supersetGroupId,
				).length;
				this.workoutExercises.set(id, { ...we, supersetSize: size });
			}
		}

		return workout;
	}

	async getCategory(id: string): Promise<Category> {
		const category = this.categories.get(id);
		if (!category) throw new Error(`Unknown category: ${id}`);
		return category;
	}

	async listCategories(): Promise<Category[]> {
		return [...this.categories.values()].sort((a, b) => a.sortOrder - b.sortOrder);
	}

	private rejectDuplicateCategoryName(name: string, excludingId?: string) {
		const collides = [...this.categories.values()].some(
			(c) => c.id !== excludingId && c.name.toLowerCase() === name.toLowerCase(),
		);
		if (collides) throw new Error(`A category named "${name}" already exists`);
	}

	async createCategory(
		id: string,
		name: string,
		colourBackground: string,
		colourText: string,
		colourDot: string,
	): Promise<Category> {
		if (this.categories.has(id)) {
			throw new Error(`A category with id ${id} already exists`);
		}
		this.rejectDuplicateCategoryName(name);
		const existing = [...this.categories.values()];
		const nextOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1;
		const created: Category = {
			id,
			name,
			colourBackground,
			colourText,
			colourDot,
			sortOrder: nextOrder,
			archived: false,
		};
		this.categories.set(id, created);
		return created;
	}

	async renameCategory(id: string, name: string): Promise<Category> {
		const existing = await this.getCategory(id);
		this.rejectDuplicateCategoryName(name, id);
		const updated = { ...existing, name };
		this.categories.set(id, updated);
		return updated;
	}

	async recolourCategory(
		id: string,
		colourBackground: string,
		colourText: string,
		colourDot: string,
	): Promise<Category> {
		const existing = await this.getCategory(id);
		const updated = { ...existing, colourBackground, colourText, colourDot };
		this.categories.set(id, updated);
		return updated;
	}

	async setCategoryArchived(id: string, archived: boolean): Promise<Category> {
		const existing = await this.getCategory(id);
		if (archived) {
			const inUse = [...this.exercises.values()].some((e) => e.category === id);
			if (inUse) {
				throw new Error(`Category ${id} still has exercises — reassign them first`);
			}
		}
		const updated = { ...existing, archived };
		this.categories.set(id, updated);
		return updated;
	}

	async deleteCategory(id: string): Promise<void> {
		const inUse = [...this.exercises.values()].some((e) => e.category === id);
		if (inUse) {
			throw new Error(`Category ${id} still has exercises — reassign them first`);
		}
		this.categories.delete(id);
	}

	async reorderCategories(orderedIds: string[]): Promise<Category[]> {
		const remaining = new Set(this.categories.keys());
		for (const id of orderedIds) {
			if (!remaining.delete(id)) {
				throw new Error(`Category ${id} does not exist, or is listed more than once`);
			}
		}
		if (remaining.size > 0) {
			throw new Error(`Reorder omits ${remaining.size} existing category(ies)`);
		}
		orderedIds.forEach((id, index) => {
			const category = this.categories.get(id);
			if (category) this.categories.set(id, { ...category, sortOrder: index + 1 });
		});
		return this.listCategories();
	}

	async getExerciseGoal(id: string): Promise<ExerciseGoal> {
		const goal = this.exerciseGoals.get(id);
		if (!goal) throw new Error(`Unknown exercise goal: ${id}`);
		return goal;
	}

	async listExerciseGoals(exerciseId: string): Promise<ExerciseGoal[]> {
		return [...this.exerciseGoals.values()].filter((g) => g.exerciseId === exerciseId);
	}

	async createExerciseGoal(values: ExerciseGoalValues): Promise<ExerciseGoal> {
		if (!this.exercises.has(values.exerciseId)) {
			throw new Error(`Unknown exercise: ${values.exerciseId}`);
		}
		const goal: ExerciseGoal = { ...values, id: newId('goal'), archived: false };
		this.exerciseGoals.set(goal.id, goal);
		return goal;
	}

	// Deliberately never applies values.exerciseId — mirrors the real backend's goals::repo::update,
	// which must not let a caller silently reassign a goal to a different exercise.
	async updateExerciseGoal(id: string, values: ExerciseGoalValues): Promise<ExerciseGoal> {
		const existing = await this.getExerciseGoal(id);
		const { exerciseId: _exerciseId, ...editable } = values;
		const updated: ExerciseGoal = { ...existing, ...editable };
		this.exerciseGoals.set(id, updated);
		return updated;
	}

	async setExerciseGoalAchieved(id: string, achieved: boolean): Promise<ExerciseGoal> {
		const existing = await this.getExerciseGoal(id);
		const updated: ExerciseGoal = {
			...existing,
			achievedAt: achieved ? new Date().toISOString() : undefined,
		};
		this.exerciseGoals.set(id, updated);
		return updated;
	}

	async setExerciseGoalArchived(id: string, archived: boolean): Promise<ExerciseGoal> {
		const existing = await this.getExerciseGoal(id);
		const updated = { ...existing, archived };
		this.exerciseGoals.set(id, updated);
		return updated;
	}

	async deleteExerciseGoal(id: string): Promise<void> {
		this.exerciseGoals.delete(id);
	}

	async getMeasurementDefinition(id: string): Promise<MeasurementDefinition> {
		const definition = this.measurementDefinitions.get(id);
		if (!definition) throw new Error(`Unknown measurement definition: ${id}`);
		return definition;
	}

	async listMeasurementDefinitions(): Promise<MeasurementDefinition[]> {
		return [...this.measurementDefinitions.values()].sort((a, b) => a.sortOrder - b.sortOrder);
	}

	async createMeasurementDefinition(name: string, unit: string): Promise<MeasurementDefinition> {
		const existing = await this.listMeasurementDefinitions();
		const nextOrder = existing.length > 0 ? Math.max(...existing.map((d) => d.sortOrder)) + 1 : 0;
		const definition: MeasurementDefinition = {
			id: newId('measurement-def'),
			name,
			unit,
			sortOrder: nextOrder,
			archived: false,
		};
		this.measurementDefinitions.set(definition.id, definition);
		return definition;
	}

	async updateMeasurementDefinition(
		id: string,
		name: string,
		unit: string,
		goal?: number,
	): Promise<MeasurementDefinition> {
		const existing = await this.getMeasurementDefinition(id);
		if (existing.unit !== unit) {
			if (existing.goal != null) {
				throw new Error(`Measurement definition ${id} has a goal set and can't change unit`);
			}
			const hasRecords = [...this.measurementRecords.values()].some(
				(record) => record.definitionId === id,
			);
			if (hasRecords) {
				throw new Error(`Measurement definition ${id} has recorded values and can't change unit`);
			}
		}
		const updated = { ...existing, name, unit, goal };
		this.measurementDefinitions.set(id, updated);
		return updated;
	}

	async setMeasurementDefinitionArchived(
		id: string,
		archived: boolean,
	): Promise<MeasurementDefinition> {
		const existing = await this.getMeasurementDefinition(id);
		const updated = { ...existing, archived };
		this.measurementDefinitions.set(id, updated);
		return updated;
	}

	async reorderMeasurementDefinitions(orderedIds: string[]): Promise<MeasurementDefinition[]> {
		const remaining = new Set(this.measurementDefinitions.keys());
		for (const id of orderedIds) {
			if (!remaining.delete(id)) {
				throw new Error(`Measurement definition ${id} does not exist, or is listed more than once`);
			}
		}
		if (remaining.size > 0) {
			throw new Error(`Reorder omits ${remaining.size} existing definition(s)`);
		}
		orderedIds.forEach((id, index) => {
			const definition = this.measurementDefinitions.get(id);
			if (definition) this.measurementDefinitions.set(id, { ...definition, sortOrder: index + 1 });
		});
		return this.listMeasurementDefinitions();
	}

	async deleteMeasurementDefinition(id: string): Promise<void> {
		this.measurementDefinitions.delete(id);
		for (const record of [...this.measurementRecords.values()].filter(
			(r) => r.definitionId === id,
		)) {
			this.measurementRecords.delete(record.id);
		}
	}

	async getMeasurementRecord(id: string): Promise<MeasurementRecord> {
		const record = this.measurementRecords.get(id);
		if (!record) throw new Error(`Unknown measurement record: ${id}`);
		return record;
	}

	async listMeasurementRecords(definitionId: string): Promise<MeasurementRecord[]> {
		return [...this.measurementRecords.values()]
			.filter((r) => r.definitionId === definitionId)
			.sort(
				(a, b) =>
					a.date.localeCompare(b.date) ||
					// A textual comparison of RFC 3339 instants only sorts correctly when every offset is
					// identical (e.g. all "Z") — two valid but differently-offset timestamps for the same
					// actual instant can compare unequal, unlike the real repository's recorded_at_ms.
					new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
			);
	}

	async createMeasurementRecord(
		definitionId: string,
		date: string,
		value: number,
		note: string | undefined,
		recordedAt?: string,
	): Promise<MeasurementRecord> {
		if (!this.measurementDefinitions.has(definitionId)) {
			throw new Error(`Unknown measurement definition: ${definitionId}`);
		}
		const record: MeasurementRecord = {
			id: newId('measurement-record'),
			definitionId,
			date,
			recordedAt: validateRecordedAt(recordedAt) ?? new Date().toISOString(),
			value,
			note,
		};
		this.measurementRecords.set(record.id, record);
		return record;
	}

	async updateMeasurementRecord(
		id: string,
		date: string,
		value: number,
		note: string | undefined,
		recordedAt?: string,
	): Promise<MeasurementRecord> {
		const existing = await this.getMeasurementRecord(id);
		const updated = {
			...existing,
			date,
			value,
			note,
			recordedAt: validateRecordedAt(recordedAt) ?? existing.recordedAt,
		};
		this.measurementRecords.set(id, updated);
		return updated;
	}

	async deleteMeasurementRecord(id: string): Promise<void> {
		this.measurementRecords.delete(id);
	}

	async listAnalysisSets(startDate: string, endDate: string): Promise<AnalysisSetEntry[]> {
		const entries: AnalysisSetEntry[] = [];
		for (const set of this.sets.values()) {
			if (set.status !== 'completed') continue;
			const workoutExercise = this.workoutExercises.get(set.workoutExerciseId);
			if (!workoutExercise) continue;
			const workout = this.workouts.get(workoutExercise.workoutId);
			if (!workout || workout.date < startDate || workout.date > endDate) continue;
			const exercise = this.exercises.get(workoutExercise.exerciseId);
			if (!exercise) continue;
			const category = this.categories.get(exercise.category);
			entries.push({
				setId: set.id,
				workoutId: workout.id,
				exerciseId: exercise.id,
				exerciseName: exercise.name,
				categoryId: exercise.category,
				categoryName: category?.name ?? exercise.category,
				metricProfile: exercise.metricProfile,
				date: workout.date,
				setOrder: set.order,
				weightKg: set.weightKg,
				reps: set.reps,
				distanceKm: set.distanceKm,
				durationSec: set.durationSec,
			});
		}
		return entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
	}
}

export const mockRepository = new MockLoggingRepository();
