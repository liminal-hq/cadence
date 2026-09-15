// P-49 Measurement tracker — the enabled-measurement list with a quick log-a-value action per row, plus a "Manage measurements" mode for add/edit/archive/reorder/delete over every definition (enabled or not)
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AppBar } from '../../components/ui/AppBar/AppBar';
import { Banner } from '../../components/ui/Banner/Banner';
import { Button } from '../../components/ui/Button/Button';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { IconButton } from '../../components/ui/IconButton/IconButton';
import { ReorderableList } from '../../components/ui/ReorderableList/ReorderableList';
import { Surface } from '../../components/ui/Surface/Surface';
import { TextField } from '../../components/ui/TextField/TextField';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import { formatNumber, todayLocalDate } from '../../domain/format';
import { byDateThenRecordedAt } from './MeasurementDetailScreen';
import type { MeasurementDefinition } from '../../domain/types';
import '../screens.css';
import './measurements.css';

interface NewDefinitionDraft {
	name: string;
	unit: string;
}

const BLANK_DRAFT: NewDefinitionDraft = { name: '', unit: 'kg' };

export function MeasurementTrackerScreen() {
	const repository = useLoggingRepository();
	const navigate = useNavigate();
	const [definitions, setDefinitions] = useState<MeasurementDefinition[] | null>(null);
	const [latest, setLatest] = useState<Record<string, { value: number; date: string }>>({});
	const [error, setError] = useState<string | null>(null);
	const [managing, setManaging] = useState(false);
	const [newDraft, setNewDraft] = useState<NewDefinitionDraft | null>(null);
	const [definitionPendingDelete, setDefinitionPendingDelete] =
		useState<MeasurementDefinition | null>(null);
	const [quickLogId, setQuickLogId] = useState<string | null>(null);
	const [quickLogValue, setQuickLogValue] = useState('');

	const reload = useCallback(() => {
		repository.listMeasurementDefinitions().then(async (all) => {
			setDefinitions(all);
			const enabled = all.filter((d) => !d.archived);
			const records = await Promise.all(
				enabled.map((d) => repository.listMeasurementRecords(d.id)),
			);
			const next: Record<string, { value: number; date: string }> = {};
			enabled.forEach((d, i) => {
				const sorted = [...records[i]].sort(byDateThenRecordedAt(-1));
				if (sorted[0]) next[d.id] = { value: sorted[0].value, date: sorted[0].date };
			});
			setLatest(next);
		});
	}, [repository]);

	useEffect(reload, [reload]);

	if (!definitions) return null;

	// Always reloads, on success or failure — a rejected update (e.g. a unit change once records or
	// a goal exist) must not leave the optimistic edit from onChange sitting in local state, since
	// the persisted definition never actually changed. Returns whether the action succeeded, so a
	// caller with its own draft/dialog state (handleCreate, handleQuickLog) can leave that open on
	// failure instead of closing as if the save had gone through.
	async function guarded(action: () => Promise<unknown>): Promise<boolean> {
		try {
			setError(null);
			await action();
			return true;
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			return false;
		} finally {
			reload();
		}
	}

	function saveDefinitionField(definition: MeasurementDefinition) {
		if (!definition.name.trim() || !definition.unit.trim()) {
			setError('Enter a name and unit.');
			reload();
			return;
		}
		guarded(() =>
			repository.updateMeasurementDefinition(
				definition.id,
				definition.name,
				definition.unit,
				definition.goal,
			),
		);
	}

	async function handleCreate() {
		if (!newDraft) return;
		const succeeded = await guarded(() =>
			repository.createMeasurementDefinition(newDraft.name, newDraft.unit),
		);
		if (succeeded) setNewDraft(null);
	}

	async function handleQuickLog(definitionId: string) {
		const value = Number(quickLogValue);
		if (!Number.isFinite(value)) {
			setError('Enter a numeric value.');
			return;
		}
		const succeeded = await guarded(() =>
			repository.createMeasurementRecord(definitionId, todayLocalDate(), value, undefined),
		);
		if (succeeded) {
			setQuickLogId(null);
			setQuickLogValue('');
		}
	}

	const enabled = definitions.filter((d) => !d.archived);

	return (
		<div className="screen-shell">
			<AppBar
				title="Measurements"
				size="medium"
				back={{ to: '/progress' }}
				actions={[
					{
						icon: managing ? 'check' : 'tune',
						label: managing ? 'Done managing' : 'Manage measurements',
						onClick: () => setManaging((v) => !v),
					},
				]}
			/>
			<div className="screen-shell__content measurement-tracker">
				{error && (
					<Banner icon="error" message={error} tone="attention" onDismiss={() => setError(null)} />
				)}

				{!managing && enabled.length === 0 && (
					<EmptyState
						headline="No measurements yet"
						body="Turn on a suggestion or add your own from Manage measurements."
						action={
							<Button variant="filled" icon="tune" onClick={() => setManaging(true)}>
								Manage measurements
							</Button>
						}
					/>
				)}

				{!managing && enabled.length > 0 && (
					<div className="measurement-tracker__list">
						{enabled.map((definition) => (
							<Surface
								key={definition.id}
								tone="container-low"
								radius="m"
								className="measurement-tracker__row"
							>
								<button
									type="button"
									className="measurement-tracker__row-main"
									onClick={() =>
										navigate({
											to: '/measurements/$definitionId',
											params: { definitionId: definition.id },
										})
									}
								>
									<span className="measurement-tracker__row-name">{definition.name}</span>
									<span className="measurement-tracker__row-latest">
										{latest[definition.id]
											? `${formatNumber(latest[definition.id].value)} ${definition.unit} · ${latest[definition.id].date}`
											: 'No records yet'}
									</span>
								</button>
								<IconButton
									icon="add"
									label={`Log ${definition.name}`}
									onClick={() => {
										setQuickLogId(definition.id);
										setQuickLogValue('');
									}}
								/>
							</Surface>
						))}
					</div>
				)}

				{managing && (
					<>
						<ReorderableList
							items={definitions}
							getKey={(d) => d.id}
							onReorder={(next) =>
								guarded(() => repository.reorderMeasurementDefinitions(next.map((d) => d.id)))
							}
							renderItem={(definition) => (
								<Surface
									tone="container-low"
									radius="m"
									className={`measurement-tracker__manage-row${definition.archived ? ' measurement-tracker__manage-row--archived' : ''}`}
								>
									<TextField
										label="Name"
										value={definition.name}
										onChange={(name) =>
											setDefinitions(
												definitions.map((d) => (d.id === definition.id ? { ...d, name } : d)),
											)
										}
										onBlur={() => saveDefinitionField(definition)}
									/>
									<TextField
										label="Unit"
										value={definition.unit}
										onChange={(unit) =>
											setDefinitions(
												definitions.map((d) => (d.id === definition.id ? { ...d, unit } : d)),
											)
										}
										onBlur={() => saveDefinitionField(definition)}
									/>
									<IconButton
										icon={definition.archived ? 'toggle_off' : 'toggle_on'}
										label={definition.archived ? 'Enable' : 'Disable'}
										onClick={() =>
											guarded(() =>
												repository.setMeasurementDefinitionArchived(
													definition.id,
													!definition.archived,
												),
											)
										}
									/>
									<IconButton
										icon="delete"
										label="Delete measurement"
										onClick={() => setDefinitionPendingDelete(definition)}
									/>
								</Surface>
							)}
						/>

						{newDraft ? (
							<Surface tone="container-low" radius="m" className="measurement-tracker__manage-row">
								<TextField
									label="New measurement name"
									value={newDraft.name}
									onChange={(name) => setNewDraft({ ...newDraft, name })}
									autoFocus
								/>
								<TextField
									label="Unit"
									value={newDraft.unit}
									onChange={(unit) => setNewDraft({ ...newDraft, unit })}
								/>
								<Button variant="text" onClick={() => setNewDraft(null)}>
									Cancel
								</Button>
								<Button
									variant="filled"
									disabled={!newDraft.name.trim() || !newDraft.unit.trim()}
									onClick={handleCreate}
								>
									Add
								</Button>
							</Surface>
						) : (
							<Button variant="tonal" icon="add" onClick={() => setNewDraft(BLANK_DRAFT)}>
								Add measurement
							</Button>
						)}
					</>
				)}
			</div>

			<Dialog
				open={quickLogId != null}
				onClose={() => setQuickLogId(null)}
				headline="Log a value"
				role="dialog"
				actions={
					<>
						<Button variant="text" onClick={() => setQuickLogId(null)}>
							Cancel
						</Button>
						<Button
							variant="filled"
							disabled={quickLogValue.trim() === ''}
							onClick={() => quickLogId && handleQuickLog(quickLogId)}
						>
							Save
						</Button>
					</>
				}
			>
				<TextField
					label={`Value (${definitions.find((d) => d.id === quickLogId)?.unit ?? ''})`}
					type="number"
					value={quickLogValue}
					onChange={setQuickLogValue}
					autoFocus
				/>
			</Dialog>

			<Dialog
				open={definitionPendingDelete != null}
				onClose={() => setDefinitionPendingDelete(null)}
				headline="Delete this measurement?"
				role="dialog"
				actions={
					<>
						<Button variant="text" onClick={() => setDefinitionPendingDelete(null)}>
							Cancel
						</Button>
						<Button
							variant="filled"
							tone="error"
							onClick={async () => {
								if (!definitionPendingDelete) return;
								await guarded(() =>
									repository.deleteMeasurementDefinition(definitionPendingDelete.id),
								);
								setDefinitionPendingDelete(null);
							}}
						>
							Delete
						</Button>
					</>
				}
			>
				<p>
					This permanently removes "{definitionPendingDelete?.name}" and every logged record for it.
					Disable it instead to keep the history.
				</p>
			</Dialog>
		</div>
	);
}
