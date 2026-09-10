// M3 Chip — assist, filter, and input variants, geometry from material-web's chip token files
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { MouseEventHandler } from 'react';
import { classNames } from '../classNames';
import './Chip.css';

interface ChipBaseProps {
	label: string;
	icon?: string;
	size?: 'default' | 'small';
	onClick?: MouseEventHandler<HTMLButtonElement>;
}

export type ChipProps =
	| (ChipBaseProps & { variant: 'assist'; selected?: never; onRemove?: never })
	| (ChipBaseProps & { variant: 'filter'; selected?: boolean; onRemove?: never })
	// onRemove is required, not optional — an input chip with nothing wired to remove it
	// would otherwise silently render as an indistinguishable assist chip.
	| (ChipBaseProps & { variant: 'input'; selected?: never; onRemove: () => void });

export function Chip({
	variant,
	label,
	icon,
	selected = false,
	size = 'default',
	onClick,
	onRemove,
}: ChipProps) {
	const classes = classNames(
		'ui-chip',
		`ui-chip--${variant}`,
		`ui-chip--size-${size}`,
		selected && 'ui-chip--selected',
	);

	const iconEl = icon && (
		<span className="material-symbols-rounded ui-chip__icon" aria-hidden="true">
			{icon}
		</span>
	);

	if (variant === 'input') {
		return (
			<div className={`${classes} ui-chip--wrapper`}>
				<button type="button" className="ui-chip__body" onClick={onClick} disabled={!onClick}>
					{iconEl}
					<span className="ui-chip__label">{label}</span>
				</button>
				<button
					type="button"
					className="ui-chip__remove"
					aria-label={`Remove ${label}`}
					onClick={onRemove}
				>
					<span className="material-symbols-rounded" aria-hidden="true">
						close
					</span>
				</button>
			</div>
		);
	}

	return (
		<button
			type="button"
			className={classes}
			onClick={onClick}
			aria-pressed={variant === 'filter' ? selected : undefined}
		>
			{iconEl}
			<span className="ui-chip__label">{label}</span>
		</button>
	);
}
