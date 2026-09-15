// P-47 Training analysis — pure aggregation over a bulk-fetched range of completed sets, mirroring history/computeStats.ts's own "pure function over fetched rows" pattern rather than adding Rust analytics logic. SPEC.md 8.7's "initial progress metrics" list, generalized from one exercise's history to a period + category/exercise breakdown across every workout.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { AnalysisSetEntry } from '../../domain/types';
import { estimateOneRepMax, ONE_REP_MAX_FORMULA_NAME } from '../history/oneRepMax';

export type AnalysisMetric =
	| 'frequency'
	| 'sets'
	| 'volume'
	| 'reps'
	| 'maxWeight'
	| 'estimated1RM'
	| 'maxDistance'
	| 'totalDistance'
	| 'duration'
	| 'pace'
	| 'speed';

export type AnalysisGroupBy = 'category' | 'exercise';

export const WEIGHT_REPS_METRICS: AnalysisMetric[] = [
	'frequency',
	'sets',
	'volume',
	'reps',
	'maxWeight',
	'estimated1RM',
];

export const DISTANCE_DURATION_METRICS: AnalysisMetric[] = [
	'frequency',
	'sets',
	'maxDistance',
	'totalDistance',
	'duration',
	'pace',
	'speed',
];

export const ANALYSIS_METRICS: AnalysisMetric[] = [
	...WEIGHT_REPS_METRICS,
	...DISTANCE_DURATION_METRICS.filter((m) => !WEIGHT_REPS_METRICS.includes(m)),
];

export const ANALYSIS_METRIC_LABELS: Record<AnalysisMetric, string> = {
	frequency: 'Training days',
	sets: 'Total sets',
	volume: 'Volume',
	reps: 'Total reps',
	maxWeight: 'Max weight',
	estimated1RM: 'Est. 1RM',
	maxDistance: 'Max distance',
	totalDistance: 'Total distance',
	duration: 'Duration',
	pace: 'Avg pace',
	speed: 'Avg speed',
};

export const ANALYSIS_METRIC_UNITS: Record<AnalysisMetric, string> = {
	frequency: 'days',
	sets: '',
	volume: 'kg',
	reps: '',
	maxWeight: 'kg',
	estimated1RM: 'kg',
	maxDistance: 'km',
	totalDistance: 'km',
	duration: 's',
	pace: 'sec/km',
	speed: 'km/h',
};

/** Plain-language definition of how each metric is computed within a group — SPEC.md 8.7 requires stating a metric's definition and unit in the UI, not just its label, since several of these (pace/speed in particular) are simple per-set averages rather than totals-derived rates. */
export const ANALYSIS_METRIC_DEFINITIONS: Record<AnalysisMetric, string> = {
	frequency: 'Number of distinct calendar days with a completed set in this group.',
	sets: 'Number of completed sets.',
	volume: 'Sum of weight × reps across every set.',
	reps: 'Sum of reps across every set.',
	maxWeight: 'Heaviest weight logged on a single set.',
	estimated1RM: `Heaviest single-set estimated one-rep max (${ONE_REP_MAX_FORMULA_NAME} formula).`,
	maxDistance: 'Longest distance logged on a single set.',
	totalDistance: 'Sum of distance across every set.',
	duration: 'Sum of duration across every set.',
	pace: "Average of each set's own pace (duration ÷ distance), not total duration ÷ total distance.",
	speed:
		"Average of each set's own speed (distance ÷ duration), not total distance ÷ total duration.",
};

/** A metric's value for one set, or `undefined` when the set's metric profile doesn't support it — e.g. `volume` for a distance-duration set, `pace` for a set with no distance logged. The Rust backend serializes an absent field as JSON `null` (unlike the mock repository's plain `undefined`), so every branch normalizes `null` to `undefined` rather than letting it flow through as a real value — `Math.max(null)` is `0`, not "not applicable". */
function metricValue(entry: AnalysisSetEntry, metric: AnalysisMetric): number | undefined {
	switch (metric) {
		case 'frequency':
		case 'sets':
			return 1;
		case 'volume':
			return entry.weightKg != null && entry.reps != null ? entry.weightKg * entry.reps : undefined;
		case 'reps':
			return entry.reps ?? undefined;
		case 'maxWeight':
			return entry.weightKg ?? undefined;
		case 'estimated1RM':
			return entry.weightKg != null && entry.reps != null
				? estimateOneRepMax(entry.weightKg, entry.reps)
				: undefined;
		case 'maxDistance':
		case 'totalDistance':
			return entry.distanceKm ?? undefined;
		case 'duration':
			return entry.durationSec ?? undefined;
		case 'pace':
			return entry.distanceKm && entry.durationSec
				? entry.durationSec / entry.distanceKm
				: undefined;
		case 'speed':
			return entry.distanceKm && entry.durationSec
				? (entry.distanceKm / entry.durationSec) * 3600
				: undefined;
	}
}

/** How per-set values combine into one group total — sum for cumulative metrics, max for a personal-best-style metric, and a simple average for the two rate metrics (pace/speed), consistent with the fact they aren't additive across sets. */
function aggregate(values: number[], metric: AnalysisMetric): number {
	switch (metric) {
		case 'maxWeight':
		case 'estimated1RM':
		case 'maxDistance':
			return Math.max(...values);
		case 'pace':
		case 'speed':
			return values.reduce((sum, v) => sum + v, 0) / values.length;
		default:
			return values.reduce((sum, v) => sum + v, 0);
	}
}

export interface AnalysisBreakdownRow {
	key: string;
	label: string;
	value: number;
	/** The originating sets this row's value was computed from, each still traceable back to its workout — SPEC.md 8.7: "selecting an analytic value reveals the originating workout and set." */
	entries: AnalysisSetEntry[];
}

/** Groups `entries` by category or exercise and aggregates `metric` within each group, skipping any set the metric doesn't apply to. Rows are sorted by value, descending. */
export function computeBreakdown(
	entries: AnalysisSetEntry[],
	metric: AnalysisMetric,
	groupBy: AnalysisGroupBy,
): AnalysisBreakdownRow[] {
	const groups = new Map<string, { label: string; entries: AnalysisSetEntry[] }>();
	for (const entry of entries) {
		if (metricValue(entry, metric) == null) continue;
		const key = groupBy === 'category' ? entry.categoryId : entry.exerciseId;
		const label = groupBy === 'category' ? entry.categoryName : entry.exerciseName;
		const group = groups.get(key);
		if (group) group.entries.push(entry);
		else groups.set(key, { label, entries: [entry] });
	}

	const rows: AnalysisBreakdownRow[] = [];
	for (const [key, { label, entries: groupEntries }] of groups) {
		const value =
			metric === 'frequency'
				? countTrainingDays(groupEntries)
				: aggregate(
						groupEntries.map((e) => metricValue(e, metric)!),
						metric,
					);
		rows.push({ key, label, value, entries: groupEntries });
	}
	return rows.sort((a, b) => b.value - a.value);
}

/** Distinct calendar dates represented in `entries` — the "frequency" half of SPEC.md 8.7's "frequency, sets, reps, volume, duration, and distance" breakdown list. */
export function countTrainingDays(entries: AnalysisSetEntry[]): number {
	return new Set(entries.map((e) => e.date)).size;
}
