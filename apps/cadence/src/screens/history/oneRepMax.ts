// The Epley formula — SPEC.md 8.7's "formula and its limitations should be documented" applies
// here: this estimates 1RM from a single completed set, it doesn't claim to measure it directly
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

export const ONE_REP_MAX_FORMULA_NAME = 'Epley';

export function estimateOneRepMax(weightKg: number, reps: number): number {
	if (reps <= 1) return weightKg;
	return weightKg * (1 + reps / 30);
}
