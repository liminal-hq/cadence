// Generic scrim + rounded-top sheet shell, shared by the Set editor, the expanded rest timer,
// and the plate calculator
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './BottomSheet.css';

interface BottomSheetProps {
	onClose: () => void;
	children: ReactNode;
	ariaLabel: string;
}

export function BottomSheet({ onClose, children, ariaLabel }: BottomSheetProps) {
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') onClose();
		}
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [onClose]);

	return createPortal(
		<div className="bottom-sheet__scrim" onClick={onClose}>
			<div
				className="bottom-sheet"
				role="dialog"
				aria-modal="true"
				aria-label={ariaLabel}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="bottom-sheet__handle" />
				{children}
			</div>
		</div>,
		document.body,
	);
}
