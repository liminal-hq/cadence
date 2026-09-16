// P-67 Accessibility & feedback — app-wide haptic preferences, distinct from P-61's
// rest-timer-specific Vibrate toggle, plus a reduced-motion switch
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { SettingsSubScreenHeader } from './SettingsSubScreenHeader';
import { SettingsRow } from './SettingsRow';
import { SettingsLoadFailure } from './SettingsLoadFailure';
import { Switch } from '../../components/ui/Switch/Switch';
import { Banner } from '../../components/ui/Banner/Banner';
import { useSettings } from '../../domain/SettingsProvider';
import './settings.css';

export function AccessibilitySettingsScreen() {
	const { settings, error, clearError, updateSettings: patch } = useSettings();

	if (!settings) return <SettingsLoadFailure title="Motion, haptics & sound" />;

	return (
		<div className="settings-screen">
			<SettingsSubScreenHeader title="Motion, haptics & sound" />
			<div className="settings-screen__content">
				{error && (
					<div className="settings-section__body settings-section__body--padded">
						<Banner icon="error" tone="attention" message={error} onDismiss={clearError} />
					</div>
				)}
				<section>
					<h2 className="settings-section__title">Haptics</h2>
					<div className="settings-section__body">
						<SettingsRow
							icon="vibration"
							label="Haptic on set complete"
							trailing={
								<Switch
									checked={settings.hapticOnSetComplete}
									onChange={(checked) => patch({ hapticOnSetComplete: checked })}
									label="Haptic on set complete"
								/>
							}
						/>
						<SettingsRow
							icon="vibration"
							label="Haptic when rest ends"
							trailing={
								<Switch
									checked={settings.hapticOnRestEnd}
									onChange={(checked) => patch({ hapticOnRestEnd: checked })}
									label="Haptic when rest ends"
								/>
							}
						/>
					</div>
				</section>

				<section>
					<h2 className="settings-section__title">Motion</h2>
					<div className="settings-section__body">
						<SettingsRow
							icon="motion_photos_off"
							label="Reduce motion"
							subtext="Turns off screen transitions and coach-mark animation"
							trailing={
								<Switch
									checked={settings.reducedMotion}
									onChange={(checked) => patch({ reducedMotion: checked })}
									label="Reduce motion"
								/>
							}
						/>
					</div>
				</section>
			</div>
		</div>
	);
}
