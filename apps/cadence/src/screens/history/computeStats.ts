// P-44's Stats tab aggregates — period-scoped, completed sets only by default (SPEC.md 8.7:
// "every aggregate defines whether it includes incomplete/planned sets")
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { estimateOneRepMax } from './oneRepMax';
import type { DatedSet } from './loadExerciseHistory';

export interface ExerciseStats {
	setCount: number;
	repCount: number;
	volumeKg: number;
	maxWeightKg?: number;
	bestEstimatedOneRm?: number;
	totalDistanceKm?: number;
}

export function computeStats(
	datedSets: DatedSet[],
	range?: { startDate?: string; endDate?: string },
): ExerciseStats {
	const completed = datedSets
		.filter(({ set, date }) => {
			if (set.status !== 'completed') return false;
			if (range?.startDate && date < range.startDate) return false;
			if (range?.endDate && date > range.endDate) return false;
			return true;
		})
		.map(({ set }) => set);

	const weightReps = completed.filter((s) => s.weightKg !== undefined && s.reps !== undefined);
	const distanceSets = completed.filter((s) => s.distanceKm !== undefined);

	return {
		setCount: completed.length,
		repCount: weightReps.reduce((sum, s) => sum + (s.reps ?? 0), 0),
		volumeKg: weightReps.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0),
		maxWeightKg: weightReps.length
			? Math.max(...weightReps.map((s) => s.weightKg ?? 0))
			: undefined,
		bestEstimatedOneRm: weightReps.length
			? Math.max(...weightReps.map((s) => estimateOneRepMax(s.weightKg ?? 0, s.reps ?? 0)))
			: undefined,
		totalDistanceKm: distanceSets.length
			? distanceSets.reduce((sum, s) => sum + (s.distanceKm ?? 0), 0)
			: undefined,
	};
}
