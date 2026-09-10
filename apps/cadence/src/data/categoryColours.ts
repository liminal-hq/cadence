// The user-editable category tonal pairs from the Foundations design canvas -- eventually user
// data (categories are free-form and user-owned per SPEC.md section 5), not a design token
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

export interface CategoryColour {
	background: string;
	text: string;
	dot: string;
}

export const CATEGORY_COLOURS: Record<string, CategoryColour> = {
	chest: { background: '#ffd9dd', text: '#5a0f1c', dot: '#a83a4c' },
	back: { background: '#ffddb8', text: '#3a2200', dot: '#9a5b00' },
	shoulders: { background: '#ffe7a3', text: '#3e2e00', dot: '#7a6000' },
	biceps: { background: '#d2efc8', text: '#0f2e0b', dot: '#3e7a34' },
	triceps: { background: '#c8eee6', text: '#00302a', dot: '#0e7566' },
	legs: { background: '#d3e4ff', text: '#0b2547', dot: '#2d5fa8' },
	core: { background: '#e7dff6', text: '#1d192b', dot: '#6f5aa6' },
	cardio: { background: '#e6e0eb', text: '#1c1b20', dot: '#5f5c68' },
};

export const DEFAULT_CATEGORY_COLOUR: CategoryColour = CATEGORY_COLOURS.cardio;
