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
	SetEntry,
	Settings,
	Workout,
	WorkoutExercise,
} from './types';
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

	async getExercise(id: string): Promise<Exercise> {
		const exercise = this.exercises.get(id);
		if (!exercise) throw new Error(`Unknown exercise: ${id}`);
		return exercise;
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

	async getHistorySummary(): Promise<{ workoutCount: number; setCount: number }> {
		const completedWorkouts = [...this.workouts.values()].filter((w) => w.status === 'completed');
		return { workoutCount: completedWorkouts.length, setCount: this.sets.size };
	}

	async deleteAllHistory(): Promise<void> {
		// Clears logged sets and completed workouts only — workoutExercises (the routine
		// scaffold Today and Logging navigate against) and in-progress workouts survive, since
		// they're not "history" yet.
		for (const [id, workout] of this.workouts) {
			if (workout.status === 'completed') this.workouts.delete(id);
		}
		this.sets.clear();
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
}

export const mockRepository = new MockLoggingRepository();
