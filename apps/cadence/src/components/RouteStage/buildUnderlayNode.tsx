// What a route renders, given only its path -- used to build RouteStage's predictive-back underlay
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ReactNode } from 'react';
import type { AnyRouter } from '@tanstack/react-router';
import { TabsChrome } from '../../screens/TabsLayout';
import { TodayScreen } from '../../screens/TodayScreen';
import { HistoryHubScreen } from '../../screens/history/HistoryHubScreen';
import { WorkoutDetailScreen } from '../../screens/history/WorkoutDetailScreen';
import { ExerciseDetailScreen } from '../../screens/history/ExerciseDetailScreen';
import { PlanScreen } from '../../screens/PlanScreen';
import { ProgressScreen } from '../../screens/ProgressScreen';
import { ExerciseLoggingScreen } from '../../screens/ExerciseLoggingScreen';
import { ActiveWorkoutScreen } from '../../screens/ActiveWorkoutScreen';
import { SettingsHubScreen } from '../../screens/settings/SettingsHubScreen';
import { SettingsComingSoon } from '../../screens/settings/SettingsComingSoon';
import { UnitsSettingsScreen } from '../../screens/settings/UnitsSettingsScreen';
import { TimerSettingsScreen } from '../../screens/settings/TimerSettingsScreen';
import { DataManagementScreen } from '../../screens/settings/DataManagementScreen';
import { WatchSyncScreen } from '../../screens/settings/WatchSyncScreen';
import { PlatesSettingsScreen } from '../../screens/settings/PlatesSettingsScreen';
import { BarbellEditorScreen } from '../../screens/settings/BarbellEditorScreen';
import { AccessibilitySettingsScreen } from '../../screens/settings/AccessibilitySettingsScreen';

/**
 * Keyed by the same `$param`-templated path string each route already declares via
 * `createRoute({ path: ... })` in router.tsx (that's what a leaf match's `fullPath` resolves to)
 * -- not a re-typed literal a route rename could silently leave stale, since `router.matchRoutes`
 * below does the actual path-to-params parsing, the same logic the router itself uses to
 * navigate. What's irreducible is the per-screen part: turning "this route matched, here are its
 * params" into "here's the prop this specific screen actually wants" is domain knowledge no
 * router can infer.
 */
const RENDER_BY_PATH: Record<string, (params: Record<string, string>) => ReactNode> = {
	'/today': () => (
		<TabsChrome pathname="/today">
			<TodayScreen />
		</TabsChrome>
	),
	'/history': () => (
		<TabsChrome pathname="/history">
			<HistoryHubScreen />
		</TabsChrome>
	),
	'/plan': () => (
		<TabsChrome pathname="/plan">
			<PlanScreen />
		</TabsChrome>
	),
	'/progress': () => (
		<TabsChrome pathname="/progress">
			<ProgressScreen />
		</TabsChrome>
	),
	'/workout-exercise/$workoutExerciseId': (params) => (
		<ExerciseLoggingScreen
			workoutExerciseId={params.workoutExerciseId}
			backTo="/today"
			backToOwnWorkout
			selfPath={`/workout-exercise/${params.workoutExerciseId}`}
		/>
	),
	'/history/workout/$workoutId': (params) => <WorkoutDetailScreen workoutId={params.workoutId} />,
	'/workout/$workoutId': (params) => <ActiveWorkoutScreen workoutId={params.workoutId} />,
	// The underlay is a read-only preview, not the actual mounted destination -- dropping the
	// `backTo` search param (only relevant once the screen is really navigated to) doesn't
	// affect what it looks like.
	'/exercise/$exerciseId': (params) => <ExerciseDetailScreen exerciseId={params.exerciseId} />,
	'/settings': () => <SettingsHubScreen />,
	'/settings/units': () => <UnitsSettingsScreen />,
	'/settings/timers': () => <TimerSettingsScreen />,
	'/settings/plates': () => <PlatesSettingsScreen />,
	'/settings/plates/$barbellId': (params) => <BarbellEditorScreen barbellId={params.barbellId} />,
	'/settings/accessibility': () => <AccessibilitySettingsScreen />,
	'/settings/watch': () => <WatchSyncScreen />,
	'/settings/data': () => <DataManagementScreen />,
	'/settings/timers/overrides': () => <SettingsComingSoon screen="Per-exercise overrides" />,
	'/settings/1rm-formula': () => <SettingsComingSoon screen="1RM formula" />,
	'/settings/categories': () => <SettingsComingSoon screen="Categories" />,
	'/settings/graphs': () => <SettingsComingSoon screen="Week start & graphs" />,
	'/settings/theme': () => <SettingsComingSoon screen="Theme & wallpaper colours" />,
	'/settings/health-connect': () => <SettingsComingSoon screen="Health Connect" />,
	'/settings/notifications': () => (
		<SettingsComingSoon screen="Notifications, widgets & shortcuts" />
	),
	'/settings/diagnostics': () => <SettingsComingSoon screen="Diagnostics & experiments" />,
};

/**
 * A real screen instance with its actual params, not a guess, and never the live `<Outlet/>`:
 * `<Outlet/>` always reflects the router's *current* match, so storing it for later "previous
 * screen" playback would just show whatever's current all over again the moment the underlay
 * renders, rather than a snapshot of what was there before. `router.matchRoutes` resolves a bare
 * pathname against the router's real route tree -- the same matching TanStack Router itself does
 * to navigate -- without actually navigating there, so params come from the router, not from
 * hand-parsing the path string here.
 */
export function buildUnderlayNode(router: AnyRouter, pathname: string): ReactNode {
	const matches = router.matchRoutes(pathname);
	const leaf = matches[matches.length - 1];
	if (!leaf) return null;

	const render = RENDER_BY_PATH[leaf.fullPath];
	return render ? render(leaf.params as Record<string, string>) : null;
}
