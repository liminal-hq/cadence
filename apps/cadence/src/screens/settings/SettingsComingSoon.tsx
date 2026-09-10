// Placeholder body for the hub rows this PR doesn't build a full screen for yet — proves every
// row in the Settings hub actually navigates, without pretending each destination is finished
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { ComingSoon } from '../ComingSoon';
import { SettingsSubScreenHeader } from './SettingsSubScreenHeader';
import './settings.css';

interface SettingsComingSoonProps {
	screen: string;
}

export function SettingsComingSoon({ screen }: SettingsComingSoonProps) {
	return (
		<div className="settings-screen">
			<SettingsSubScreenHeader title={screen} />
			<div className="settings-screen__content">
				<ComingSoon screen={screen} />
			</div>
		</div>
	);
}
