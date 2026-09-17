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

// The mock's default seed data includes several already-open workouts — reopening while one is
// still open is now rejected (SPEC.md 8.1's single-active-workout model), so tests that reopen a
// workout need to start from a genuinely clean "nothing open" state first.
async function withNoOpenWorkout(repository: MockLoggingRepository) {
	let open = await repository.getOpenWorkout();
	while (open) {
		await repository.abandonWorkout(open.id);
		open = await repository.getOpenWorkout();
	}
}

async function seedCompletedWorkout(repository: MockLoggingRepository) {
	await withNoOpenWorkout(repository);
	const workout = await repository.createWorkout('2026-09-10', 'Push A');
	const we = await repository.addWorkoutExercise(workout.id, 'ex-bench-press');
	await repository.logNewSet(we.id, { weightKg: 60, reps: 5 });
	return repository.completeWorkout(workout.id);
}

describe('WorkoutDetailScreen', () => {
	it('offers Continue instead of Reopen for a workout that is still active', async () => {
		navigateMock.mockClear();
		const repository = new MockLoggingRepository();
		await withNoOpenWorkout(repository);
		const workout = await repository.createWorkout('2026-09-10', 'Push A');
		await renderScreen(repository, workout.id);

		expect(screen.queryByText('Reopen workout')).not.toBeInTheDocument();
		// The copy always lands as active, so it can only ever fail here, referencing this same
		// still-open workout — hidden rather than offered as a guaranteed-failing action.
		expect(screen.queryByText('Copy to today')).not.toBeInTheDocument();
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
		await withNoOpenWorkout(repository);
		const workout = await repository.createWorkout('2026-09-10', 'Push A');
		await repository.abandonWorkout(workout.id);
		await renderScreen(repository, workout.id);

		expect(screen.getByText('Reopen workout')).toBeInTheDocument();
		expect(screen.getByText('Abandoned')).toBeInTheDocument();
	});

	// Reopening while another workout is already open is rejected by the repository; the handler
	// must catch that rejection rather than let it become an unhandled promise rejection with no
	// feedback and no navigation.
	it('surfaces an error banner instead of navigating when another workout is already open', async () => {
		navigateMock.mockClear();
		const repository = new MockLoggingRepository();
		await withNoOpenWorkout(repository);
		const workout = await repository.createWorkout('2026-09-10', 'Push A');
		await repository.abandonWorkout(workout.id);
		// A different workout being open now is exactly the conflict under test.
		await repository.createWorkout('2026-09-16', 'Pull A');
		await renderScreen(repository, workout.id);

		const reopenButton = screen.getByText('Reopen workout');
		await act(async () => fireEvent.click(reopenButton));

		expect(navigateMock).not.toHaveBeenCalled();
		expect(screen.getByText(/already open/)).toBeInTheDocument();
		const reloaded = await repository.getWorkout(workout.id);
		expect(reloaded.status).toBe('abandoned');
	});

	// Copying always lands the new workout as active, so it's rejected under the same
	// single-active-workout guard as Reopen — the handler must surface that, not navigate.
	it('surfaces an error banner instead of copying when another workout is already open', async () => {
		navigateMock.mockClear();
		const repository = new MockLoggingRepository();
		// The seed fixture already has an open workout — exactly the conflict under test.
		await renderScreen(repository, 'workout-2026-09-04');

		const copyButton = screen.getByText('Copy to today');
		await act(async () => fireEvent.click(copyButton));

		expect(navigateMock).not.toHaveBeenCalled();
		expect(screen.getByText(/already open/)).toBeInTheDocument();
	});
});
