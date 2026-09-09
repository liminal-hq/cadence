// Shared app shell: top app bar, scrollable content, bottom navigation.
// Identical on desktop and mobile -- the platform TitleBar (desktop only)
// renders outside this component.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ReactNode } from 'react';
import { TopAppBar } from './TopAppBar';
import { BottomNav, type Destination } from './BottomNav';
import './AppShell.css';

interface AppShellProps {
	title: string;
	subtitle?: string;
	activeDestination: Destination;
	onDestinationChange: (destination: Destination) => void;
	children: ReactNode;
}

export function AppShell({
	title,
	subtitle,
	activeDestination,
	onDestinationChange,
	children,
}: AppShellProps) {
	return (
		<div className="app-shell">
			<TopAppBar title={title} subtitle={subtitle} />
			<main className="app-shell__content">{children}</main>
			<BottomNav active={activeDestination} onChange={onDestinationChange} />
		</div>
	);
}
