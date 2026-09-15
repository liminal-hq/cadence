// Covers the WCAG contrast-ratio formula against known reference pairs and the invalid-hex fallback
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { contrastRatio, isLowContrast } from './colourContrast';

describe('contrastRatio', () => {
	it('is 21:1 for pure black on pure white', () => {
		expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
	});

	it('is 1:1 for identical colours', () => {
		expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
	});

	it('is symmetric regardless of argument order', () => {
		expect(contrastRatio('#ffdad6', '#ba1a1a')).toBeCloseTo(
			contrastRatio('#ba1a1a', '#ffdad6')!,
			5,
		);
	});

	it('returns undefined for an invalid hex value', () => {
		expect(contrastRatio('not-a-colour', '#000000')).toBeUndefined();
	});
});

describe('isLowContrast', () => {
	it('is false for black on white', () => {
		expect(isLowContrast('#ffffff', '#000000')).toBe(false);
	});

	it('is true for near-identical light colours', () => {
		expect(isLowContrast('#e0e0e0', '#d8d8d8')).toBe(true);
	});

	it('is false (not a false positive) for an invalid colour', () => {
		expect(isLowContrast('nope', '#000000')).toBe(false);
	});
});
