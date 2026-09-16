// P-68 Theme and dynamic colour — a single Material You toggle, disabled unless the plugin itself reports the device as supported
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { getMaterialYouColours, type MaterialYouResponse } from '@liminal-hq/plugin-material-you';
import { SettingsSubScreenHeader } from './SettingsSubScreenHeader';
import { SettingsLoadFailure } from './SettingsLoadFailure';
import { SettingsRow } from './SettingsRow';
import { Switch } from '../../components/ui/Switch/Switch';
import { Banner } from '../../components/ui/Banner/Banner';
import { useSettings } from '../../domain/SettingsProvider';
import './settings.css';

export function ThemeSettingsScreen() {
	const { settings, error, clearError, updateSettings } = useSettings();
	const [response, setResponse] = useState<MaterialYouResponse | null>(null);

	useEffect(() => {
		getMaterialYouColours().then(setResponse, () => setResponse(null));
	}, []);

	// Android 8-11 still reports platformType 'android' but the plugin itself resolves
	// unsupported (pre-API-31) — the platform alone can't tell us whether the toggle actually
	// does anything, only the plugin's own response can.
	const isSupported = response?.supported ?? false;

	if (!settings) return <SettingsLoadFailure title="Theme & wallpaper colours" />;

	return (
		<div className="settings-screen">
			<SettingsSubScreenHeader title="Theme & wallpaper colours" />
			<div className="settings-screen__content">
				{error && (
					<div className="settings-section__body settings-section__body--padded">
						<Banner icon="error" tone="attention" message={error} onDismiss={clearError} />
					</div>
				)}
				<section>
					<div className="settings-section__body">
						<SettingsRow
							icon="palette"
							label="Material You"
							subtext={
								isSupported
									? "Match the app's colours to your wallpaper"
									: 'Available on Android 12 and above'
							}
							trailing={
								<Switch
									checked={settings.useMaterialYou}
									onChange={(checked) => updateSettings({ useMaterialYou: checked })}
									disabled={!isSupported}
									label="Material You"
								/>
							}
						/>
					</div>
				</section>
			</div>
		</div>
	);
}
