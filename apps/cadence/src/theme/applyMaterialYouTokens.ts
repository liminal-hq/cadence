// Injects (or clears) a derived Material You token set on the document root — the only place that reaches for inline styles directly, so every other component keeps reading --cadence-* as normal
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

let appliedProperties: string[] = [];

export function applyMaterialYouTokens(tokens: Record<string, string> | null): void {
	const root = document.documentElement.style;

	for (const property of appliedProperties) {
		root.removeProperty(property);
	}

	appliedProperties = tokens ? Object.keys(tokens) : [];
	if (!tokens) return;

	for (const [property, value] of Object.entries(tokens)) {
		root.setProperty(property, value);
	}
}
