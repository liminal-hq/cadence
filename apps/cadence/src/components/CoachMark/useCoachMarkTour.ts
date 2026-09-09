// Drives the 5-step, first-workout-only coach mark tour (Logging.dc.html's Priya canvas):
// skippable from any step, and the final step has no "back" -- Next just finishes the tour.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useCallback, useState } from 'react';

export const COACH_MARK_STEP_COUNT = 5;

export interface CoachMarkTourState {
	active: boolean;
	step: number;
}

export interface CoachMarkTour extends CoachMarkTourState {
	isLastStep: boolean;
	next: () => void;
	skip: () => void;
}

export function useCoachMarkTour(autoStart: boolean): CoachMarkTour {
	const [state, setState] = useState<CoachMarkTourState>({ active: autoStart, step: 0 });

	const next = useCallback(() => {
		setState((prev) => {
			if (!prev.active) return prev;
			const nextStep = prev.step + 1;
			if (nextStep >= COACH_MARK_STEP_COUNT) return { active: false, step: prev.step };
			return { active: true, step: nextStep };
		});
	}, []);

	const skip = useCallback(() => {
		setState((prev) => ({ ...prev, active: false }));
	}, []);

	return { ...state, isLastStep: state.step === COACH_MARK_STEP_COUNT - 1, next, skip };
}
