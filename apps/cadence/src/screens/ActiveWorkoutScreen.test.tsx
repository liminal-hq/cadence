// Adding exactly one exercise from the workout screen's "Add exercise" sheet drops straight into
// logging it; adding several has no single exercise to land on, so those stay on this list.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen';
import { RepositoryProvider } from '../domain/RepositoryProvider';
import { MockLoggingRepository } from '../domain/mockRepository';

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
			<ActiveWorkoutScreen workoutId={workoutId} />
		</RepositoryProvider>,
	);
	await act(async () => {}); // flush the initial load
}

// The mock's default seed data includes several already-open workouts — starting a new one is now
// rejected while one is open (SPEC.md 8.1's single-active-workout model), so tests that create a
// workout need to start from a genuinely clean "nothing open" state first.
async function withNoOpenWorkout(repository: MockLoggingRepository) {
	let open = await repository.getOpenWorkout();
	while (open) {
		await repository.abandonWorkout(open.id);
		open = await repository.getOpenWorkout();
	}
}

describe('ActiveWorkoutScreen', () => {
	it('navigates straight into the new exercise’s logger when exactly one is added', async () => {
		navigateMock.mockClear();
		const repository = new MockLoggingRepository();
		await withNoOpenWorkout(repository);
		const workout = await repository.createWorkout('2026-09-16', 'Push day');
		await renderScreen(repository, workout.id);

		fireEvent.click(screen.getByRole('button', { name: /Add exercise/ }));
		fireEvent.click(await screen.findByRole('button', { name: /Bench Press/ }));
		await act(async () =>
			fireEvent.click(screen.getByRole('button', { name: 'Add 1 exercise(s)' })),
		);

		const workoutExercises = await repository.listWorkoutExercisesByWorkout(workout.id);
		expect(workoutExercises).toHaveLength(1);
		expect(navigateMock).toHaveBeenCalledWith({
			to: '/workout-exercise/$workoutExerciseId',
			params: { workoutExerciseId: workoutExercises[0].id },
			state: { fromWorkoutDetail: true },
		});
	});

	it('stays on the workout list, showing every exercise added, when several are added at once', async () => {
		navigateMock.mockClear();
		const repository = new MockLoggingRepository();
		await withNoOpenWorkout(repository);
		const workout = await repository.createWorkout('2026-09-16', 'Push day');
		await renderScreen(repository, workout.id);

		fireEvent.click(screen.getByRole('button', { name: /Add exercise/ }));
		fireEvent.click(await screen.findByRole('button', { name: /Bench Press/ }));
		fireEvent.click(screen.getByRole('button', { name: /Running/ }));
		await act(async () =>
			fireEvent.click(screen.getByRole('button', { name: 'Add 2 exercise(s)' })),
		);

		expect(navigateMock).not.toHaveBeenCalled();
		expect(await screen.findByText('Bench Press')).toBeInTheDocument();
		expect(screen.getByText('Running')).toBeInTheDocument();
	});

	it('disables Finish workout with a hint until a set is completed', async () => {
		const repository = new MockLoggingRepository();
		await withNoOpenWorkout(repository);
		const workout = await repository.createWorkout('2026-09-16', 'Push day');
		await repository.addWorkoutExercise(workout.id, 'ex-bench-press');
		await renderScreen(repository, workout.id);

		expect(screen.getByRole('button', { name: 'Finish workout' })).toBeDisabled();
		expect(screen.getByText('Log at least one set before finishing.')).toBeInTheDocument();
	});

	it('finishes a workout with a completed set and navigates to Today', async () => {
		navigateMock.mockClear();
		const repository = new MockLoggingRepository();
		await withNoOpenWorkout(repository);
		const workout = await repository.createWorkout('2026-09-16', 'Push day');
		const we = await repository.addWorkoutExercise(workout.id, 'ex-bench-press');
		await repository.logNewSet(we.id, { weightKg: 60, reps: 5 });
		await renderScreen(repository, workout.id);

		const finishButton = screen.getByRole('button', { name: 'Finish workout' });
		expect(finishButton).toBeEnabled();
		await act(async () => fireEvent.click(finishButton));

		const reloaded = await repository.getWorkout(workout.id);
		expect(reloaded.status).toBe('completed');
		expect(navigateMock).toHaveBeenCalledWith({ to: '/today' });
	});

	it('abandons a workout through the confirmation dialog and navigates to Today', async () => {
		navigateMock.mockClear();
		const repository = new MockLoggingRepository();
		await withNoOpenWorkout(repository);
		const workout = await repository.createWorkout('2026-09-16', 'Push day');
		await renderScreen(repository, workout.id);

		fireEvent.click(screen.getByRole('button', { name: 'Abandon workout' }));
		expect(screen.getByText('Abandon this workout?')).toBeInTheDocument();

		await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Abandon' })));

		const reloaded = await repository.getWorkout(workout.id);
		expect(reloaded.status).toBe('abandoned');
		expect(navigateMock).toHaveBeenCalledWith({ to: '/today' });
	});

	it('surfaces an error banner and re-enables Finish workout when completing fails', async () => {
		navigateMock.mockClear();
		const repository = new MockLoggingRepository();
		await withNoOpenWorkout(repository);
		const workout = await repository.createWorkout('2026-09-16', 'Push day');
		const we = await repository.addWorkoutExercise(workout.id, 'ex-bench-press');
		await repository.logNewSet(we.id, { weightKg: 60, reps: 5 });
		vi.spyOn(repository, 'completeWorkout').mockRejectedValue(
			new Error('workout status changed underneath this screen'),
		);
		await renderScreen(repository, workout.id);

		const finishButton = screen.getByRole('button', { name: 'Finish workout' });
		await act(async () => fireEvent.click(finishButton));

		expect(navigateMock).not.toHaveBeenCalled();
		expect(screen.getByText(/status changed underneath/)).toBeInTheDocument();
		expect(finishButton).toBeEnabled();
	});

	it('surfaces an error banner instead of navigating when abandoning fails', async () => {
		navigateMock.mockClear();
		const repository = new MockLoggingRepository();
		await withNoOpenWorkout(repository);
		const workout = await repository.createWorkout('2026-09-16', 'Push day');
		vi.spyOn(repository, 'abandonWorkout').mockRejectedValue(
			new Error('workout status changed underneath this screen'),
		);
		await renderScreen(repository, workout.id);

		fireEvent.click(screen.getByRole('button', { name: 'Abandon workout' }));
		await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Abandon' })));

		expect(navigateMock).not.toHaveBeenCalled();
		expect(screen.getByText(/status changed underneath/)).toBeInTheDocument();
	});

	it('shows an Abandoned tag and hides mutating actions for an already-abandoned workout', async () => {
		const repository = new MockLoggingRepository();
		await withNoOpenWorkout(repository);
		const workout = await repository.createWorkout('2026-09-16', 'Push day');
		await repository.abandonWorkout(workout.id);
		await renderScreen(repository, workout.id);

		expect(screen.getByText('Abandoned')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Abandon workout' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Finish workout' })).not.toBeInTheDocument();
	});
});
