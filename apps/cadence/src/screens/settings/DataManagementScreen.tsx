// P-62 Data management — Restore/Import/Export/integrity/Storage stay UI-shell only against
// the mock repository (no real file I/O or backup format exists yet); Delete all history is
// the one destructive action built functionally real, proving the type-to-confirm pattern
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { SettingsSubScreenHeader } from './SettingsSubScreenHeader';
import { SettingsRow } from './SettingsRow';
import { DeleteAllHistoryDialog } from './DeleteAllHistoryDialog';
import { Surface } from '../../components/ui/Surface/Surface';
import { Button } from '../../components/ui/Button/Button';
import { Switch } from '../../components/ui/Switch/Switch';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { Settings } from '../../domain/types';
import './settings.css';
import './DataManagementScreen.css';

export function DataManagementScreen() {
	const repository = useLoggingRepository();
	const [settings, setSettings] = useState<Settings | null>(null);
	const [historySummary, setHistorySummary] = useState<{
		workoutCount: number;
		setCount: number;
	} | null>(null);
	const [backupStatus, setBackupStatus] = useState('Backed up 2 days ago · verified');
	const [exportStatus, setExportStatus] = useState<string | undefined>(undefined);
	const [integrityStatus, setIntegrityStatus] = useState('Last checked 2 days ago · no issues');
	const [restoreOpen, setRestoreOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	useEffect(() => {
		repository.getSettings().then(setSettings);
		repository.getHistorySummary().then(setHistorySummary);
	}, [repository]);

	function patchSettings(next: Partial<Settings>) {
		setSettings((current) => (current ? { ...current, ...next } : current));
		repository.updateSettings(next);
	}

	async function handleDeleteAll() {
		await repository.deleteAllHistory();
		setHistorySummary(await repository.getHistorySummary());
	}

	if (!settings || !historySummary) return null;

	return (
		<div className="settings-screen">
			<SettingsSubScreenHeader title="Backup & data" />
			<div className="settings-screen__content">
				<section>
					<div className="settings-section__body settings-section__body--padded">
						<Surface tone="container-high" radius="l" className="data-backup-card">
							<p className="data-backup-card__status">{backupStatus}</p>
							<div className="data-backup-card__actions">
								<Button
									variant="tonal"
									onClick={() => setBackupStatus('Backed up just now · verified')}
								>
									Back up now
								</Button>
								<Button variant="text">Destination</Button>
							</div>
						</Surface>
						<SettingsRow
							icon="schedule"
							label="Automatic backup"
							trailing={
								<Switch
									checked={settings.automaticBackupEnabled}
									onChange={(checked) => patchSettings({ automaticBackupEnabled: checked })}
									label="Automatic backup"
								/>
							}
						/>
					</div>
				</section>

				<section>
					<div className="settings-section__body">
						<SettingsRow
							icon="restore"
							label="Restore from a backup…"
							onClick={() => setRestoreOpen(true)}
						/>
						<SettingsRow
							icon="file_upload"
							label="Import from FitNotes…"
							subtext="Imported 84 workouts · 12 Aug 2026"
							trailing={
								<Button variant="text" onClick={() => {}}>
									Undo
								</Button>
							}
						/>
						<SettingsRow
							icon="file_download"
							label="Export spreadsheet (CSV)…"
							subtext={exportStatus}
							onClick={() => setExportStatus('Exported just now')}
						/>
						<SettingsRow
							icon="fact_check"
							label="Check database integrity"
							subtext={integrityStatus}
							trailing={
								<Button
									variant="text"
									onClick={() => setIntegrityStatus('Verified just now · no issues')}
								>
									Run
								</Button>
							}
						/>
						<SettingsRow icon="storage" label="Storage" status="128 MB used" />
					</div>
				</section>

				<section>
					<div className="settings-section__body">
						<SettingsRow
							icon="delete_forever"
							label="Delete all history…"
							tone="error"
							onClick={() => setDeleteOpen(true)}
						/>
					</div>
				</section>
			</div>

			<Dialog
				open={restoreOpen}
				onClose={() => setRestoreOpen(false)}
				headline="Restore from a backup?"
				role="dialog"
				actions={
					<>
						<Button variant="text" onClick={() => setRestoreOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="filled"
							onClick={() => {
								setRestoreOpen(false);
								setBackupStatus('Restored from backup just now');
							}}
						>
							Restore
						</Button>
					</>
				}
			>
				<p className="data-backup-card__status">
					This replaces everything currently on this device with the selected backup.
				</p>
			</Dialog>

			<DeleteAllHistoryDialog
				open={deleteOpen}
				onClose={() => setDeleteOpen(false)}
				onConfirm={handleDeleteAll}
				workoutCount={historySummary.workoutCount}
				setCount={historySummary.setCount}
			/>
		</div>
	);
}
