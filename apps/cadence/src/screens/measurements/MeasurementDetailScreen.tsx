// P-50 Measurement detail and editor — graph/history for one measurement, add/edit/delete records, and edit the definition itself (name/unit/goal/enabled/order)
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
import { Surface } from '../../components/ui/Surface/Surface';
import { TextField } from '../../components/ui/TextField/TextField';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import { formatNumber, todayLocalDate } from '../../domain/format';
import { formatCalendarDateLabel } from '../history/historyDates';
import { LineChart } from '../history/LineChart';
import type { GraphPoint } from '../history/computeGraphPoints';
import type { MeasurementDefinition, MeasurementRecord } from '../../domain/types';
import '../screens.css';
import './measurements.css';

interface MeasurementDetailScreenProps {
	definitionId: string;
}

interface RecordDraft {
	date: string;
	value: string;
	note: string;
}

function blankDraft(): RecordDraft {
	return { date: todayLocalDate(), value: '', note: '' };
}

function isValidDate(date: string): boolean {
	return date.trim() !== '' && !Number.isNaN(new Date(`${date}T00:00:00`).getTime());
}

function draftFromRecord(record: MeasurementRecord): RecordDraft {
	return { date: record.date, value: String(record.value), note: record.note ?? '' };
}

interface DefinitionDraft {
	name: string;
	unit: string;
	goal: string;
}

