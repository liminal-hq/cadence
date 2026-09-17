// Confirmation for abandoning a workout — shown regardless of whether sets are logged, since
// abandoning never discards them (SPEC.md 8.1: these states "do not lock history")
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Dialog } from '../components/ui/Dialog/Dialog';
import { Button } from '../components/ui/Button/Button';

interface AbandonWorkoutDialogProps {
	open: boolean;
	onClose: () => void;
	onConfirm: () => void;
}

export function AbandonWorkoutDialog({ open, onClose, onConfirm }: AbandonWorkoutDialogProps) {
	return (
		<Dialog
			open={open}
			onClose={onClose}
			headline="Abandon this workout?"
			actions={
				<>
					<Button variant="text" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="filled"
						tone="error"
						onClick={() => {
							onConfirm();
							onClose();
						}}
					>
						Abandon
					</Button>
				</>
			}
		>
			<p>
				Any sets you've logged stay in your history — abandoning just marks this workout as not
				finished. You can reopen it later from History.
			</p>
		</Dialog>
	);
}
