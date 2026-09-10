// M3 icon button — standard/tonal/filled, 5 sizes (2 are Cadence-specific: `large` keeps the
// 48px visible circle already shipped in the app bars rather than true M3's 40px default with
// an invisible hit-slop margin; `medium`/`xl` cover StepperCluster's steppers and
// RestTimerSheet's play/pause, which don't fit the M3 scale either).
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { MouseEventHandler } from 'react';
import './IconButton.css';

export interface IconButtonProps {
	icon: string;
	label: string;
	variant?: 'standard' | 'tonal' | 'filled';
	size?: 'small' | 'medium' | 'default' | 'large' | 'xl';
	disabled?: boolean;
	onClick?: MouseEventHandler<HTMLButtonElement>;
}

export function IconButton({
	icon,
	label,
	variant = 'standard',
	size = 'default',
	disabled = false,
	onClick,
}: IconButtonProps) {
	return (
		<button
			type="button"
			className={`ui-icon-button ui-icon-button--${variant} ui-icon-button--size-${size}`}
			aria-label={label}
			disabled={disabled}
			onClick={onClick}
		>
			<span className="material-symbols-rounded ui-icon-button__glyph" aria-hidden="true">
				{icon}
			</span>
		</button>
	);
}
