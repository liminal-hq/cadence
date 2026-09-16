// Verifies injection, replacement, and cleanup of Material You tokens on the document root
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { afterEach, describe, expect, it } from 'vitest';
import { applyMaterialYouTokens } from './applyMaterialYouTokens';

afterEach(() => {
	applyMaterialYouTokens(null);
});

describe('applyMaterialYouTokens', () => {
	it('sets each token as a custom property on the document root', () => {
		applyMaterialYouTokens({ '--cadence-primary': '#123456', '--cadence-surface': '#abcdef' });

		const root = document.documentElement.style;
		expect(root.getPropertyValue('--cadence-primary')).toBe('#123456');
		expect(root.getPropertyValue('--cadence-surface')).toBe('#abcdef');
	});

	it('removes properties from a previous call that are absent from a new one', () => {
		applyMaterialYouTokens({ '--cadence-primary': '#111111', '--cadence-surface': '#222222' });
		applyMaterialYouTokens({ '--cadence-primary': '#333333' });

		const root = document.documentElement.style;
		expect(root.getPropertyValue('--cadence-primary')).toBe('#333333');
		expect(root.getPropertyValue('--cadence-surface')).toBe('');
	});

	it('clears every previously applied property when given null', () => {
		applyMaterialYouTokens({ '--cadence-primary': '#111111', '--cadence-surface': '#222222' });
		applyMaterialYouTokens(null);

		const root = document.documentElement.style;
		expect(root.getPropertyValue('--cadence-primary')).toBe('');
		expect(root.getPropertyValue('--cadence-surface')).toBe('');
	});
});
