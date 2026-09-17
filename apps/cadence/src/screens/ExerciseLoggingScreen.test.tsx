// The logging screen's header "add exercise" action: adding one exercise replaces the route with
// its logger, propagating the current entry's "reached directly from Workout detail" tag forward;
// adding several pops back when that tag is trustworthy, otherwise navigates there explicitly.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExerciseLoggingScreen } from './ExerciseLoggingScreen';
import { RepositoryProvider } from '../domain/RepositoryProvider';
import { MockLoggingRepository } from '../domain/mockRepository';

const navigateMock = vi.fn();
const historyBackMock = vi.fn();
let locationState: { fromWorkoutDetail?: boolean } = {};

vi.mock('@tanstack/react-router', () => ({
	Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
		<a href={to} {...rest}>
			{children}
		</a>
	),
	useNavigate: () => navigateMock,
	useRouter: () => ({
		state: { location: { state: locationState } },
		history: { back: historyBackMock },
	}),
}));

async function renderScreen(repository: MockLoggingRepository, workoutExerciseId: string) {
	render(
		<RepositoryProvider repository={repository}>
			<ExerciseLoggingScreen
				workoutExerciseId={workoutExerciseId}
				backTo="/today"
				selfPath={`/workout-exercise/${workoutExerciseId}`}
			/>
		</RepositoryProvider>,
	);
	await act(async () => {}); // flush the initial load
}

async function seedWorkoutWithOneExercise(repository: MockLoggingRepository) {
	// The mock's default seed data includes several already-open workouts — starting a new one is
	// now rejected while one is open (SPEC.md 8.1's single-active-workout model).
	let open = await repository.getOpenWorkout();
	while (open) {
		await repository.abandonWorkout(open.id);
		open = await repository.getOpenWorkout();
	}
	const workout = await repository.createWorkout('2026-09-16', 'Push day');
	const workoutExercise = await repository.addWorkoutExercise(workout.id, 'ex-bench-press');
	return { workout, workoutExercise };
}

describe('ExerciseLoggingScreen', () => {
	it('replaces the route with the new exercise’s logger when exactly one is added from the header, propagating the entry tag', async () => {
		navigateMock.mockClear();
		historyBackMock.mockClear();
		locationState = { fromWorkoutDetail: true };
		const repository = new MockLoggingRepository();
		const { workoutExercise } = await seedWorkoutWithOneExercise(repository);
		await renderScreen(repository, workoutExercise.id);

		expect(screen.getByText('Bench Press')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
		fireEvent.click(await screen.findByRole('button', { name: /Running/ }));
		await act(async () =>
			fireEvent.click(screen.getByRole('button', { name: 'Add 1 exercise(s)' })),
		);

		const workoutExercises = await repository.listWorkoutExercisesByWorkout(
			workoutExercise.workoutId,
		);
		const running = workoutExercises.find((we) => we.exerciseId === 'ex-running');
		expect(historyBackMock).not.toHaveBeenCalled();
		expect(navigateMock).toHaveBeenCalledWith({
			to: '/workout-exercise/$workoutExerciseId',
			params: { workoutExerciseId: running?.id },
			replace: true,
			state: { fromWorkoutDetail: true },
		});
	});

	it('pops back when several are added and the entry is tagged as reached directly from Workout detail', async () => {
		navigateMock.mockClear();
		historyBackMock.mockClear();
		locationState = { fromWorkoutDetail: true };
		const repository = new MockLoggingRepository();
		const { workoutExercise } = await seedWorkoutWithOneExercise(repository);
		await renderScreen(repository, workoutExercise.id);

		fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
		fireEvent.click(await screen.findByRole('button', { name: /Running/ }));
		fireEvent.click(screen.getByRole('button', { name: /Lateral Raise/ }));
		await act(async () =>
			fireEvent.click(screen.getByRole('button', { name: 'Add 2 exercise(s)' })),
		);

		expect(navigateMock).not.toHaveBeenCalled();
		expect(historyBackMock).toHaveBeenCalledTimes(1);
	});

	it('navigates explicitly when several are added and the entry carries no trustworthy tag', async () => {
		navigateMock.mockClear();
		historyBackMock.mockClear();
		locationState = {};
		const repository = new MockLoggingRepository();
		const { workout, workoutExercise } = await seedWorkoutWithOneExercise(repository);
		await renderScreen(repository, workoutExercise.id);

		fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
		fireEvent.click(await screen.findByRole('button', { name: /Running/ }));
		fireEvent.click(screen.getByRole('button', { name: /Lateral Raise/ }));
		await act(async () =>
			fireEvent.click(screen.getByRole('button', { name: 'Add 2 exercise(s)' })),
		);

		expect(historyBackMock).not.toHaveBeenCalled();
		expect(navigateMock).toHaveBeenCalledWith({
			to: '/workout/$workoutId',
			params: { workoutId: workout.id },
			replace: true,
		});
	});
});
