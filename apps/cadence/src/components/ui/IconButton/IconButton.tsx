// M3 icon button — standard, tonal, and filled variants across 5 sizes, 2 of them Cadence-specific
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, MouseEventHandler } from 'react';
import { classNames } from '../classNames';
import './IconButton.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	icon: string;
	label: string;
	variant?: 'standard' | 'tonal' | 'filled';
	size?: 'small' | 'medium' | 'default' | 'large' | 'xl';
	/** Renders the Material Symbol in its filled (FILL 1) style, e.g. a solid play/pause glyph. */
	iconFilled?: boolean;
	disabled?: boolean;
	onClick?: MouseEventHandler<HTMLButtonElement>;
}

// Forwards its ref to the native button — dnd-kit's `setActivatorNodeRef` needs a real DOM node for a drag-handle IconButton, so keyboard focus restores to the handle itself after a drop/cancel rather than wherever the row's own `setNodeRef` points.
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
	{
		icon,
		label,
		variant = 'standard',
		size = 'default',
		iconFilled = false,
		disabled = false,
		onClick,
		className,
		// Spread onto the native button — dnd-kit's `listeners`/`attributes` (onPointerDown, onKeyDown, tabIndex, role, aria-describedby, etc.) need to land on the real DOM element for a drag-handle IconButton to actually be draggable.
		...rest
	},
	ref,
) {
	return (
		<button
			ref={ref}
			type="button"
			className={classNames(
				'ui-icon-button',
				`ui-icon-button--${variant}`,
				`ui-icon-button--size-${size}`,
				className,
			)}
			aria-label={label}
			disabled={disabled}
			onClick={onClick}
			{...rest}
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
});
