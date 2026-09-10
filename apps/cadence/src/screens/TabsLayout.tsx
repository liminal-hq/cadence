// Layout for the four tab-root routes: derives AppShell's title/subtitle/
// activeDestination from the current route and wires destination changes
// to the router, instead of App.tsx's old useState. AppShell/BottomNav
// themselves are unchanged — they only ever see props and a callback.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { AppShell } from '../components/AppShell/AppShell';
import type { Destination } from '../components/AppShell/BottomNav';
import type { AppBarAction } from '../components/ui/AppBar/AppBar';

const PATH_TO_DESTINATION: Record<string, Destination> = {
	'/today': 'today',
	'/history': 'history',
	'/plan': 'plan',
	'/progress': 'progress',
};

const SCREEN_TITLES: Record<Destination, string> = {
	today: 'Today',
	history: 'History',
	plan: 'Plan',
	progress: 'Progress',
};

/** Per-tab top-bar actions. History's settings icon is real ahead of History's own screen
 *  (SPEC.md P-40) landing, so the Settings hub has a working entry point before then; the
 *  others stay unwired until each destination's own screen lands. */
function useScreenActions(): Record<Destination, AppBarAction[] | undefined> {
	const navigate = useNavigate();
	return useMemo(
		() => ({
			today: undefined,
			history: [
				{ icon: 'settings', label: 'Settings', onClick: () => navigate({ to: '/settings' }) },
			],
			plan: undefined,
			progress: undefined,
		}),
		[navigate],
	);
}

const TODAY_LABEL = new Intl.DateTimeFormat('en-CA', {
	weekday: 'short',
	day: 'numeric',
	month: 'short',
}).format(new Date());

export function TabsLayout() {
	const location = useLocation();
	const navigate = useNavigate();
	const destination = PATH_TO_DESTINATION[location.pathname] ?? 'today';
	const screenActions = useScreenActions();

	return (
		<AppShell
			title={SCREEN_TITLES[destination]}
			subtitle={destination === 'today' ? TODAY_LABEL : undefined}
			topBarActions={screenActions[destination]}
			activeDestination={destination}
			onDestinationChange={(next) => navigate({ to: `/${next}` })}
		>
			<Outlet />
		</AppShell>
	);
}
