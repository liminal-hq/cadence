// Route tree: the `/today|/history|/plan|/progress` tab layout, the real workout/logging routes,
// the `/log/$scenario` demo adapter, and the `/settings/*` tree — none of the latter share the tab shell
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

// `/workout/$workoutId` (ActiveWorkoutScreen) and `/workout-exercise/$workoutExerciseId`
// (ExerciseLoggingScreen) are the real Quick-start/Workout-detail/Exercise-logging flow;
// `/log/$scenario` still resolves the three demo scenarios onto that same logging screen.

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
import { HistoryHubScreen } from './screens/history/HistoryHubScreen';
import { WorkoutDetailScreen } from './screens/history/WorkoutDetailScreen';
import { ExerciseDetailScreen } from './screens/history/ExerciseDetailScreen';
import { PlanScreen } from './screens/PlanScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { ExerciseLoggingScreen } from './screens/ExerciseLoggingScreen';
import { ActiveWorkoutScreen } from './screens/ActiveWorkoutScreen';
import { SettingsHubScreen } from './screens/settings/SettingsHubScreen';
import { SettingsComingSoon } from './screens/settings/SettingsComingSoon';
import { UnitsSettingsScreen } from './screens/settings/UnitsSettingsScreen';
import { TimerSettingsScreen } from './screens/settings/TimerSettingsScreen';
import { DataManagementScreen } from './screens/settings/DataManagementScreen';
import { WatchSyncScreen } from './screens/settings/WatchSyncScreen';
import { PlatesSettingsScreen } from './screens/settings/PlatesSettingsScreen';
import { BarbellEditorScreen } from './screens/settings/BarbellEditorScreen';
import { AccessibilitySettingsScreen } from './screens/settings/AccessibilitySettingsScreen';
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
	const { scenario: rawScenario } = logRoute.useParams();
	const scenario = isScenario(rawScenario) ? rawScenario : 'sam-default';
	return (
		<ExerciseLoggingScreen
			workoutExerciseId={SCENARIO_TO_WORKOUT_EXERCISE_ID[scenario]}
			backTo="/today"
			selfPath={`/log/${scenario}`}
			// Sam has a paired watch (SPEC's persona); Priya doesn't, and gets the first-workout
			// coach mark tour — both demo-only, since neither signal is tracked for a real workout.
			hasWatch={scenario !== 'priya-first-run'}
			showCoachMarks={scenario === 'priya-first-run'}
		/>
	);
}

function WorkoutExerciseRoute() {
	const { workoutExerciseId } = workoutExerciseRoute.useParams();
	return (
		<ExerciseLoggingScreen
			workoutExerciseId={workoutExerciseId}
			backTo="/today"
			backToOwnWorkout
			selfPath={`/workout-exercise/${workoutExerciseId}`}
		/>
	);
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
	component: HistoryHubScreen,
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

const workoutExerciseRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/workout-exercise/$workoutExerciseId',
	component: WorkoutExerciseRoute,
});

function ActiveWorkoutRoute() {
	const { workoutId } = activeWorkoutRoute.useParams();
	return <ActiveWorkoutScreen workoutId={workoutId} />;
}

const activeWorkoutRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/workout/$workoutId',
	component: ActiveWorkoutRoute,
});

function WorkoutDetailRoute() {
	const { workoutId } = workoutDetailRoute.useParams();
	return <WorkoutDetailScreen workoutId={workoutId} />;
}

const workoutDetailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/history/workout/$workoutId',
	component: WorkoutDetailRoute,
});

function ExerciseDetailRoute() {
	const { exerciseId } = exerciseDetailRoute.useParams();
	const { backTo } = exerciseDetailRoute.useSearch();
	return <ExerciseDetailScreen exerciseId={exerciseId} backTo={backTo} />;
}

const exerciseDetailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/exercise/$exerciseId',
	// `backTo` lets a caller with a more specific origin (Logging's own exercise screen) send
	// the user back there instead of the default History hub.
	validateSearch: (search: Record<string, unknown>): { backTo?: string } => ({
		backTo: typeof search.backTo === 'string' ? search.backTo : undefined,
	}),
	component: ExerciseDetailRoute,
});

const settingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/settings',
	component: SettingsHubScreen,
});

/** Rows the Settings hub links to that don't have a real screen yet — each still resolves to a
 *  working destination, just not a finished one (same "wired but not built" pattern ComingSoon
 *  already established for the Plan/Progress tabs). */
function settingsStubRoute<Path extends string>(path: Path, screen: string) {
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
const settingsTimersRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/settings/timers',
	component: TimerSettingsScreen,
});
const settingsTimerOverridesRoute = settingsStubRoute(
	'/settings/timers/overrides',
	'Per-exercise overrides',
);
const settings1rmFormulaRoute = settingsStubRoute('/settings/1rm-formula', '1RM formula');
const settingsPlatesRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/settings/plates',
	component: PlatesSettingsScreen,
});

function BarbellEditorRoute() {
	const { barbellId } = settingsPlatesEditorRoute.useParams();
	return <BarbellEditorScreen barbellId={barbellId} />;
}

const settingsPlatesEditorRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/settings/plates/$barbellId',
	component: BarbellEditorRoute,
});
const settingsCategoriesRoute = settingsStubRoute('/settings/categories', 'Categories');
const settingsGraphsRoute = settingsStubRoute('/settings/graphs', 'Week start & graphs');
const settingsThemeRoute = settingsStubRoute('/settings/theme', 'Theme & wallpaper colours');
const settingsAccessibilityRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/settings/accessibility',
	component: AccessibilitySettingsScreen,
});
const settingsWatchRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/settings/watch',
	component: WatchSyncScreen,
});
const settingsHealthConnectRoute = settingsStubRoute('/settings/health-connect', 'Health Connect');
const settingsNotificationsRoute = settingsStubRoute(
	'/settings/notifications',
	'Notifications, widgets & shortcuts',
);
const settingsDataRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/settings/data',
	component: DataManagementScreen,
});
const settingsDiagnosticsRoute = settingsStubRoute(
	'/settings/diagnostics',
	'Diagnostics & experiments',
);

const routeTree = rootRoute.addChildren([
	indexRoute,
	tabsLayoutRoute.addChildren([todayRoute, historyRoute, planRoute, progressRoute]),
	logRoute,
	workoutExerciseRoute,
	activeWorkoutRoute,
	workoutDetailRoute,
	exerciseDetailRoute,
	settingsRoute,
	settingsUnitsRoute,
	settingsTimersRoute,
	settingsTimerOverridesRoute,
	settings1rmFormulaRoute,
	settingsPlatesRoute,
	settingsPlatesEditorRoute,
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
