// A calendar day cell's primary visual state (P-41) — "today" and the per-workout category dot
// colours are separate, simpler concerns the caller layers on top of this classification
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

export type CalendarDayState = 'no-workout' | 'planned-only' | 'has-workout' | 'multi-workout';

export interface CalendarDayWorkoutSummary {
	hasCompletedSets: boolean;
}

export function classifyCalendarDay(workouts: CalendarDayWorkoutSummary[]): CalendarDayState {
	if (workouts.length === 0) return 'no-workout';
	if (workouts.length > 1) return 'multi-workout';
	return workouts[0].hasCompletedSets ? 'has-workout' : 'planned-only';
}
