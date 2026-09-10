// Centred scrim + sheet shell for confirmations — distinct from BottomSheet, which is
// bottom-anchored. Traps focus while open and restores it to the trigger on close, matching
// SetNoteScreen's existing unsaved-changes dialog semantics (role="alertdialog").
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Dialog.css';

export interface DialogProps {
	open: boolean;
	onClose: () => void;
	headline?: string;
	ariaLabel?: string;
	children: ReactNode;
	actions?: ReactNode;
}

const FOCUSABLE_SELECTOR =
	'button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onClose, headline, ariaLabel, children, actions }: DialogProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const previouslyFocused = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (!open) return;

		previouslyFocused.current = document.activeElement as HTMLElement | null;
		const panel = panelRef.current;
		const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
		(focusable?.[0] ?? panel)?.focus();

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				onClose();
				return;
			}
			if (event.key !== 'Tab' || !panel) return;

			const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
			if (nodes.length === 0) return;
			const first = nodes[0];
			const last = nodes[nodes.length - 1];

			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}

		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			previouslyFocused.current?.focus();
		};
	}, [open, onClose]);

	if (!open) return null;

	return createPortal(
		<div className="ui-dialog__scrim" onClick={onClose}>
			<div
				ref={panelRef}
				className="ui-dialog"
				role="alertdialog"
				aria-modal="true"
				aria-label={headline ? undefined : ariaLabel}
				aria-labelledby={headline ? 'ui-dialog-headline' : undefined}
				tabIndex={-1}
				onClick={(event) => event.stopPropagation()}
			>
				{headline && (
					<h2 id="ui-dialog-headline" className="ui-dialog__headline">
						{headline}
					</h2>
				)}
				<div className="ui-dialog__body">{children}</div>
				{actions && <div className="ui-dialog__actions">{actions}</div>}
			</div>
		</div>,
		document.body,
	);
}
