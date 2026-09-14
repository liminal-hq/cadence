// In-memory LoggingRepository over seedData.ts. Session-lifetime only —
// resets on reload. Swapping in a real backend later means constructing a
// Tauri `invoke()`-backed LoggingRepository and changing the one line in
// RepositoryProvider's default, not touching any call site.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { LoggingRepository, Unsubscribe } from './repository';
import type {
	BarbellConfig,
	Exercise,
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
	DEFAULT_SETTINGS,
	EXERCISES,
	SETS,
	WORKOUT_EXERCISES,
	WORKOUTS,
} from './seedData';

const EPSILON = 0.001;

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
}

export const mockRepository = new MockLoggingRepository();
