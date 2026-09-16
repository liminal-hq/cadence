// Applies Material You dynamic colour on top of Cadence's static M3 tokens whenever the shared preference, the native palette, or the OS colour scheme changes — a no-op everywhere the plugin reports unsupported, which today is every non-Android platform
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { getMaterialYouColours, type MaterialYouResponse } from '@liminal-hq/plugin-material-you';
import { useSettings } from '../domain/SettingsProvider';
import { deriveMaterialYouTokens } from './materialYouTokens';
import { applyMaterialYouTokens } from './applyMaterialYouTokens';

export function useMaterialYouTheme(): void {
	const { settings } = useSettings();
	const [response, setResponse] = useState<MaterialYouResponse | null>(null);
	const [prefersDark, setPrefersDark] = useState(
		() => window.matchMedia('(prefers-color-scheme: dark)').matches,
	);

	useEffect(() => {
		getMaterialYouColours().then(setResponse, () => setResponse(null));
	}, []);

	useEffect(() => {
		const query = window.matchMedia('(prefers-color-scheme: dark)');
		const listener = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
		query.addEventListener('change', listener);
		return () => query.removeEventListener('change', listener);
	}, []);

	useEffect(() => {
		const tokens = settings?.useMaterialYou
			? deriveMaterialYouTokens(response, prefersDark ? 'dark' : 'light')
			: null;
		applyMaterialYouTokens(tokens);
	}, [settings?.useMaterialYou, response, prefersDark]);
}
