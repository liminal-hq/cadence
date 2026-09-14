// P-48 Goal progress — a pure function over logged history, mirroring computeRecords.ts's own "never a stored value" reasoning (SPEC.md 8.8: a goal and a record are different entities).
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { DatedSet } from './loadExerciseHistory';
import type { ExerciseGoal } from '../../domain/types';

export interface GoalProgressBest {
	weightKg?: number;
	reps?: number;
	distanceKm?: number;
	durationSec?: number;
	date: string;
}

export interface GoalProgress {
	/** True if any single completed set (since the goal's startDate, if set) meets every target field the goal specifies. */
	achieved: boolean;
	/** The completed set that comes closest — ranked by weight for a weight-reps goal, distance for a distance-duration goal — so the UI has something comparable to show even before the goal is met. */
	best?: GoalProgressBest;
}

function meetsTarget(goal: ExerciseGoal, entry: DatedSet): boolean {
	const { set } = entry;
	if (goal.targetWeightKg != null && (set.weightKg ?? 0) < goal.targetWeightKg) return false;
	if (goal.targetReps != null && (set.reps ?? 0) < goal.targetReps) return false;
	if (goal.targetDistanceKm != null && (set.distanceKm ?? 0) < goal.targetDistanceKm) return false;
	if (goal.targetDurationSec != null && (set.durationSec ?? 0) < goal.targetDurationSec) {
		return false;
	}
	return true;
}

export function computeGoalProgress(goal: ExerciseGoal, datedSets: DatedSet[]): GoalProgress {
	const eligible = datedSets.filter(
		({ set, date }) => set.status === 'completed' && (!goal.startDate || date >= goal.startDate),
	);

	const achieved = eligible.some((entry) => meetsTarget(goal, entry));

	const isWeightReps = goal.targetWeightKg != null || goal.targetReps != null;
	const rank = (entry: DatedSet) =>
		isWeightReps ? (entry.set.weightKg ?? 0) : (entry.set.distanceKm ?? 0);
	const best = eligible.reduce<DatedSet | undefined>(
		(top, entry) => (!top || rank(entry) > rank(top) ? entry : top),
		undefined,
	);

	return {
		achieved,
		best: best
			? {
					weightKg: best.set.weightKg,
					reps: best.set.reps,
					distanceKm: best.set.distanceKm,
					durationSec: best.set.durationSec,
					date: best.date,
				}
			: undefined,
	};
}
