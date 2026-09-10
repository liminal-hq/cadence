// Units row's real destination — a single choice between kilograms and pounds, the one
// preference already backed by an existing domain type (WeightUnit) before this PR
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { SettingsSubScreenHeader } from './SettingsSubScreenHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl/SegmentedControl';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { WeightUnit } from '../../domain/types';
import './settings.css';

export function UnitsSettingsScreen() {
	const repository = useLoggingRepository();
	const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');

	useEffect(() => {
		repository.getSettings().then((settings) => setWeightUnit(settings.weightUnit));
	}, [repository]);

	function handleChange(next: WeightUnit) {
		setWeightUnit(next);
		repository.updateSettings({ weightUnit: next });
	}

	return (
		<div className="settings-screen">
			<SettingsSubScreenHeader title="Units" />
			<div className="settings-screen__content">
				<section>
					<h2 className="settings-section__title">Weight</h2>
					<div className="settings-section__body settings-section__body--padded">
						<SegmentedControl
							options={[
								{ value: 'kg', label: 'Kilograms' },
								{ value: 'lb', label: 'Pounds' },
							]}
							value={weightUnit}
							onChange={handleChange}
						/>
					</div>
				</section>
			</div>
		</div>
	);
}
