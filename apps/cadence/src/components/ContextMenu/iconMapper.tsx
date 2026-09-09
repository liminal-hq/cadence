// Maps icon name strings to their rendered icon components
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import React from 'react';
import {
	WindowMinimizeIcon,
	WindowMaximizeIcon,
	WindowRestoreIcon,
	WindowCloseIcon,
} from '../Icons/Icons';

// Move icon for window dragging
const MoveIcon = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<polyline points="5 9 2 12 5 15"></polyline>
		<polyline points="9 5 12 2 15 5"></polyline>
		<polyline points="15 19 12 22 9 19"></polyline>
		<polyline points="19 9 22 12 19 15"></polyline>
		<line x1="2" y1="12" x2="22" y2="12"></line>
		<line x1="12" y1="2" x2="12" y2="22"></line>
	</svg>
);

export function getIconByName(name?: string): React.ReactNode {
	if (!name) return null;

	switch (name) {
		case 'WindowRestoreIcon':
			return <WindowRestoreIcon />;
		case 'WindowMaximizeIcon':
			return <WindowMaximizeIcon />;
		case 'WindowMinimizeIcon':
			return <WindowMinimizeIcon />;
		case 'WindowCloseIcon':
			return <WindowCloseIcon />;
		case 'MoveIcon':
			return <MoveIcon />;
		default:
			return null;
	}
}
