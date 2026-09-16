// P-68 Theme and dynamic colour — a single Material You toggle, disabled off-Android where the underlying plugin always reports unsupported
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { SettingsSubScreenHeader } from './SettingsSubScreenHeader';
import { SettingsLoadFailure } from './SettingsLoadFailure';
import { SettingsRow } from './SettingsRow';
import { Switch } from '../../components/ui/Switch/Switch';
import { Banner } from '../../components/ui/Banner/Banner';
import { useSettings } from '../../domain/SettingsProvider';
import { resolvePlatform } from '../../platform';
import './settings.css';

export function ThemeSettingsScreen() {
	const { settings, error, clearError, updateSettings } = useSettings();
	const { platformType } = resolvePlatform();
	const isAndroid = platformType === 'android';

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
								isAndroid
									? "Match the app's colours to your wallpaper"
									: 'Available on Android 12 and above'
							}
							trailing={
								<Switch
									checked={settings.useMaterialYou}
									onChange={(checked) => updateSettings({ useMaterialYou: checked })}
									disabled={!isAndroid}
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
