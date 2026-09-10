// Compact per-exercise set summary for a workout history row (P-42) — the single most precise,
// non-trivial piece of logic this screen set needs, kept as a pure function so it's testable in
// isolation from any rendering concerns (italics/trophy icon are the caller's job, not this one)
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { MetricProfile, SetEntry } from '../../domain/types';
import { formatDurationSec, formatNumber } from '../../domain/format';

export interface SetSummaryExerciseInput {
	name: string;
	/** Not used by formatSetSummary itself — carried through so a caller like
	 *  WorkoutDetailScreen can link the row to /exercise/$exerciseId. */
	exerciseId?: string;
	metricProfile: MetricProfile;
	archived?: boolean;
	sets: SetEntry[];
}

export interface SetSummarySegment {
	exerciseName: string;
	/** e.g. "3×8 @ 80 kg" or "5 km · 28:00" — already display-formatted, ready to render. */
	valueText: string;
	archived: boolean;
	isRecord: boolean;
}

export interface SetSummaryResult {
	segments: SetSummarySegment[];
	/** Exercises with completed sets that didn't fit within `maxSegments`. */
	overflowCount: number;
}

function formatWeightRepsGroups(sets: SetEntry[]): string {
	const groups: { weightKg?: number; reps?: number; count: number }[] = [];
	for (const set of sets) {
		const last = groups[groups.length - 1];
		if (last && last.weightKg === set.weightKg && last.reps === set.reps) {
			last.count += 1;
		} else {
			groups.push({ weightKg: set.weightKg, reps: set.reps, count: 1 });
		}
	}
	return groups
		.map((g) => `${g.count}×${g.reps ?? 0} @ ${formatNumber(g.weightKg ?? 0)} kg`)
		.join(', ');
}

function formatDistanceDurationSets(sets: SetEntry[]): string {
	return sets
		.map((s) => `${formatNumber(s.distanceKm ?? 0)} km · ${formatDurationSec(s.durationSec ?? 0)}`)
		.join(', ');
}

export function formatSetSummary(
	exercises: SetSummaryExerciseInput[],
	maxSegments = 3,
): SetSummaryResult {
	const segments: SetSummarySegment[] = [];

	for (const exercise of exercises) {
		const completed = exercise.sets.filter((s) => s.status === 'completed');
		if (completed.length === 0) continue;

		const valueText =
			exercise.metricProfile === 'weight-reps'
				? formatWeightRepsGroups(completed)
				: formatDistanceDurationSets(completed);

		segments.push({
			exerciseName: exercise.name,
			valueText,
			archived: exercise.archived ?? false,
			isRecord: completed.some((s) => s.isRecord),
		});
	}

	return {
		segments: segments.slice(0, maxSegments),
		overflowCount: Math.max(0, segments.length - maxSegments),
	};
}
