// The one destructive action in P-62 built functionally real against the mock repository —
// a type-to-confirm text field gates the delete button, a pattern new to this screen set
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import { Button } from '../../components/ui/Button/Button';
import './DeleteAllHistoryDialog.css';

const CONFIRM_WORD = 'DELETE';

interface DeleteAllHistoryDialogProps {
	open: boolean;
	onClose: () => void;
	onConfirm: () => void;
	workoutCount: number;
	setCount: number;
}

export function DeleteAllHistoryDialog({
	open,
	onClose,
	onConfirm,
	workoutCount,
	setCount,
}: DeleteAllHistoryDialogProps) {
	const [confirmText, setConfirmText] = useState('');

	useEffect(() => {
		if (!open) setConfirmText('');
	}, [open]);

	const canDelete = confirmText === CONFIRM_WORD;

	return (
		<Dialog
			open={open}
			onClose={onClose}
			headline="Delete all history?"
			actions={
				<>
					<Button variant="text" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="filled"
						tone="error"
						disabled={!canDelete}
						onClick={() => {
							onConfirm();
							onClose();
						}}
					>
						Delete
					</Button>
				</>
			}
		>
			<p className="delete-all-dialog__body">
				This permanently removes {workoutCount} workout{workoutCount === 1 ? '' : 's'} and{' '}
				{setCount} set{setCount === 1 ? '' : 's'}.
			</p>
			<p className="delete-all-dialog__body">
				Exercises, categories, barbells, and settings are kept, along with any backups you've made.
			</p>
			<label className="delete-all-dialog__label" htmlFor="delete-all-confirm">
				Type {CONFIRM_WORD} to confirm
			</label>
			<input
				id="delete-all-confirm"
				className="delete-all-dialog__input"
				value={confirmText}
				onChange={(event) => setConfirmText(event.target.value)}
				autoComplete="off"
				autoFocus
			/>
		</Dialog>
	);
}
