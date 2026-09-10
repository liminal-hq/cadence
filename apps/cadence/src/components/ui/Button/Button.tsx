// M3 Button — filled, tonal, outlined, and text variants, geometry from material-web's button token files
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { MouseEventHandler, ReactNode } from 'react';
import { classNames } from '../classNames';
import './Button.css';

export interface ButtonProps {
	variant: 'filled' | 'tonal' | 'outlined' | 'text';
	children: ReactNode;
	/** 'default' is M3's 40px; 'large' (52px) is a Cadence-specific extension for hero CTAs. */
	size?: 'default' | 'large';
	fullWidth?: boolean;
	tone?: 'default' | 'error';
	icon?: string;
	iconPosition?: 'leading' | 'trailing';
	disabled?: boolean;
	onClick?: MouseEventHandler<HTMLButtonElement>;
	type?: 'button' | 'submit';
}

export function Button({
	variant,
	children,
	size = 'default',
	fullWidth = false,
	tone = 'default',
	icon,
	iconPosition = 'leading',
	disabled = false,
	onClick,
	type = 'button',
}: ButtonProps) {
	const classes = classNames(
		'ui-button',
		`ui-button--${variant}`,
		`ui-button--size-${size}`,
		tone === 'error' && 'ui-button--tone-error',
		fullWidth && 'ui-button--full-width',
		icon && `ui-button--icon-${iconPosition}`,
	);

	const iconEl = icon && (
		<span className="material-symbols-rounded ui-button__icon" aria-hidden="true">
			{icon}
		</span>
	);

	return (
		<button type={type} className={classes} disabled={disabled} onClick={onClick}>
			{icon && iconPosition === 'leading' && iconEl}
			<span className="ui-button__label">{children}</span>
			{icon && iconPosition === 'trailing' && iconEl}
		</button>
	);
}
