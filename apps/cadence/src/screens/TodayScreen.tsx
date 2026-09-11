// Today — the operational home of Cadence (SPEC.md section 8.1). "It opens to the active
// workout when one exists" — this screen redirects there the moment it finds one, rather than
// rendering its own summary card, since SPEC.md 8.1 explicitly allows a lightweight "Start
// workout" action in place of a fuller Quick-start surface. The two demo "Preview" links are
// temporary scaffolding, retired alongside the demo seed data itself.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
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

	useEffect(() => {
		if (todayWorkoutId) {
			navigate({ to: '/workout/$workoutId', params: { workoutId: todayWorkoutId }, replace: true });
		}
	}, [todayWorkoutId, navigate]);

	if (todayWorkoutId === undefined || todayWorkoutId) return null;

	async function handleStartWorkout() {
		const created = await repository.createWorkout(todayLocalDate(), '');
		navigate({ to: '/workout/$workoutId', params: { workoutId: created.id } });
	}

	return (
		<EmptyState
			headline="No workout yet today"
			body="A workout is created the moment you log a set, or you can start one now."
			action={
				<Button variant="filled" onClick={handleStartWorkout}>
					Start workout
				</Button>
			}
		>
			<div className="screen-empty-state__preview-links">
				<Link to="/log/$scenario" params={{ scenario: 'sam-default' }}>
					Preview: default set
				</Link>
				<Link to="/log/$scenario" params={{ scenario: 'sam-superset-dark' }}>
					Preview: offline superset
				</Link>
				<Link to="/log/$scenario" params={{ scenario: 'priya-first-run' }}>
					Preview: first workout
				</Link>
			</div>
		</EmptyState>
	);
}
