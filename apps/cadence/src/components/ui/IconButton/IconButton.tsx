// M3 icon button — standard, tonal, and filled variants across 5 sizes, 2 of them Cadence-specific
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { MouseEventHandler } from 'react';
import { classNames } from '../classNames';
import './IconButton.css';

export interface IconButtonProps {
	icon: string;
	label: string;
	variant?: 'standard' | 'tonal' | 'filled';
	size?: 'small' | 'medium' | 'default' | 'large' | 'xl';
	/** Renders the Material Symbol in its filled (FILL 1) style, e.g. a solid play/pause glyph. */
	iconFilled?: boolean;
	disabled?: boolean;
	onClick?: MouseEventHandler<HTMLButtonElement>;
}

export function IconButton({
	icon,
	label,
	variant = 'standard',
	size = 'default',
	iconFilled = false,
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
			<span
				className={classNames(
					'material-symbols-rounded',
					'ui-icon-button__glyph',
					iconFilled && 'is-filled',
				)}
				aria-hidden="true"
			>
				{icon}
			</span>
		</button>
	);
}
