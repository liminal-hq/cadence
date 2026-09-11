// Small display-formatting helpers shared across the logging screens/sheets
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

export function formatNumber(value: number): string {
	return Number.isInteger(value)
		? String(value)
		: value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatDurationSec(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const rest = Math.round(seconds % 60);
	return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

export function formatClockTime(iso: string): string {
	return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
}

/** An em dash when either timestamp is missing (an imported workout whose source didn't report
 *  timing) rather than inventing a duration. */
export function formatWorkoutDuration(startedAt?: string, completedAt?: string): string {
	if (!startedAt || !completedAt) return '—';
	const minutes = Math.round(
		(new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60_000,
	);
	return `${minutes} min`;
}

/** The real local date, as 'YYYY-MM-DD' — the one place in the app allowed to read the clock
 *  directly for "today"; everything else takes a date string as an explicit parameter so it stays
 *  deterministic to test (see historyDates.ts's own header). */
export function todayLocalDate(): string {
	const now = new Date();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${now.getFullYear()}-${month}-${day}`;
}

const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
	return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
	return lb * KG_PER_LB;
}
