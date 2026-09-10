// M3 Chip — assist (static action), filter (selectable), input (dismissible via a trailing
// ✕). Geometry from material-web's _md-comp-assist-chip.scss/_md-comp-filter-chip.scss.
// Input chips render as a wrapper + two sibling <button>s (body + remove) rather than a
// button-inside-a-button, matching the pattern already used for SetRow/RestTimerBar.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { MouseEventHandler } from 'react';
import './Chip.css';

export interface ChipProps {
	variant: 'assist' | 'filter' | 'input';
	label: string;
	icon?: string;
	selected?: boolean;
	size?: 'default' | 'small';
	onClick?: MouseEventHandler<HTMLButtonElement>;
	onRemove?: () => void;
}

export function Chip({
	variant,
	label,
	icon,
	selected = false,
	size = 'default',
	onClick,
	onRemove,
}: ChipProps) {
	const classes = [
		'ui-chip',
		`ui-chip--${variant}`,
		`ui-chip--size-${size}`,
		selected ? 'ui-chip--selected' : '',
	]
		.filter(Boolean)
		.join(' ');

	const iconEl = icon && (
		<span className="material-symbols-rounded ui-chip__icon" aria-hidden="true">
			{icon}
		</span>
	);

	if (variant === 'input' && onRemove) {
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
