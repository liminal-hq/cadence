// Root component: the desktop title bar (when applicable) plus the shared
// app shell wrapping whichever of the four primary destinations is active.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useState } from 'react';
import { TitleBar } from './components/TitleBar/TitleBar';
import { AppShell } from './components/AppShell/AppShell';
import type { Destination } from './components/AppShell/BottomNav';
import { TodayScreen } from './screens/TodayScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { PlanScreen } from './screens/PlanScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { resolvePlatform } from './platform';
import './App.css';

const TODAY_LABEL = new Intl.DateTimeFormat('en-CA', {
	weekday: 'short',
	day: 'numeric',
	month: 'short',
}).format(new Date());

const SCREEN_TITLES: Record<Destination, string> = {
	today: 'Today',
	history: 'History',
	plan: 'Plan',
	progress: 'Progress',
};

export function App() {
	const [destination, setDestination] = useState<Destination>('today');
	const [{ platformType, isDesktop }] = useState(resolvePlatform);

	return (
		<div className="app-root">
			{isDesktop && <TitleBar platformType={platformType} />}
			<AppShell
				title={SCREEN_TITLES[destination]}
				subtitle={destination === 'today' ? TODAY_LABEL : undefined}
				activeDestination={destination}
				onDestinationChange={setDestination}
			>
				{destination === 'today' && <TodayScreen />}
				{destination === 'history' && <HistoryScreen />}
				{destination === 'plan' && <PlanScreen />}
				{destination === 'progress' && <ProgressScreen />}
			</AppShell>
		</div>
	);
}
