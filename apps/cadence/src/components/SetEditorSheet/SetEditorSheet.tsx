// P-15 Set editor -- the full bottom-sheet editor for a set, reached via a row's overflow
// action. Displayed unit is always canonical kg/km for now (no unit-preference setting exists
// yet); the design's "lb display" variant is deferred until Settings does
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useState } from 'react';
import { BottomSheet } from '../BottomSheet/BottomSheet';
import { formatClockTime, formatDurationSec, formatNumber } from '../../domain/format';
import type { Exercise, SetEntry } from '../../domain/types';
import './SetEditorSheet.css';

interface SetEditorSheetProps {
	set: SetEntry;
	exercise: Exercise;
	workoutLabel: string;
	onClose: () => void;
	onSave: (updated: SetEntry) => void;
	onDelete: () => void;
	onOpenNote: () => void;
	onOpenPlateCalculator?: (targetWeightKg: number) => void;
}

interface MetricCardProps {
	label: string;
	value: number | undefined;
	increment: number;
	onChange: (value: number) => void;
	format: (value: number) => string;
	invalid?: boolean;
	helper?: string;
}

function MetricCard({
	label,
	value,
	increment,
	onChange,
	format,
	invalid,
	helper,
}: MetricCardProps) {
	return (
		<div className={`set-editor-sheet__metric-card ${invalid ? 'is-invalid' : ''}`}>
			<span className="set-editor-sheet__metric-label">{label}</span>
			<div className="set-editor-sheet__metric-stepper">
				<button
					type="button"
					aria-label={`Decrease ${label}`}
					onClick={() => onChange(Math.max(0, (value ?? 0) - increment))}
				>
					<span className="material-symbols-rounded">remove</span>
				</button>
				<span className="set-editor-sheet__metric-value">
					{value === undefined ? '—' : format(value)}
				</span>
				<button
					type="button"
					aria-label={`Increase ${label}`}
					onClick={() => onChange((value ?? 0) + increment)}
				>
					<span className="material-symbols-rounded">add</span>
				</button>
			</div>
			{helper && <span className="set-editor-sheet__metric-helper">{helper}</span>}
			{invalid && (
				<span className="set-editor-sheet__metric-error">
					<span className="material-symbols-rounded">error</span>
					Enter a time, or leave blank
				</span>
			)}
		</div>
	);
}

