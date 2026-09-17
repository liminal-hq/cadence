// Shared between Workout detail's live and historical views, so an abandoned workout looks the
// same wherever it's shown
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { WorkoutStatus } from '../domain/types';

export interface WorkoutStatusTag {
	label: string;
	background: string;
	colour: string;
}

// `draft`/`active`/`completed` never render a tag — a completed workout is the unmarked default
// wherever workouts show up, and only `abandoned` needs calling out.
export const WORKOUT_STATUS_TAG: Partial<Record<WorkoutStatus, WorkoutStatusTag>> = {
	abandoned: {
		label: 'Abandoned',
		background: 'var(--cadence-error-container)',
		colour: 'var(--cadence-on-error-container)',
	},
};
