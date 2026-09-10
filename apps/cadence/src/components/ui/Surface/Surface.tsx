// Minimal rounded-container wrapper — tone + radius only, no layout opinion. Not a
// Card/ListRow: row shapes stay composed from this plus Tag/Chip/text at the call site.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ReactNode } from 'react';
import './Surface.css';

export interface SurfaceProps {
	tone?: 'container-low' | 'container' | 'container-high' | 'container-highest';
	radius?: 'xs' | 's' | 'm' | 'l';
	dashed?: boolean;
	className?: string;
	children?: ReactNode;
}

export function Surface({
	tone = 'container',
	radius = 'm',
	dashed = false,
	className,
	children,
}: SurfaceProps) {
	const classes = [
		'ui-surface',
		`ui-surface--tone-${tone}`,
		`ui-surface--radius-${radius}`,
		dashed ? 'ui-surface--dashed' : '',
		className ?? '',
	]
		.filter(Boolean)
		.join(' ');

	return <div className={classes}>{children}</div>;
}
