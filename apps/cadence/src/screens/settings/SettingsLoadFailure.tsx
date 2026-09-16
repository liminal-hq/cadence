// Shared fallback for a settings screen whose initial load failed, kept out of SettingsProvider itself so a settings-specific failure never blocks routes that don't depend on settings at all
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { SettingsSubScreenHeader } from './SettingsSubScreenHeader';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { useSettings } from '../../domain/SettingsProvider';
import './settings.css';

interface SettingsLoadFailureProps {
	title: string;
}

export function SettingsLoadFailure({ title }: SettingsLoadFailureProps) {
	const { loadError, reload } = useSettings();

	if (!loadError) return null;

	return (
		<div className="settings-screen">
			<SettingsSubScreenHeader title={title} />
			<div className="settings-screen__content">
				<EmptyState
					headline="Couldn't load settings"
					body={loadError}
					action={
						<Button variant="filled" onClick={reload}>
							Try again
						</Button>
					}
				/>
			</div>
		</div>
	);
}
