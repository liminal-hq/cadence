// M3 top app bar -- screen title plus calendar/settings actions.
// Shared between desktop and mobile; the only chrome above it on desktop
// is the platform TitleBar.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import './TopAppBar.css';

interface TopAppBarProps {
	title: string;
	subtitle?: string;
}

export function TopAppBar({ title, subtitle }: TopAppBarProps) {
	return (
		<header className="top-app-bar">
			<div className="top-app-bar__title">
				{title}
				{subtitle && <span className="top-app-bar__subtitle">{subtitle}</span>}
			</div>
			<button className="top-app-bar__action" aria-label="Calendar">
				<span className="material-symbols-rounded">calendar_month</span>
			</button>
			<button className="top-app-bar__action" aria-label="Settings">
				<span className="material-symbols-rounded">settings</span>
			</button>
		</header>
	);
}
