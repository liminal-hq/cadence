// Units row's real destination — a single choice between kilograms and pounds, the one
// preference already backed by an existing domain type (WeightUnit) before this PR
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { SettingsSubScreenHeader } from './SettingsSubScreenHeader';
import { SettingsLoadFailure } from './SettingsLoadFailure';
import { SegmentedControl } from '../../components/ui/SegmentedControl/SegmentedControl';
import { Banner } from '../../components/ui/Banner/Banner';
import { useSettings } from '../../domain/SettingsProvider';
import type { WeightUnit } from '../../domain/types';
import './settings.css';

export function UnitsSettingsScreen() {
	const { settings, error, clearError, updateSettings } = useSettings();

	if (!settings) return <SettingsLoadFailure />;

	function handleChange(next: WeightUnit) {
		updateSettings({ weightUnit: next });
	}

	return (
		<div className="settings-screen">
			<SettingsSubScreenHeader title="Units" />
			<div className="settings-screen__content">
				{error && (
					<div className="settings-section__body settings-section__body--padded">
						<Banner icon="error" tone="attention" message={error} onDismiss={clearError} />
					</div>
				)}
				<section>
					<h2 className="settings-section__title">Weight</h2>
					<div className="settings-section__body settings-section__body--padded">
						<SegmentedControl
							options={[
								{ value: 'kg', label: 'Kilograms' },
								{ value: 'lb', label: 'Pounds' },
							]}
							value={settings.weightUnit}
							onChange={handleChange}
						/>
					</div>
				</section>
			</div>
		</div>
	);
}
