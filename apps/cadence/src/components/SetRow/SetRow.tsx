// One row of the read-only set list under the StepperCluster, purely presentational
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { IconButton } from '../ui/IconButton/IconButton';
import './SetRow.css';

export type SetRowState = 'completed' | 'loaded' | 'planned';

interface SetRowProps {
	order: number;
	state: SetRowState;
	primaryValueLabel: string;
	secondaryValueLabel: string;
	isRecord?: boolean;
	pendingSync?: boolean;
	hasNote?: boolean;
	onClick?: () => void;
	onOpenEditor?: () => void;
}

export function SetRow({
	order,
	state,
	primaryValueLabel,
	secondaryValueLabel,
	isRecord,
	pendingSync,
	hasNote,
	onClick,
	onOpenEditor,
}: SetRowProps) {
	const statusLabel =
		state === 'completed' ? (pendingSync ? 'completed, pending sync' : 'completed') : state;
	const rowLabel = [
		`Set ${order}`,
		statusLabel,
		primaryValueLabel,
		secondaryValueLabel,
		isRecord && 'record',
		hasNote && 'has a note',
		'tap to edit',
	]
		.filter(Boolean)
		.join(', ');

	return (
		<div className="set-row-wrapper">
			<button
				type="button"
				className={`set-row set-row--${state}`}
				onClick={onClick}
				aria-current={state === 'loaded' ? 'true' : undefined}
				aria-label={rowLabel}
			>
				<span className="set-row__order" aria-hidden="true">
					{order}
					{state === 'loaded' && <span className="set-row__order-caption">loaded</span>}
				</span>
				<span className="set-row__value" aria-hidden="true">
					{primaryValueLabel}
					{isRecord && (
						<span className="material-symbols-rounded is-filled set-row__record">trophy</span>
					)}
				</span>
				<span className="set-row__value" aria-hidden="true">
					{secondaryValueLabel}
					{hasNote && (
						<span className="material-symbols-rounded set-row__note-icon">sticky_note_2</span>
					)}
				</span>
				<span className="set-row__status" aria-hidden="true">
					{state === 'completed' ? (
						<span className="material-symbols-rounded is-filled set-row__check">check_circle</span>
					) : (
						<span className="material-symbols-rounded set-row__circle">circle</span>
					)}
					{pendingSync && <span className="set-row__pending-caption">Watch ↑</span>}
				</span>
			</button>
			{onOpenEditor && (
				<IconButton
					icon="more_vert"
					label={`Open the full editor for set ${order}`}
					size="small"
					onClick={onOpenEditor}
				/>
			)}
		</div>
	);
}
