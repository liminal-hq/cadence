// P-16 Set note -- a full-screen text editor over the set editor sheet, with an
// unsaved-changes confirmation on dismiss
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useState } from 'react';
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
		// Clear the local draft and return immediately, the same as Delete set elsewhere --
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
			<header className="set-note-screen__app-bar">
				<button type="button" aria-label="Close" onClick={handleRequestClose}>
					<span className="material-symbols-rounded">close</span>
				</button>
				<div className="set-note-screen__titles">
					<span className="set-note-screen__title">Note</span>
					<span className="set-note-screen__subtitle">{setSummary}</span>
				</div>
				<button type="button" className="set-note-screen__save" onClick={handleSave}>
					Save
				</button>
			</header>

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
					<button
						type="button"
						key={tag}
						className="set-note-screen__tag"
						onClick={() => insertTag(tag)}
					>
						{tag}
					</button>
				))}
			</div>

			<button type="button" className="set-note-screen__remove" onClick={handleRemove}>
				<span className="material-symbols-rounded">delete</span>
				Remove note
			</button>

			{showUnsavedDialog && (
				<div className="set-note-screen__dialog-scrim">
					<div
						className="set-note-screen__dialog"
						role="alertdialog"
						aria-label="Keep your changes?"
					>
						<h2 className="set-note-screen__dialog-title">Keep your changes?</h2>
						<p className="set-note-screen__dialog-body">
							Unsaved edits to this note. The set is unaffected.
						</p>
						<div className="set-note-screen__dialog-actions">
							<button
								type="button"
								className="set-note-screen__dialog-discard"
								onClick={() => {
									setShowUnsavedDialog(false);
									onClose();
								}}
							>
								Discard
							</button>
							<button
								type="button"
								className="set-note-screen__dialog-keep"
								onClick={() => setShowUnsavedDialog(false)}
							>
								Keep
							</button>
							<button type="button" className="set-note-screen__dialog-save" onClick={handleSave}>
								Save
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
