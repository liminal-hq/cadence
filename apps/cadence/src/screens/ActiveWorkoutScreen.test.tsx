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

describe('ActiveWorkoutScreen', () => {
	it('navigates straight into the new exercise’s logger when exactly one is added', async () => {
		navigateMock.mockClear();
		const repository = new MockLoggingRepository();
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
		});
	});

	it('stays on the workout list, showing every exercise added, when several are added at once', async () => {
		navigateMock.mockClear();
		const repository = new MockLoggingRepository();
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
});
