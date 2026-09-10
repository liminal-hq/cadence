// Competition plate colour coding, per unit and weight -- kg and lb plates of the same number
// are physically different plates, so they're keyed separately
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { WeightUnit } from '../../domain/types';

export interface PlateStyle {
	background: string;
	textColour: string;
	heightPx: number;
	widthPx: number;
}

const KG_STYLES: Record<number, PlateStyle> = {
	25: { background: '#c62828', textColour: '#ffffff', heightPx: 64, widthPx: 16 },
	20: { background: '#1e4fa8', textColour: '#ffffff', heightPx: 58, widthPx: 16 },
	15: { background: '#f2c230', textColour: '#1c1b20', heightPx: 52, widthPx: 14 },
	10: { background: '#2e7d32', textColour: '#ffffff', heightPx: 46, widthPx: 14 },
	5: { background: '#f4f1f7', textColour: '#1c1b20', heightPx: 40, widthPx: 10 },
	2.5: { background: '#2b2930', textColour: '#ffffff', heightPx: 32, widthPx: 8 },
	1.25: { background: '#bdb8c4', textColour: '#1c1b20', heightPx: 26, widthPx: 8 },
};

const LB_STYLES: Record<number, PlateStyle> = {
	45: { background: '#1e4fa8', textColour: '#ffffff', heightPx: 64, widthPx: 16 },
	35: { background: '#f2c230', textColour: '#1c1b20', heightPx: 56, widthPx: 14 },
	25: { background: '#2e7d32', textColour: '#ffffff', heightPx: 48, widthPx: 14 },
	10: { background: '#f4f1f7', textColour: '#1c1b20', heightPx: 38, widthPx: 10 },
	5: { background: '#c62828', textColour: '#ffffff', heightPx: 32, widthPx: 8 },
	2.5: { background: '#2b2930', textColour: '#ffffff', heightPx: 26, widthPx: 8 },
};

const FALLBACK_STYLE: PlateStyle = {
	background: '#79767f',
	textColour: '#ffffff',
	heightPx: 30,
	widthPx: 10,
};

export function plateStyle(unit: WeightUnit, weight: number): PlateStyle {
	const table = unit === 'kg' ? KG_STYLES : LB_STYLES;
	return table[weight] ?? FALLBACK_STYLE;
}
