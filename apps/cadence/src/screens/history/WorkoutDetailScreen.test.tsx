// "Reopen workout" is offered only for a completed or abandoned workout, and returns it to the
// live editor at /workout/$workoutId — never for one that's still open (active)
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkoutDetailScreen } from './WorkoutDetailScreen';
import { RepositoryProvider } from '../../domain/RepositoryProvider';
import { MockLoggingRepository } from '../../domain/mockRepository';

const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
	Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
		<a href={to} {...rest}>
			{children}
		</a>
	),
	useNavigate: () => navigateMock,
}));

async function renderScreen(repository: MockLoggingRepository, workoutId: string) {
	render(
		<RepositoryProvider repository={repository}>
			<WorkoutDetailScreen workoutId={workoutId} />
		</RepositoryProvider>,
	);
	await act(async () => {}); // flush the initial load
}

async function seedCompletedWorkout(repository: MockLoggingRepository) {
	const workout = await repository.createWorkout('2026-09-10', 'Push A');
	const we = await repository.addWorkoutExercise(workout.id, 'ex-bench-press');
	await repository.logNewSet(we.id, { weightKg: 60, reps: 5 });
	return repository.completeWorkout(workout.id);
}

describe('WorkoutDetailScreen', () => {
	it('offers Continue instead of Reopen for a workout that is still active', async () => {
		navigateMock.mockClear();
		const repository = new MockLoggingRepository();
		const workout = await repository.createWorkout('2026-09-10', 'Push A');
		await renderScreen(repository, workout.id);

		expect(screen.queryByText('Reopen workout')).not.toBeInTheDocument();
		const continueButton = screen.getByText('Continue workout');
		fireEvent.click(continueButton);
		expect(navigateMock).toHaveBeenCalledWith({
			to: '/workout/$workoutId',
			params: { workoutId: workout.id },
		});
	});

	it('reopens a completed workout and navigates back to its live editor', async () => {
		navigateMock.mockClear();
		const repository = new MockLoggingRepository();
		const completed = await seedCompletedWorkout(repository);
		await renderScreen(repository, completed.id);

		const reopenButton = screen.getByText('Reopen workout');
		await act(async () => fireEvent.click(reopenButton));

		const reloaded = await repository.getWorkout(completed.id);
		expect(reloaded.status).toBe('active');
		expect(navigateMock).toHaveBeenCalledWith({
			to: '/workout/$workoutId',
			params: { workoutId: completed.id },
		});
	});

	it('offers Reopen and an Abandoned tag for an abandoned workout', async () => {
		const repository = new MockLoggingRepository();
		const workout = await repository.createWorkout('2026-09-10', 'Push A');
		await repository.abandonWorkout(workout.id);
		await renderScreen(repository, workout.id);

		expect(screen.getByText('Reopen workout')).toBeInTheDocument();
		expect(screen.getByText('Abandoned')).toBeInTheDocument();
	});
});
