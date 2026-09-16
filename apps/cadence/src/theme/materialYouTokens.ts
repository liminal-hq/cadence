// Maps Android's raw Material You tonal palettes onto Cadence's own M3 token roles — the plugin's job ends at handing back palette data, this is Cadence-specific derivation
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type {
	MaterialYouPaletteName,
	MaterialYouPaletteTones,
	MaterialYouResponse,
} from '@liminal-hq/plugin-material-you';

export type ColourScheme = 'light' | 'dark';

// Android exposes each palette as color resources named e.g. `system_accent1_600`; the suffix is
// ten times the real M3 tone (0-100), so tone 60 lives at key "600".
const AVAILABLE_TONES = [0, 1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function suffixFor(tone: number): string {
	return String(tone * 10);
}

function parseRgb(argbHex: string): [number, number, number] {
	const hex = argbHex.replace('#', '');
	const rgb = hex.length > 6 ? hex.slice(-6) : hex;
	return [
		parseInt(rgb.slice(0, 2), 16),
		parseInt(rgb.slice(2, 4), 16),
		parseInt(rgb.slice(4, 6), 16),
	];
}

function formatRgb([r, g, b]: [number, number, number]): string {
	const toHex = (channel: number) => Math.round(channel).toString(16).padStart(2, '0');
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Every tone this module asks for is either an exact stop above or falls between two that both
// exist, so a single exact-lookup-else-interpolate helper covers every role.
function tone(palette: MaterialYouPaletteTones | undefined, target: number): string | null {
	if (!palette) return null;

	const exact = palette[suffixFor(target)];
	if (exact) return formatRgb(parseRgb(exact));

	let lo = AVAILABLE_TONES[0];
	let hi = AVAILABLE_TONES[AVAILABLE_TONES.length - 1];
	for (let i = 0; i < AVAILABLE_TONES.length - 1; i++) {
		if (AVAILABLE_TONES[i] <= target && target <= AVAILABLE_TONES[i + 1]) {
			lo = AVAILABLE_TONES[i];
			hi = AVAILABLE_TONES[i + 1];
			break;
		}
	}

	const loColour = palette[suffixFor(lo)];
	const hiColour = palette[suffixFor(hi)];
	if (!loColour || !hiColour) return null;

	const ratio = hi === lo ? 0 : (target - lo) / (hi - lo);
	const [lr, lg, lb] = parseRgb(loColour);
	const [hr, hg, hb] = parseRgb(hiColour);
	return formatRgb([lr + (hr - lr) * ratio, lg + (hg - lg) * ratio, lb + (hb - lb) * ratio]);
}

interface RoleSpec {
	token: string;
	palette: MaterialYouPaletteName;
	light: number;
	dark: number;
}

// `error`/`on-error`/`error-container`/`on-error-container`, the custom `attention` family, and
// the `--cadence-chrome-*` trio are deliberately absent — no Material You source exists for any
// of them, and chrome tokens are never theme-reactive.
const ROLE_TABLE: RoleSpec[] = [
	{ token: '--cadence-primary', palette: 'system_accent1', light: 40, dark: 80 },
	{ token: '--cadence-on-primary', palette: 'system_accent1', light: 100, dark: 20 },
	{ token: '--cadence-primary-container', palette: 'system_accent1', light: 90, dark: 30 },
	{ token: '--cadence-on-primary-container', palette: 'system_accent1', light: 10, dark: 90 },
	{ token: '--cadence-secondary', palette: 'system_accent2', light: 40, dark: 80 },
	{ token: '--cadence-on-secondary', palette: 'system_accent2', light: 100, dark: 20 },
	{ token: '--cadence-secondary-container', palette: 'system_accent2', light: 90, dark: 30 },
	{ token: '--cadence-on-secondary-container', palette: 'system_accent2', light: 10, dark: 90 },
	{ token: '--cadence-tertiary', palette: 'system_accent3', light: 40, dark: 80 },
	{ token: '--cadence-on-tertiary', palette: 'system_accent3', light: 100, dark: 20 },
	{ token: '--cadence-tertiary-container', palette: 'system_accent3', light: 90, dark: 30 },
	{ token: '--cadence-on-tertiary-container', palette: 'system_accent3', light: 10, dark: 90 },
	{ token: '--cadence-surface', palette: 'system_neutral1', light: 98, dark: 6 },
	{ token: '--cadence-surface-container-lowest', palette: 'system_neutral1', light: 100, dark: 4 },
	{ token: '--cadence-surface-container-low', palette: 'system_neutral1', light: 96, dark: 10 },
	{ token: '--cadence-surface-container', palette: 'system_neutral1', light: 94, dark: 12 },
	{ token: '--cadence-surface-container-high', palette: 'system_neutral1', light: 92, dark: 17 },
	{ token: '--cadence-surface-container-highest', palette: 'system_neutral1', light: 90, dark: 22 },
	{ token: '--cadence-on-surface', palette: 'system_neutral1', light: 10, dark: 90 },
	{ token: '--cadence-inverse-surface', palette: 'system_neutral1', light: 20, dark: 90 },
	{ token: '--cadence-inverse-on-surface', palette: 'system_neutral1', light: 95, dark: 20 },
	{ token: '--cadence-on-surface-variant', palette: 'system_neutral2', light: 30, dark: 80 },
	{ token: '--cadence-outline', palette: 'system_neutral2', light: 50, dark: 60 },
	{ token: '--cadence-outline-variant', palette: 'system_neutral2', light: 80, dark: 30 },
];

/** `null` whenever there's nothing to apply — unsupported, missing, or incomplete palette data —
 *  so the caller's only job is "apply these tokens" or "leave the static theme alone." */
export function deriveMaterialYouTokens(
	response: MaterialYouResponse | null | undefined,
	scheme: ColourScheme,
): Record<string, string> | null {
	if (!response || !response.supported) return null;

	const tokens: Record<string, string> = {};
	for (const spec of ROLE_TABLE) {
		const palette = response.palettes[spec.palette];
		const value = tone(palette, scheme === 'light' ? spec.light : spec.dark);
		if (!value) return null;
		tokens[spec.token] = value;
	}
	return tokens;
}