export function MeasurementDetailScreen({ definitionId }: MeasurementDetailScreenProps) {
	const repository = useLoggingRepository();
	const navigate = useNavigate();
	const [definition, setDefinition] = useState<MeasurementDefinition | null>(null);
	const [records, setRecords] = useState<MeasurementRecord[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [recordDraft, setRecordDraft] = useState<RecordDraft | null>(null);
	const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
	const [recordPendingDelete, setRecordPendingDelete] = useState<MeasurementRecord | null>(null);
	const [definitionDraft, setDefinitionDraft] = useState<DefinitionDraft | null>(null);
	const [showTable, setShowTable] = useState(false);
	const [definitionPendingDelete, setDefinitionPendingDelete] = useState(false);

	const reload = useCallback(() => {
		repository.getMeasurementDefinition(definitionId).then(setDefinition);
		repository
			.listMeasurementRecords(definitionId)
			.then((all) => setRecords([...all].sort((a, b) => (a.date < b.date ? 1 : -1))));
	}, [repository, definitionId]);

	useEffect(reload, [reload]);

	if (!definition || !records) return null;

	async function guarded(action: () => Promise<unknown>) {
		try {
			setError(null);
			await action();
			reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	async function handleSaveRecord() {
		if (!recordDraft) return;
		if (!isValidDate(recordDraft.date)) {
			setError('Enter a valid date.');
			return;
		}
		const value = Number(recordDraft.value);
		if (!Number.isFinite(value)) {
			setError('Enter a numeric value.');
			return;
		}
		const note = recordDraft.note.trim() === '' ? undefined : recordDraft.note.trim();
		if (editingRecordId) {
			await guarded(() =>
				repository.updateMeasurementRecord(editingRecordId, recordDraft.date, value, note),
			);
		} else {
			await guarded(() =>
				repository.createMeasurementRecord(definitionId, recordDraft.date, value, note),
			);
		}
		setRecordDraft(null);
		setEditingRecordId(null);
	}

	async function handleSaveDefinition() {
		if (!definitionDraft) return;
		const goal = definitionDraft.goal.trim() === '' ? undefined : Number(definitionDraft.goal);
		if (goal != null && !Number.isFinite(goal)) {
			setError('Enter a numeric goal, or leave it blank.');
			return;
		}
		try {
			setError(null);
			await repository.updateMeasurementDefinition(
				definitionId,
				definitionDraft.name,
				definitionDraft.unit,
				goal,
			);
			reload();
			setDefinitionDraft(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	const points: GraphPoint[] = records
		.filter((r) => !recordPendingDelete || r.id !== recordPendingDelete.id)
		.map((r) => ({ date: r.date, value: r.value, setId: r.id }))
		.sort((a, b) => (a.date < b.date ? -1 : 1));

	return (
		<div className="screen-shell">
			<AppBar
				title={definition.name}
				subtitle={definition.archived ? `${definition.unit} · Archived` : definition.unit}
				size="medium"
				back={{ to: '/measurements' }}
				actions={[
					{
						icon: 'edit',
						label: 'Edit measurement',
						onClick: () =>
							setDefinitionDraft({
								name: definition.name,
								unit: definition.unit,
								goal: definition.goal != null ? String(definition.goal) : '',
							}),
					},
				]}
			/>
			<div className="screen-shell__content measurement-detail">
				{error && (
					<Banner icon="error" message={error} tone="attention" onDismiss={() => setError(null)} />
				)}

				{definitionDraft && (
					<Surface tone="container-low" radius="m" className="measurement-detail__form">
						<TextField
							label="Name"
							value={definitionDraft.name}
							onChange={(name) => setDefinitionDraft({ ...definitionDraft, name })}
						/>
						<TextField
							label="Unit"
							value={definitionDraft.unit}
							onChange={(unit) => setDefinitionDraft({ ...definitionDraft, unit })}
						/>
						<TextField
							label="Goal (optional)"
							type="number"
							value={definitionDraft.goal}
							onChange={(goal) => setDefinitionDraft({ ...definitionDraft, goal })}
						/>
						<div className="measurement-detail__form-actions">
							<Button variant="text" onClick={() => setDefinitionDraft(null)}>
								Cancel
							</Button>
							<Button
								variant="text"
								onClick={() =>
									guarded(() =>
										repository.setMeasurementDefinitionArchived(definitionId, !definition.archived),
									)
								}
							>
								{definition.archived ? 'Unarchive' : 'Archive'}
							</Button>
							<Button
								variant="text"
								tone="error"
								onClick={() => {
									setDefinitionDraft(null);
									setDefinitionPendingDelete(true);
								}}
							>
								Delete
							</Button>
							<Button
								variant="filled"
								disabled={!definitionDraft.name.trim() || !definitionDraft.unit.trim()}
								onClick={handleSaveDefinition}
							>
								Save
							</Button>
						</div>
					</Surface>
				)}

				{points.length === 0 ? (
					<EmptyState
						headline="No records yet"
						body="Log a value to start tracking this measurement."
						action={
							<Button variant="filled" icon="add" onClick={() => setRecordDraft(blankDraft())}>
								Log a value
							</Button>
						}
					/>
				) : (
					<>
						<LineChart points={points} onSelectPoint={() => {}} goalValue={definition.goal} />
						<Button variant="text" onClick={() => setShowTable((v) => !v)}>
							{showTable ? 'Hide table' : 'View as table'}
						</Button>
						{showTable && (
							<table className="measurement-detail__table">
								<caption className="ui-visually-hidden">{definition.name} over time</caption>
								<thead>
									<tr>
										<th scope="col">Date</th>
										<th scope="col">Value ({definition.unit})</th>
									</tr>
								</thead>
								<tbody>
									{points.map((point) => (
										<tr key={point.setId}>
											<td>{formatCalendarDateLabel(point.date)}</td>
											<td>{formatNumber(point.value)}</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</>
				)}

				<div className="measurement-detail__history">
					{records.map((record) => (
						<Surface
							key={record.id}
							tone="container-low"
							radius="m"
							className="measurement-detail__record"
						>
							<span className="measurement-detail__record-date">
								{formatCalendarDateLabel(record.date)}
							</span>
							<span className="measurement-detail__record-value">
								{formatNumber(record.value)} {definition.unit}
							</span>
							{record.note && (
								<span className="measurement-detail__record-note">{record.note}</span>
							)}
							<div className="measurement-detail__record-actions">
								<Button
									variant="text"
									onClick={() => {
										setEditingRecordId(record.id);
										setRecordDraft(draftFromRecord(record));
									}}
								>
									Edit
								</Button>
								<Button variant="text" tone="error" onClick={() => setRecordPendingDelete(record)}>
									Delete
								</Button>
							</div>
						</Surface>
					))}
					{points.length > 0 && !recordDraft && (
						<Button variant="tonal" icon="add" onClick={() => setRecordDraft(blankDraft())}>
							Log a value
						</Button>
					)}
				</div>

				{recordDraft && (
					<Surface tone="container-low" radius="m" className="measurement-detail__form">
						<TextField
							label="Date"
							type="date"
							value={recordDraft.date}
							onChange={(date) => setRecordDraft({ ...recordDraft, date })}
						/>
						<TextField
							label={`Value (${definition.unit})`}
							type="number"
							value={recordDraft.value}
							onChange={(value) => setRecordDraft({ ...recordDraft, value })}
							autoFocus
						/>
						<TextField
							label="Note"
							value={recordDraft.note}
							onChange={(note) => setRecordDraft({ ...recordDraft, note })}
						/>
						<div className="measurement-detail__form-actions">
							<Button
								variant="text"
								onClick={() => {
									setRecordDraft(null);
									setEditingRecordId(null);
								}}
							>
								Cancel
							</Button>
							<Button
								variant="filled"
								disabled={!recordDraft.value.trim() || !isValidDate(recordDraft.date)}
								onClick={handleSaveRecord}
							>
								Save
							</Button>
						</div>
					</Surface>
				)}
			</div>

			<Dialog
				open={recordPendingDelete != null}
				onClose={() => setRecordPendingDelete(null)}
				headline="Delete this record?"
				role="dialog"
				actions={
					<>
						<Button variant="text" onClick={() => setRecordPendingDelete(null)}>
							Cancel
						</Button>
						<Button
							variant="filled"
							tone="error"
							onClick={async () => {
								if (!recordPendingDelete) return;
								await guarded(() => repository.deleteMeasurementRecord(recordPendingDelete.id));
								setRecordPendingDelete(null);
							}}
						>
							Delete
						</Button>
					</>
				}
			>
				<p>
					This permanently removes the{' '}
					{recordPendingDelete && formatCalendarDateLabel(recordPendingDelete.date)} record.
				</p>
			</Dialog>

			<Dialog
				open={definitionPendingDelete}
				onClose={() => setDefinitionPendingDelete(false)}
				headline="Delete this measurement?"
				role="dialog"
				actions={
					<>
						<Button variant="text" onClick={() => setDefinitionPendingDelete(false)}>
							Cancel
						</Button>
						<Button
							variant="filled"
							tone="error"
							onClick={async () => {
								await guarded(() => repository.deleteMeasurementDefinition(definitionId));
								setDefinitionPendingDelete(false);
								navigate({ to: '/measurements' });
							}}
						>
							Delete
						</Button>
					</>
				}
			>
				<p>
					This permanently removes "{definition.name}" and every logged record for it. Archiving
					instead keeps the history — edit and archive it from here rather than deleting if you just
					want it out of the tracker.
				</p>
			</Dialog>
		</div>
	);
}
