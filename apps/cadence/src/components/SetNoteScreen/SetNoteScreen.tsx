// P-16 Set note, a full-screen text editor over the set editor sheet, with an
// unsaved-changes confirmation on dismiss
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useState } from 'react';
import { AppBar } from '../ui/AppBar/AppBar';
import { Button } from '../ui/Button/Button';
import { Chip } from '../ui/Chip/Chip';
import { Dialog } from '../ui/Dialog/Dialog';
import './SetNoteScreen.css';

const MAX_LENGTH = 500;
const TAGS = ['Pain / discomfort', 'Assisted', 'Equipment', 'Technique'];

interface SetNoteScreenProps {
	setSummary: string;
	initialNote: string;
	onSave: (note: string) => void;
	onRemove: () => void;
	onClose: () => void;
}

export function SetNoteScreen({
	setSummary,
	initialNote,
	onSave,
	onRemove,
	onClose,
}: SetNoteScreenProps) {
	const [draft, setDraft] = useState(initialNote);
	const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

	const hasUnsavedChanges = draft !== initialNote;

	const handleRequestClose = () => {
		if (hasUnsavedChanges) setShowUnsavedDialog(true);
		else onClose();
	};

	const handleSave = () => {
		onSave(draft);
		onClose();
	};

	const handleRemove = () => {
		// Clear the local draft and return immediately, the same as Delete set elsewhere —
		// otherwise the stale draft still holds the old text after `initialNote` becomes empty,
		// which both trips the unsaved-changes dialog and lets Save resurrect the removed note.
		setDraft('');
		onRemove();
		onClose();
	};

	const insertTag = (tag: string) => {
		if (draft.startsWith(tag)) return;
		setDraft((prev) => (prev ? `${tag} — ${prev}` : tag));
	};

	return (
		<div className="set-note-screen">
			<AppBar
				title="Note"
				subtitle={setSummary}
				size="medium"
				back={{ icon: 'close', label: 'Close', onClick: handleRequestClose }}
				trailingContent={
					<Button variant="filled" onClick={handleSave}>
						Save
					</Button>
				}
			/>

			<div className="set-note-screen__body">
				<textarea
					className="set-note-screen__field"
					value={draft}
					maxLength={MAX_LENGTH}
					aria-label={`Note for ${setSummary}, ${draft.length} of ${MAX_LENGTH} characters used`}
					onChange={(e) => setDraft(e.target.value)}
					autoFocus
				/>

				<div className="set-note-screen__meta">
					<span>Shown as a note glyph on the set row</span>
					<span>
						{draft.length} / {MAX_LENGTH}
					</span>
				</div>

				<div className="set-note-screen__tags">
					{TAGS.map((tag) => (
						<Chip key={tag} variant="assist" label={tag} onClick={() => insertTag(tag)} />
					))}
				</div>

				<div className="set-note-screen__remove">
					<Button variant="text" tone="error" icon="delete" onClick={handleRemove}>
						Remove note
					</Button>
				</div>
			</div>

			<Dialog
				open={showUnsavedDialog}
				onClose={() => setShowUnsavedDialog(false)}
				headline="Keep your changes?"
				actions={
					<>
						<Button
							variant="text"
							tone="error"
							onClick={() => {
								setShowUnsavedDialog(false);
								onClose();
							}}
						>
							Discard
						</Button>
						<Button variant="text" onClick={() => setShowUnsavedDialog(false)}>
							Keep
						</Button>
						<Button variant="filled" size="default" onClick={handleSave}>
							Save
						</Button>
					</>
				}
			>
				Unsaved edits to this note. The set is unaffected.
			</Dialog>
		</div>
	);
}
