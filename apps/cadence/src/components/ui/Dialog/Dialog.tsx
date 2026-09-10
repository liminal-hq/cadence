// Centred scrim + sheet shell for confirmations, distinct from the bottom-anchored BottomSheet
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
	/** Defaults to the interruptive 'alertdialog' semantics SetNoteScreen's existing dialog
	 *  uses; pass 'dialog' for a plain, non-warning confirmation. */
	role?: 'alertdialog' | 'dialog';
}

const FOCUSABLE_SELECTOR =
	'button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function Dialog({
	open,
	onClose,
	headline,
	ariaLabel,
	children,
	actions,
	role = 'alertdialog',
}: DialogProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const previouslyFocused = useRef<HTMLElement | null>(null);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => {
		if (!open) return;

		previouslyFocused.current = document.activeElement as HTMLElement | null;
		const panel = panelRef.current;
		const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
		(focusable?.[0] ?? panel)?.focus();

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				onCloseRef.current();
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
		// Deliberately keyed on `open` alone: onClose is read via a ref so a caller passing a
		// fresh closure each render (the idiomatic `onClose={() => setOpen(false)}`) doesn't
		// re-run this effect — and re-capturing/re-focusing — on every unrelated rerender
		// while the dialog is already open.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	if (!open) return null;

	return createPortal(
		<div className="ui-dialog__scrim" onClick={onClose}>
			<div
				ref={panelRef}
				className="ui-dialog"
				role={role}
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
