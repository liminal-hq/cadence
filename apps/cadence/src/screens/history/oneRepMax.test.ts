// Covers the single-rep edge case and the formula's behaviour as reps increase
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { estimateOneRepMax } from './oneRepMax';

describe('estimateOneRepMax', () => {
	it('returns the weight itself for a single rep', () => {
		expect(estimateOneRepMax(100, 1)).toBe(100);
	});

	it('applies the Epley formula for multiple reps', () => {
		expect(estimateOneRepMax(80, 8)).toBeCloseTo(80 * (1 + 8 / 30));
	});

	it('increases with more reps at the same weight', () => {
		expect(estimateOneRepMax(80, 10)).toBeGreaterThan(estimateOneRepMax(80, 8));
	});
});
