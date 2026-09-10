// Route tree: a `/today|/history|/plan|/progress` tab layout (AppShell +
// bottom nav) and a sibling `/log/$scenario` route for Exercise logging,
// which renders its own DetailAppBar instead of the tab shell.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useState } from 'react';
import {
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	redirect,
} from '@tanstack/react-router';
import { TitleBar } from './components/TitleBar/TitleBar';
import { RouteStage } from './components/RouteStage/RouteStage';
import { TabsLayout } from './screens/TabsLayout';
import { TodayScreen } from './screens/TodayScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { PlanScreen } from './screens/PlanScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { ExerciseLoggingScreen } from './screens/ExerciseLoggingScreen';
import { resolvePlatform } from './platform';
import { SCENARIO_TO_WORKOUT_EXERCISE_ID, type Scenario } from './domain/seedData';
import './App.css';

function RootLayout() {
	const [{ platformType, isDesktop }] = useState(resolvePlatform);

	return (
		<div className="app-root">
			{isDesktop && <TitleBar platformType={platformType} />}
			<RouteStage>
				<Outlet />
			</RouteStage>
		</div>
	);
}

function isScenario(value: string): value is Scenario {
	return value in SCENARIO_TO_WORKOUT_EXERCISE_ID;
}

function LoggingRoute() {
	const { scenario } = logRoute.useParams();
	return <ExerciseLoggingScreen scenario={isScenario(scenario) ? scenario : 'sam-default'} />;
}

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/',
	beforeLoad: () => {
		throw redirect({ to: '/today' });
	},
});

const tabsLayoutRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: 'tabs-layout',
	component: TabsLayout,
});

const todayRoute = createRoute({
	getParentRoute: () => tabsLayoutRoute,
	path: '/today',
	component: TodayScreen,
});
const historyRoute = createRoute({
	getParentRoute: () => tabsLayoutRoute,
	path: '/history',
	component: HistoryScreen,
});
const planRoute = createRoute({
	getParentRoute: () => tabsLayoutRoute,
	path: '/plan',
	component: PlanScreen,
});
const progressRoute = createRoute({
	getParentRoute: () => tabsLayoutRoute,
	path: '/progress',
	component: ProgressScreen,
});

const logRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/log/$scenario',
	component: LoggingRoute,
});

const routeTree = rootRoute.addChildren([
	indexRoute,
	tabsLayoutRoute.addChildren([todayRoute, historyRoute, planRoute, progressRoute]),
	logRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}