export function SetEditorSheet({
	set,
	exercise,
	workoutLabel,
	onClose,
	onSave,
	onDelete,
	onOpenNote,
	onOpenPlateCalculator,
}: SetEditorSheetProps) {
	const isWeightReps = exercise.metricProfile === 'weight-reps';
	const [showDraftBanner, setShowDraftBanner] = useState(
		!isWeightReps && set.durationSec === undefined,
	);
	// Staged locally and only committed via onSave from Update/Save planned/Complete now --
	// Cancel, the X close button, and the scrim/Escape (BottomSheet) all just discard this
	// draft, matching what those actions imply rather than having already persisted every
	// keystroke.
	const [draft, setDraft] = useState<SetEntry>(set);

	const durationInvalid =
		!isWeightReps && draft.distanceKm !== undefined && draft.durationSec === undefined;

	const setCompleted = () =>
		setDraft((d) => ({ ...d, status: 'completed', completedAt: new Date().toISOString() }));
	const setPlanned = () => setDraft((d) => ({ ...d, status: 'planned', completedAt: undefined }));
	const commitAndClose = () => {
		onSave(draft);
		onClose();
	};

	return (
		<BottomSheet onClose={onClose} ariaLabel={`Edit set ${set.order}`}>
			{showDraftBanner && (
				<div className="set-editor-sheet__draft-banner">
					<span className="material-symbols-rounded">restore</span>
					<span>Draft restored · not logged</span>
					<button type="button" onClick={() => setShowDraftBanner(false)}>
						Discard
					</button>
				</div>
			)}

			<div className="set-editor-sheet__header">
				<div>
					<div className="set-editor-sheet__title">
						Set {set.order} · {exercise.name}
					</div>
					<div className="set-editor-sheet__subtitle">
						{workoutLabel}
						{draft.status === 'completed' &&
							draft.completedAt &&
							` · completed ${formatClockTime(draft.completedAt)}`}
					</div>
				</div>
				<button
					type="button"
					className="set-editor-sheet__close"
					aria-label="Close"
					onClick={onClose}
				>
					<span className="material-symbols-rounded">close</span>
				</button>
			</div>

			<div className="set-editor-sheet__metrics">
				{isWeightReps ? (
					<>
						<MetricCard
							label="Weight · kg"
							value={draft.weightKg}
							increment={exercise.weightIncrementKg ?? 2.5}
							format={formatNumber}
							onChange={(weightKg) => setDraft((d) => ({ ...d, weightKg }))}
						/>
						<MetricCard
							label="Reps"
							value={draft.reps}
							increment={exercise.repsIncrement ?? 1}
							format={formatNumber}
							onChange={(reps) => setDraft((d) => ({ ...d, reps }))}
							helper={
								draft.isRecord
									? `🏆 Rep record at ${formatNumber(draft.weightKg ?? 0)} kg`
									: undefined
							}
						/>
					</>
				) : (
					<>
						<MetricCard
							label="Distance · km"
							value={draft.distanceKm}
							increment={exercise.distanceIncrementKm ?? 0.1}
							format={(v) => v.toFixed(1)}
							onChange={(distanceKm) => setDraft((d) => ({ ...d, distanceKm }))}
						/>
						<MetricCard
							label="Duration · mm:ss"
							value={draft.durationSec}
							increment={exercise.durationIncrementSec ?? 10}
							format={formatDurationSec}
							onChange={(durationSec) => setDraft((d) => ({ ...d, durationSec }))}
							invalid={durationInvalid}
						/>
					</>
				)}
			</div>

			{!isWeightReps && (
				<div className="set-editor-sheet__derived">
					<span>Pace — /km</span>
					<span>Speed — km/h</span>
					<span className="set-editor-sheet__derived-caption">calculated once both are set</span>
				</div>
			)}

			<div className="set-editor-sheet__chips">
				{isWeightReps && (
					<button
						type="button"
						className="set-editor-sheet__chip"
						onClick={() => onOpenPlateCalculator?.(draft.weightKg ?? 0)}
					>
						<span className="material-symbols-rounded">calculate</span>
						Plates
					</button>
				)}
			</div>

			<div className="set-editor-sheet__segmented">
				<button
					type="button"
					className={draft.status === 'planned' ? 'is-active' : ''}
					onClick={setPlanned}
				>
					<span className="material-symbols-rounded">circle</span>
					Planned
				</button>
				<button
					type="button"
					className={draft.status === 'completed' ? 'is-active' : ''}
					onClick={setCompleted}
					disabled={durationInvalid}
				>
					<span className="material-symbols-rounded is-filled">check_circle</span>
					{draft.status === 'completed' && draft.completedAt
						? `Completed ${formatClockTime(draft.completedAt)}`
						: 'Complete now'}
				</button>
			</div>

			<button type="button" className="set-editor-sheet__note-row" onClick={onOpenNote}>
				<span className="material-symbols-rounded">notes</span>
				<span className="set-editor-sheet__note-text">
					<span className="set-editor-sheet__note-label">Set note</span>
					<span className="set-editor-sheet__note-preview">{set.note || 'Add a set note'}</span>
				</span>
				<span className="material-symbols-rounded">chevron_right</span>
			</button>

			<div className="set-editor-sheet__footer">
				<button
					type="button"
					className="set-editor-sheet__delete"
					onClick={() => {
						onDelete();
						onClose();
					}}
				>
					<span className="material-symbols-rounded">delete</span>
					Delete set
				</button>
				<div className="set-editor-sheet__footer-actions">
					<button type="button" className="set-editor-sheet__cancel" onClick={onClose}>
						Cancel
					</button>
					<button
						type="button"
						className="set-editor-sheet__update"
						onClick={commitAndClose}
						disabled={durationInvalid}
					>
						{draft.status === 'completed' ? 'Update' : 'Save planned'}
					</button>
				</div>
			</div>
		</BottomSheet>
	);
}
