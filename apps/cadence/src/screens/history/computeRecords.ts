// P-46 Records — actual PRs (measured), estimated 1RM PRs (calculated via oneRepMax.ts), and a
// rep-record-per-weight grid, all derived from completed weight-reps sets; ties are surfaced,
// never silently broken by "whichever came first"
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { estimateOneRepMax } from './oneRepMax';
import type { DatedSet } from './loadExerciseHistory';

const TIE_EPSILON = 0.001;

export interface RecordEntry {
	weightKg: number;
	reps: number;
	date: string;
	setId: string;
}

export interface EstimatedRecordEntry extends RecordEntry {
	value: number;
}

export interface RecordsResult {
	/** The heaviest weight ever completed — more than one entry means a tie. */
	actual: RecordEntry[];
	/** The highest Epley-estimated 1RM ever completed — more than one entry means a tie. */
	estimatedOneRm: EstimatedRecordEntry[];
	/** One entry per distinct weight lifted, the most reps achieved at it, heaviest first. */
	repRecordsByWeight: RecordEntry[];
}

function toEntry({ set, date }: DatedSet): RecordEntry {
	return {
		weightKg: set.weightKg ?? 0,
		reps: set.reps ?? 0,
		date,
		setId: set.id,
	};
}

/** Keeps at most one entry per date — several sets on the same day hitting the same record is
 *  one instance of it, not one tie per set. Prefers the entry with the most reps per date. */
function dedupeByDate<T extends RecordEntry>(entries: T[]): T[] {
	const bestByDate = new Map<string, T>();
	for (const entry of entries) {
		const existing = bestByDate.get(entry.date);
		if (!existing || entry.reps > existing.reps) bestByDate.set(entry.date, entry);
	}
	return [...bestByDate.values()];
}

export function computeRecords(datedSets: DatedSet[]): RecordsResult {
	const completed = datedSets.filter(
		({ set }) => set.status === 'completed' && set.weightKg !== undefined && set.reps !== undefined,
	);

	if (completed.length === 0) {
		return { actual: [], estimatedOneRm: [], repRecordsByWeight: [] };
	}

	const entries = completed.map(toEntry);

	const maxWeight = Math.max(...entries.map((e) => e.weightKg));
	const actual = dedupeByDate(
		entries.filter((e) => Math.abs(e.weightKg - maxWeight) < TIE_EPSILON),
	);

	const estimated = completed.map(({ set }, i) => ({
		...entries[i],
		value: estimateOneRepMax(set.weightKg!, set.reps!),
	}));
	const maxEstimate = Math.max(...estimated.map((e) => e.value));
	const estimatedOneRm = dedupeByDate(
		estimated.filter((e) => Math.abs(e.value - maxEstimate) < TIE_EPSILON),
	);

	const bestByWeight = new Map<number, RecordEntry>();
	for (const entry of entries) {
		const existing = bestByWeight.get(entry.weightKg);
		if (!existing || entry.reps > existing.reps) bestByWeight.set(entry.weightKg, entry);
	}
	const repRecordsByWeight = [...bestByWeight.values()].sort((a, b) => b.weightKg - a.weightKg);

	return { actual, estimatedOneRm, repRecordsByWeight };
}
