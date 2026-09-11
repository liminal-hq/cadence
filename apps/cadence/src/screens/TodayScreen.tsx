// Today — the operational home of Cadence (SPEC.md section 8.1). The app always launches here,
// tabs visible, even with a workout already in progress — Today surfaces a "Continue workout"
// action rather than auto-navigating away, so opening the app never lands on a tab-less screen.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
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

	useEffect(() => {
		let cancelled = false;
		const today = todayLocalDate();
		repository.listWorkoutsInRange(today, today).then((workouts) => {
			if (cancelled) return;
			setTodayWorkoutId(workouts.find((w) => w.status === 'in-progress')?.id ?? null);
		});
		return () => {
			cancelled = true;
		};
	}, [repository]);

	if (todayWorkoutId === undefined) return null;

	async function handleStartWorkout() {
		const created = await repository.createWorkout(todayLocalDate(), '');
		navigate({ to: '/workout/$workoutId', params: { workoutId: created.id } });
	}

	function handleContinueWorkout() {
		navigate({ to: '/workout/$workoutId', params: { workoutId: todayWorkoutId as string } });
	}

	return todayWorkoutId ? (
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
	);
}
