// Today — the operational home of Cadence (SPEC.md section 8.1). The app always launches here,
// tabs visible, even with a workout already in progress — Today surfaces a "Continue workout"
// action rather than auto-navigating away, so opening the app never lands on a tab-less screen.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Banner } from '../components/ui/Banner/Banner';
import { Button } from '../components/ui/Button/Button';
import { EmptyState } from '../components/ui/EmptyState/EmptyState';
import { useLoggingRepository } from '../domain/RepositoryProvider';
import { todayLocalDate } from '../domain/format';
import './screens.css';

export function TodayScreen() {
	const repository = useLoggingRepository();
	const navigate = useNavigate();
	// undefined while checking for an existing workout; null once confirmed there isn't one.
	const [todayWorkoutId, setTodayWorkoutId] = useState<string | null | undefined>(undefined);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		// Not scoped to today's date — SPEC.md 8.1's single-active-workout model is global, so a
		// workout reopened from any earlier date is still "the one to resume" here.
		repository.getOpenWorkout().then((workout) => {
			if (cancelled) return;
			setTodayWorkoutId(workout?.id ?? null);
		});
		return () => {
			cancelled = true;
		};
	}, [repository]);

	if (todayWorkoutId === undefined) return null;

	async function handleStartWorkout() {
		try {
			setError(null);
			const created = await repository.createWorkout(todayLocalDate(), '');
			navigate({ to: '/workout/$workoutId', params: { workoutId: created.id } });
		} catch (err) {
			// Most likely SPEC.md 8.1's single-active-workout guard: a workout became open (e.g. a
			// double-tap, or another device) between this screen's own check and this call. Refetch
			// rather than just showing the error, so the screen actually reflects the workout that
			// now exists instead of continuing to offer a "Start workout" that will keep failing.
			setError(err instanceof Error ? err.message : String(err));
			const open = await repository.getOpenWorkout();
			setTodayWorkoutId(open?.id ?? null);
		}
	}

	function handleContinueWorkout() {
		navigate({ to: '/workout/$workoutId', params: { workoutId: todayWorkoutId as string } });
	}

	return (
		<>
			{error && (
				<Banner icon="error" message={error} tone="attention" onDismiss={() => setError(null)} />
			)}
			{todayWorkoutId ? (
				<EmptyState
					headline="Workout in progress"
					body="Pick up where you left off."
					action={
						<Button variant="filled" onClick={handleContinueWorkout}>
							Continue workout
						</Button>
					}
				/>
			) : (
				<EmptyState
					headline="No workout yet today"
					body="A workout is created the moment you log a set, or you can start one now."
					action={
						<Button variant="filled" onClick={handleStartWorkout}>
							Start workout
						</Button>
					}
				/>
			)}
		</>
	);
}
