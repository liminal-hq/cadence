// Verifies null-on-unsupported/incomplete, exact-stop and interpolated-tone correctness, dark≠light, and that error/attention/chrome tokens are never touched
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { deriveMaterialYouTokens } from './materialYouTokens';
import type { MaterialYouResponse } from '@liminal-hq/plugin-material-you';

// Keyed by Android's real suffix-to-tone mapping (suffix 0 = tone 100 ... suffix 1000 = tone 0),
// not `tone * 10` — see materialYouTokens.ts's own comment for why.
const ACCENT1 = {
	'900': '#100000', // tone10
	'800': '#200000', // tone20
	'700': '#300000', // tone30
	'600': '#400000', // tone40
	'200': '#800000', // tone80
	'100': '#900000', // tone90
	'0': '#a00000', // tone100
};
const ACCENT2 = {
	'900': '#001000',
	'800': '#002000',
	'700': '#003000',
	'600': '#004000',
	'200': '#008000',
	'100': '#009000',
	'0': '#00a000',
};
const ACCENT3 = {
	'900': '#000010',
	'800': '#000020',
	'700': '#000030',
	'600': '#000040',
	'200': '#000080',
	'100': '#000090',
	'0': '#0000a0',
};
const NEUTRAL1 = {
	'1000': '#000000', // tone0
	'900': '#101010', // tone10
	'800': '#202020', // tone20
	'700': '#303030', // tone30
	'100': '#909090', // tone90
	'50': '#f0f0f0', // tone95
	'10': '#fafafa', // tone99
	'0': '#ffffff', // tone100
};
const NEUTRAL2 = {
	'700': '#0a0a0a', // tone30
	'500': '#0b0b0b', // tone50
	'400': '#0c0c0c', // tone60
	'200': '#0d0d0d', // tone80
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

		// surface (light 98, between stops 95 and 99) and its siblings
		expect(light).toMatchObject({ '--cadence-surface': '#f8f8f8' });
		expect(light).toMatchObject({ '--cadence-surface-container-low': '#f3f3f3' });
		expect(light).toMatchObject({ '--cadence-surface-container': '#dddddd' });
		expect(light).toMatchObject({ '--cadence-surface-container-high': '#b6b6b6' });

		// surface (dark 6, between stops 0 and 10) and its siblings
		expect(dark).toMatchObject({ '--cadence-surface': '#0a0a0a' });
		expect(dark).toMatchObject({ '--cadence-surface-container-lowest': '#060606' });
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
