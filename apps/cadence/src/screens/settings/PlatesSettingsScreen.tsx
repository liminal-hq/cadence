// P-66 Plates & barbells list — real CRUD over the BarbellConfig shape that already existed
// in domain/types.ts and seedData.ts from the Logging PR, so this needed no new domain modelling
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { SettingsSubScreenHeader } from './SettingsSubScreenHeader';
import { SettingsRow } from './SettingsRow';
import { Tag } from '../../components/ui/Tag/Tag';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { BarbellConfig } from '../../domain/types';
import { formatNumber } from '../../domain/format';
import './settings.css';

export function PlatesSettingsScreen() {
	const navigate = useNavigate();
	const repository = useLoggingRepository();
	const [barbells, setBarbells] = useState<BarbellConfig[]>([]);

	useEffect(() => {
		repository.listBarbellConfigs().then(setBarbells);
	}, [repository]);

	return (
		<div className="settings-screen">
			<SettingsSubScreenHeader title="Plates & barbells" />
			<div className="settings-screen__content">
				<section>
					<div className="settings-section__body">
						{barbells.map((barbell) => (
							<SettingsRow
								key={barbell.id}
								icon="fitness_center"
								label={barbell.name}
								subtext={`${formatNumber(barbell.barWeight)} ${barbell.displayUnit} bar`}
								badge={
									barbell.isDefault ? (
										<Tag
											label="Default"
											background="var(--cadence-secondary-container)"
											colour="var(--cadence-on-secondary-container)"
										/>
									) : undefined
								}
								onClick={() =>
									navigate({ to: '/settings/plates/$barbellId', params: { barbellId: barbell.id } })
								}
							/>
						))}
						<SettingsRow
							icon="add"
							label="Add a barbell"
							onClick={() =>
								navigate({ to: '/settings/plates/$barbellId', params: { barbellId: 'new' } })
							}
						/>
					</div>
				</section>
			</div>
		</div>
	);
}
