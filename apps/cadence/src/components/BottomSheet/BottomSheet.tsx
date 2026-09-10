// Generic scrim + rounded-top sheet shell, shared by the Set editor, the expanded rest timer,
// and the plate calculator -- slides up on open, drags down to dismiss via the handle
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './BottomSheet.css';

interface BottomSheetProps {
	onClose: () => void;
	children: ReactNode;
	ariaLabel: string;
}

const EXIT_MS = 200;
const DISMISS_DISTANCE_PX = 120;
const DISMISS_VELOCITY_PX_MS = 0.5;

interface DragState {
	startY: number;
	startTime: number;
	lastY: number;
	lastTime: number;
}

export function BottomSheet({ onClose, children, ariaLabel }: BottomSheetProps) {
	const [entered, setEntered] = useState(false);
	const [closing, setClosing] = useState(false);
	const [dragY, setDragY] = useState(0);
	const [isDragging, setIsDragging] = useState(false);
	const dragState = useRef<DragState | null>(null);

	useEffect(() => {
		const frame = requestAnimationFrame(() => setEntered(true));
		return () => cancelAnimationFrame(frame);
	}, []);

	const requestClose = useCallback(() => {
		setClosing((already) => {
			if (already) return already;
			setTimeout(onClose, EXIT_MS);
			return true;
		});
	}, [onClose]);

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') requestClose();
		}
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [requestClose]);

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		event.currentTarget.setPointerCapture(event.pointerId);
		const now = performance.now();
		dragState.current = {
			startY: event.clientY,
			startTime: now,
			lastY: event.clientY,
			lastTime: now,
		};
		setIsDragging(true);
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		if (!dragState.current) return;
		dragState.current.lastY = event.clientY;
		dragState.current.lastTime = performance.now();
		setDragY(Math.max(0, event.clientY - dragState.current.startY));
	};

	const handlePointerUp = () => {
		const drag = dragState.current;
		dragState.current = null;
		setIsDragging(false);
		if (!drag) return;

		const distance = Math.max(0, drag.lastY - drag.startY);
		const elapsedMs = Math.max(1, drag.lastTime - drag.startTime);
		const velocity = distance / elapsedMs;
		if (distance > DISMISS_DISTANCE_PX || velocity > DISMISS_VELOCITY_PX_MS) {
			requestClose();
		} else {
			setDragY(0);
		}
	};

	const transform = closing || !entered ? 'translateY(100%)' : `translateY(${dragY}px)`;

	return createPortal(
		<div
			className={`bottom-sheet__scrim${entered && !closing ? ' bottom-sheet__scrim--visible' : ''}`}
			onClick={requestClose}
		>
			<div
				className={`bottom-sheet${isDragging ? ' bottom-sheet--dragging' : ''}`}
				role="dialog"
				aria-modal="true"
				aria-label={ariaLabel}
				onClick={(e) => e.stopPropagation()}
				style={{ transform }}
			>
				<div
					className="bottom-sheet__handle-hitarea"
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerCancel={handlePointerUp}
				>
					<div className="bottom-sheet__handle" />
				</div>
				{children}
			</div>
		</div>,
		document.body,
	);
}
