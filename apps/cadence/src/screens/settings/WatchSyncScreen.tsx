// P-63 Connected watch and sync status — entirely UI-shell, one static seeded scenario
// (disconnected watch, 1 pending conflict) since no real pairing/sync model exists yet.
// Resolving the conflict is the one interaction, and it reveals the connected happy path too,
// so that state ships represented even though the design canvas doesn't draw it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useState } from 'react';
import { AppBar } from '../../components/ui/AppBar/AppBar';
import { SettingsRow } from './SettingsRow';
import { Surface } from '../../components/ui/Surface/Surface';
import { Button } from '../../components/ui/Button/Button';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import './settings.css';
import './WatchSyncScreen.css';

type Resolution = 'pending' | 'kept-phone' | 'kept-watch';

const LEDGER_ROWS: Record<Resolution, { label: string; value: string }[]> = {
	pending: [
		{ label: 'On phone', value: '12 sets' },
		{ label: 'Last known on watch', value: '13 sets' },
		{ label: 'Waiting to send', value: '0 sets' },
		{ label: 'Expected from watch', value: '1 set' },
	],
	// Keeping the phone's value means the watch's extra set is discarded from the count —
	// both devices converge on the phone's 12, not the watch's 13.
	'kept-phone': [
		{ label: 'On phone', value: '12 sets' },
		{ label: 'Last known on watch', value: '12 sets' },
		{ label: 'Waiting to send', value: '0 sets' },
		{ label: 'Expected from watch', value: '0 sets' },
	],
	'kept-watch': [
		{ label: 'On phone', value: '13 sets' },
		{ label: 'Last known on watch', value: '13 sets' },
		{ label: 'Waiting to send', value: '0 sets' },
		{ label: 'Expected from watch', value: '0 sets' },
	],
};

export function WatchSyncScreen() {
	const [resolution, setResolution] = useState<Resolution>('pending');
	const [removeOpen, setRemoveOpen] = useState(false);
	const resolved = resolution !== 'pending';

	return (
		<div className="settings-screen">
			<AppBar
				title="Wear OS watch"
				size="medium"
				back={{ to: '/settings' }}
				actions={[{ icon: 'help', label: 'Help' }]}
			/>
			<div className="settings-screen__content">
				<section>
					<div className="settings-section__body settings-section__body--padded">
						<Surface tone="container-high" radius="l" className="watch-device-card">
							<span className="material-symbols-rounded watch-device-card__icon" aria-hidden="true">
								watch
							</span>
							<div className="watch-device-card__text">
								<p className="watch-device-card__name">Cadence Watch</p>
								<p
									className={`watch-device-card__status${resolved ? ' watch-device-card__status--ok' : ' watch-device-card__status--attention'}`}
								>
									{resolved ? 'Connected' : '1 conflict needs review'}
								</p>
							</div>
						</Surface>
					</div>
				</section>

				<section>
					<h2 className="settings-section__title">Active workout sync</h2>
					<Surface tone="container" radius="l" className="watch-ledger">
						{LEDGER_ROWS[resolution].map((row) => (
							<div className="watch-ledger__row" key={row.label}>
								<span className="watch-ledger__label">{row.label}</span>
								<span className="watch-ledger__value">{row.value}</span>
							</div>
						))}
					</Surface>
				</section>

				{!resolved && (
					<section>
						<h2 className="settings-section__title">Needs review</h2>
						<div className="settings-section__body settings-section__body--padded">
							<Surface tone="container-high" radius="l" className="watch-conflict-card">
								<p className="watch-conflict-card__title">Lateral Raise · set 3</p>
								<div className="watch-conflict-card__values">
									<div className="watch-conflict-card__value">
										<span className="watch-conflict-card__value-label">Phone</span>
										<span className="watch-conflict-card__value-amount">10 × 15</span>
									</div>
									<div className="watch-conflict-card__value">
										<span className="watch-conflict-card__value-label">Watch</span>
										<span className="watch-conflict-card__value-amount">10 × 13</span>
									</div>
								</div>
								<p className="watch-conflict-card__note">
									The value you don't keep stays visible in the set's history — nothing is deleted.
								</p>
								<div className="watch-conflict-card__actions">
									<Button variant="outlined" onClick={() => setResolution('kept-phone')}>
										Keep phone
									</Button>
									<Button variant="tonal" onClick={() => setResolution('kept-watch')}>
										Keep watch
									</Button>
								</div>
							</Surface>
						</div>
					</section>
				)}

				<section>
					<div className="settings-section__body settings-section__body--padded watch-footer-actions">
						<Button variant="outlined" fullWidth>
							Resync
						</Button>
						<Button variant="outlined" fullWidth>
							Send snapshot
						</Button>
					</div>
				</section>

				<section>
					<div className="settings-section__body">
						<SettingsRow
							icon="delete_forever"
							label="Remove watch data"
							tone="error"
							onClick={() => setRemoveOpen(true)}
						/>
					</div>
				</section>
			</div>

			<Dialog
				open={removeOpen}
				onClose={() => setRemoveOpen(false)}
				headline="Remove watch data?"
				role="dialog"
				actions={
					<>
						<Button variant="text" onClick={() => setRemoveOpen(false)}>
							Cancel
						</Button>
						<Button variant="filled" tone="error" onClick={() => setRemoveOpen(false)}>
							Remove
						</Button>
					</>
				}
			>
				<p className="watch-conflict-card__note">
					This unpairs the watch and clears its locally cached data. Sets already synced to your
					history are not affected.
				</p>
			</Dialog>
		</div>
	);
}
