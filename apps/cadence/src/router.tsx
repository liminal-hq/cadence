// Route tree: a `/today|/history|/plan|/progress` tab layout (AppShell +
// bottom nav), a sibling `/log/$scenario` route for Exercise logging, and a
// sibling `/settings/*` tree for the Settings hub and its sub-screens —
// none of the three share the tab shell, so each renders its own header.
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
import { SettingsHubScreen } from './screens/settings/SettingsHubScreen';
import { SettingsComingSoon } from './screens/settings/SettingsComingSoon';
import { UnitsSettingsScreen } from './screens/settings/UnitsSettingsScreen';
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

const settingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/settings',
	component: SettingsHubScreen,
});

/** Rows the Settings hub links to that don't have a real screen yet — each still resolves to a
 *  working destination, just not a finished one (same "wired but not built" pattern ComingSoon
 *  already established for the Plan/Progress tabs). */
function settingsStubRoute(path: string, screen: string) {
	return createRoute({
		getParentRoute: () => rootRoute,
		path,
		component: () => <SettingsComingSoon screen={screen} />,
	});
}

const settingsUnitsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/settings/units',
	component: UnitsSettingsScreen,
});
const settingsTimersRoute = settingsStubRoute('/settings/timers', 'Rest & workout timers');
const settings1rmFormulaRoute = settingsStubRoute('/settings/1rm-formula', '1RM formula');
const settingsPlatesRoute = settingsStubRoute('/settings/plates', 'Plates & barbells');
const settingsCategoriesRoute = settingsStubRoute('/settings/categories', 'Categories');
const settingsGraphsRoute = settingsStubRoute('/settings/graphs', 'Week start & graphs');
const settingsThemeRoute = settingsStubRoute('/settings/theme', 'Theme & wallpaper colours');
const settingsAccessibilityRoute = settingsStubRoute(
	'/settings/accessibility',
	'Motion, haptics & sound',
);
const settingsWatchRoute = settingsStubRoute('/settings/watch', 'Wear OS watch');
const settingsHealthConnectRoute = settingsStubRoute('/settings/health-connect', 'Health Connect');
const settingsNotificationsRoute = settingsStubRoute(
	'/settings/notifications',
	'Notifications, widgets & shortcuts',
);
const settingsDataRoute = settingsStubRoute('/settings/data', 'Backup & data');
const settingsDiagnosticsRoute = settingsStubRoute(
	'/settings/diagnostics',
	'Diagnostics & experiments',
);

const routeTree = rootRoute.addChildren([
	indexRoute,
	tabsLayoutRoute.addChildren([todayRoute, historyRoute, planRoute, progressRoute]),
	logRoute,
	settingsRoute,
	settingsUnitsRoute,
	settingsTimersRoute,
	settings1rmFormulaRoute,
	settingsPlatesRoute,
	settingsCategoriesRoute,
	settingsGraphsRoute,
	settingsThemeRoute,
	settingsAccessibilityRoute,
	settingsWatchRoute,
	settingsHealthConnectRoute,
	settingsNotificationsRoute,
	settingsDataRoute,
	settingsDiagnosticsRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}
