// The pinned "Preferred direction" fixed stepper cluster: steps between sets with chevrons,
// edits the loaded set's two metric fields, and commits with "Log set N"
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Button } from '../ui/Button/Button';
import { IconButton } from '../ui/IconButton/IconButton';
import './StepperCluster.css';

export interface StepperField {
	label: string;
	value: number | undefined;
	increment: number;
	onChange: (value: number) => void;
	formatValue?: (value: number) => string;
}

interface StepperClusterProps {
	setPositionLabel: string;
	lastTimeCaption?: string;
	todayNoteLabel?: string;
	primary: StepperField;
	secondary: StepperField;
	onPrev?: () => void;
	onNext?: () => void;
	canPrev: boolean;
	canNext: boolean;
	onLog: () => void;
	logLabel: string;
	logDisabled: boolean;
}

function Stepper({ field }: { field: StepperField }) {
	const display = field.value === undefined ? '—' : (field.formatValue ?? String)(field.value);

	return (
		<div className="stepper-cluster__field">
			<IconButton
				icon="remove"
				label={`Decrease ${field.label}`}
				variant="tonal"
				size="medium"
				onClick={() => field.onChange(Math.max(0, (field.value ?? 0) - field.increment))}
			/>
			<div className="stepper-cluster__value">
				<span>{display}</span>
				<span className="stepper-cluster__unit">{field.label}</span>
			</div>
			<IconButton
				icon="add"
				label={`Increase ${field.label}`}
				variant="tonal"
				size="medium"
				onClick={() => field.onChange((field.value ?? 0) + field.increment)}
			/>
		</div>
	);
}

export function StepperCluster({
	setPositionLabel,
	lastTimeCaption,
	todayNoteLabel,
	primary,
	secondary,
	onPrev,
	onNext,
	canPrev,
	canNext,
	onLog,
	logLabel,
	logDisabled,
}: StepperClusterProps) {
	return (
		<div className="stepper-cluster">
			<div className="stepper-cluster__header">
				<IconButton
					icon="chevron_left"
					label="Previous set"
					size="small"
					disabled={!canPrev}
					onClick={onPrev}
				/>
				<span className="stepper-cluster__set-position">{setPositionLabel}</span>
				<IconButton
					icon="chevron_right"
					label="Next set"
					size="small"
					disabled={!canNext}
					onClick={onNext}
				/>
				{lastTimeCaption && <span className="stepper-cluster__last-time">{lastTimeCaption}</span>}
			</div>

			<div className="stepper-cluster__fields">
				<Stepper field={primary} />
				<Stepper field={secondary} />
			</div>

			{todayNoteLabel && (
				<div className="stepper-cluster__today-note">
					<span className="material-symbols-rounded">today</span>
					<span className="stepper-cluster__today-note-text">{todayNoteLabel}</span>
					<span className="material-symbols-rounded stepper-cluster__today-note-edit">edit</span>
				</div>
			)}

			<Button variant="filled" fullWidth icon="check" onClick={onLog} disabled={logDisabled}>
				{logLabel}
			</Button>
		</div>
	);
}
