// WCAG 2.1 relative-luminance contrast ratio — P-35's "colour contrast warning" state (SCREENS.md), a non-blocking heuristic so an editor can flag a hard-to-read background/text pairing without preventing the save
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

export const MIN_TEXT_CONTRAST_RATIO = 4.5;

function hexToRgb(hex: string): [number, number, number] | undefined {
	const trimmed = hex.trim();
	const shortMatch = /^#?([0-9a-f]{3})$/i.exec(trimmed);
	// Expand CSS shorthand (#fff -> #ffffff) by doubling each digit -- both the category colour
	// fields and the browser's own <input type="color"> accept this form, so a low-contrast pair
	// like #fff/#eee must be caught here too, not silently treated as unparseable.
	const full = shortMatch
		? shortMatch[1]
				.split('')
				.map((c) => c + c)
				.join('')
		: /^#?([0-9a-f]{6})$/i.exec(trimmed)?.[1];
	if (!full) return undefined;
	const value = parseInt(full, 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function srgbChannelToLinear(channel: number): number {
	const normalized = channel / 255;
	return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number | undefined {
	const rgb = hexToRgb(hex);
	if (!rgb) return undefined;
	const [r, g, b] = rgb.map(srgbChannelToLinear);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `undefined` when either colour isn't a valid `#rrggbb` hex — an invalid value is a separate, more basic problem than a contrast warning, so this doesn't try to guess a ratio for it. */
export function contrastRatio(hexA: string, hexB: string): number | undefined {
	const lumA = relativeLuminance(hexA);
	const lumB = relativeLuminance(hexB);
	if (lumA === undefined || lumB === undefined) return undefined;
	const lighter = Math.max(lumA, lumB);
	const darker = Math.min(lumA, lumB);
	return (lighter + 0.05) / (darker + 0.05);
}

/** False for an invalid colour too — that's flagged as an invalid value elsewhere, not silently treated as "low contrast." */
export function isLowContrast(background: string, text: string): boolean {
	const ratio = contrastRatio(background, text);
	return ratio !== undefined && ratio < MIN_TEXT_CONTRAST_RATIO;
}
