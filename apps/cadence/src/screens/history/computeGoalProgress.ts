// P-48 Goal progress — a pure function over logged history, mirroring computeRecords.ts's own "never a stored value" reasoning (SPEC.md 8.8: a goal and a record are different entities).
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { DatedSet } from './loadExerciseHistory';
import type { ExerciseGoal } from '../../domain/types';
import { todayLocalDate } from '../../domain/format';

export interface GoalProgressBest {
	weightKg?: number;
	reps?: number;
	distanceKm?: number;
	durationSec?: number;
	date: string;
}

export interface GoalProgress {
	/** True if any single completed set, on or after `startDate` and on or before `targetDate` (whichever are set), meets every target field the goal specifies. A goal with no target field set is never achieved. */
	achieved: boolean;
	/** `targetDate` has passed without the goal being achieved by then — a distinct state from `achieved`, not folded into it, so a late success doesn't retroactively erase that the deadline was missed. */
	overdue: boolean;
	/** The completed set that comes closest — ranked by weight for a weight-reps goal, distance for a distance-duration goal — so the UI has something comparable to show even before the goal is met. Considered across the full startDate-eligible window, not cut off at targetDate, so progress made after a missed deadline is still visible. */
	best?: GoalProgressBest;
}

function hasTarget(goal: ExerciseGoal): boolean {
	return (
		goal.targetWeightKg != null ||
		goal.targetReps != null ||
		goal.targetDistanceKm != null ||
		goal.targetDurationSec != null
	);
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

export function computeGoalProgress(
	goal: ExerciseGoal,
	datedSets: DatedSet[],
	today: string = todayLocalDate(),
): GoalProgress {
	const eligible = datedSets.filter(
		({ set, date }) => set.status === 'completed' && (!goal.startDate || date >= goal.startDate),
	);

	const withinDeadline = eligible.filter(({ date }) => !goal.targetDate || date <= goal.targetDate);

	const achieved = hasTarget(goal) && withinDeadline.some((entry) => meetsTarget(goal, entry));
	const overdue = Boolean(goal.targetDate && today > goal.targetDate && !achieved);

	const isWeightReps = goal.targetWeightKg != null || goal.targetReps != null;
	const rank = (entry: DatedSet) => {
		if (isWeightReps) {
			return goal.targetWeightKg != null ? (entry.set.weightKg ?? 0) : (entry.set.reps ?? 0);
		}
		return goal.targetDistanceKm != null
			? (entry.set.distanceKm ?? 0)
			: (entry.set.durationSec ?? 0);
	};
	const best = eligible.reduce<DatedSet | undefined>(
		(top, entry) => (!top || rank(entry) > rank(top) ? entry : top),
		undefined,
	);

	return {
		achieved,
		overdue,
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
