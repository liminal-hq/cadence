// Verifies null-on-unsupported/incomplete, exact-stop and interpolated-tone correctness, dark≠light, and that error/attention/chrome tokens are never touched
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { deriveMaterialYouTokens } from './materialYouTokens';
import type { MaterialYouResponse } from '@liminal-hq/plugin-material-you';

const ACCENT1 = {
	'100': '#100000',
	'200': '#200000',
	'300': '#300000',
	'400': '#400000',
	'800': '#800000',
	'900': '#900000',
	'1000': '#a00000',
};
const ACCENT2 = {
	'100': '#001000',
	'200': '#002000',
	'300': '#003000',
	'400': '#004000',
	'800': '#008000',
	'900': '#009000',
	'1000': '#00a000',
};
const ACCENT3 = {
	'100': '#000010',
	'200': '#000020',
	'300': '#000030',
	'400': '#000040',
	'800': '#000080',
	'900': '#000090',
	'1000': '#0000a0',
};
const NEUTRAL1 = {
	'10': '#010101',
	'50': '#050505',
	'100': '#101010',
	'200': '#202020',
	'300': '#303030',
	'900': '#909090',
	'1000': '#f0f0f0',
};
const NEUTRAL2 = {
	'300': '#0a0a0a',
	'500': '#0b0b0b',
	'600': '#0c0c0c',
	'800': '#0d0d0d',
};

const FULL_RESPONSE: MaterialYouResponse = {
	supported: true,
	apiLevel: 31,
	palettes: {
		system_accent1: ACCENT1,
		system_accent2: ACCENT2,
		system_accent3: ACCENT3,
		system_neutral1: NEUTRAL1,
		system_neutral2: NEUTRAL2,
	},
};

describe('deriveMaterialYouTokens', () => {
	it('returns null when the plugin reports unsupported', () => {
		expect(
			deriveMaterialYouTokens({ supported: false, apiLevel: 0, palettes: {} }, 'light'),
		).toBeNull();
	});

	it('returns null for a missing response', () => {
		expect(deriveMaterialYouTokens(null, 'light')).toBeNull();
		expect(deriveMaterialYouTokens(undefined, 'light')).toBeNull();
	});

	it('returns null rather than a partial theme when a palette is missing', () => {
		const incomplete: MaterialYouResponse = {
			...FULL_RESPONSE,
			palettes: { ...FULL_RESPONSE.palettes, system_accent2: undefined },
		};
		expect(deriveMaterialYouTokens(incomplete, 'light')).toBeNull();
	});

	it('resolves exact-stop tones for the light scheme', () => {
		const tokens = deriveMaterialYouTokens(FULL_RESPONSE, 'light');
		expect(tokens).toMatchObject({
			'--cadence-primary': '#400000',
			'--cadence-on-primary': '#a00000',
			'--cadence-primary-container': '#900000',
			'--cadence-on-primary-container': '#100000',
			'--cadence-secondary': '#004000',
			'--cadence-tertiary': '#000040',
			'--cadence-surface-container-highest': '#909090',
			'--cadence-on-surface': '#101010',
			'--cadence-on-surface-variant': '#0a0a0a',
			'--cadence-outline': '#0b0b0b',
			'--cadence-outline-variant': '#0d0d0d',
		});
	});

	it('linearly interpolates a tone that falls between two of Android’s 13 stops', () => {
		const light = deriveMaterialYouTokens(FULL_RESPONSE, 'light');
		const dark = deriveMaterialYouTokens(FULL_RESPONSE, 'dark');

		// surface (light 98, between stops 90 and 100)
		expect(light).toMatchObject({ '--cadence-surface': '#dddddd' });
		expect(light).toMatchObject({ '--cadence-surface-container-low': '#cacaca' });
		expect(light).toMatchObject({ '--cadence-surface-container': '#b6b6b6' });
		expect(light).toMatchObject({ '--cadence-surface-container-high': '#a3a3a3' });
		expect(light).toMatchObject({ '--cadence-inverse-on-surface': '#c0c0c0' });

		// surface (dark 6, between stops 5 and 10) and its siblings
		expect(dark).toMatchObject({ '--cadence-surface': '#070707' });
		expect(dark).toMatchObject({ '--cadence-surface-container-lowest': '#040404' });
		expect(dark).toMatchObject({ '--cadence-surface-container': '#131313' });
		expect(dark).toMatchObject({ '--cadence-surface-container-high': '#1b1b1b' });
		expect(dark).toMatchObject({ '--cadence-surface-container-highest': '#232323' });
	});

	it('resolves a different palette for dark than for light', () => {
		const light = deriveMaterialYouTokens(FULL_RESPONSE, 'light');
		const dark = deriveMaterialYouTokens(FULL_RESPONSE, 'dark');
		expect(light!['--cadence-primary']).not.toBe(dark!['--cadence-primary']);
		expect(light!['--cadence-surface']).not.toBe(dark!['--cadence-surface']);
	});

	it('never derives error, attention, or chrome tokens', () => {
		const tokens = deriveMaterialYouTokens(FULL_RESPONSE, 'light')!;
		const untouched = Object.keys(tokens).filter(
			(key) => key.includes('error') || key.includes('attention') || key.includes('chrome'),
		);
		expect(untouched).toEqual([]);
	});
});
