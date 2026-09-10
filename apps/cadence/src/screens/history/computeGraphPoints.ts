// P-45 Graph data derivation — one point per day (the best value that day, so a second set
// doesn't create a misleading double-entry), missing days omitted rather than coerced to zero
// (SPEC.md 8.7: "missing data is omitted rather than coerced to zero")
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { SetEntry } from '../../domain/types';
import { estimateOneRepMax } from './oneRepMax';

export type GraphMetric = 'weight' | 'estimated-1rm' | 'volume' | 'distance' | 'pace';

export interface GraphPoint {
	date: string;
	value: number;
	weightKg?: number;
	reps?: number;
	distanceKm?: number;
	durationSec?: number;
	setId: string;
}

function metricValue(set: SetEntry, metric: GraphMetric): number | undefined {
	switch (metric) {
		case 'weight':
			return set.weightKg;
		case 'estimated-1rm':
			return set.weightKg !== undefined && set.reps !== undefined
				? estimateOneRepMax(set.weightKg, set.reps)
				: undefined;
		case 'volume':
			return set.weightKg !== undefined && set.reps !== undefined
				? set.weightKg * set.reps
				: undefined;
		case 'distance':
			return set.distanceKm;
		case 'pace':
			// Seconds per km — lower is faster, same convention a runner would expect.
			return set.distanceKm && set.durationSec ? set.durationSec / set.distanceKm : undefined;
	}
}

export function computeGraphPoints(sets: SetEntry[], metric: GraphMetric): GraphPoint[] {
	const bestByDate = new Map<string, { set: SetEntry; value: number }>();

	for (const set of sets) {
		if (set.status !== 'completed' || !set.completedAt) continue;
		const value = metricValue(set, metric);
		if (value === undefined) continue;

		const date = set.completedAt.slice(0, 10);
		const existing = bestByDate.get(date);
		if (!existing || value > existing.value) bestByDate.set(date, { set, value });
	}

	return [...bestByDate.entries()]
		.map(([date, { set, value }]) => ({
			date,
			value,
			weightKg: set.weightKg,
			reps: set.reps,
			distanceKm: set.distanceKm,
			durationSec: set.durationSec,
			setId: set.id,
		}))
		.sort((a, b) => a.date.localeCompare(b.date));
}
