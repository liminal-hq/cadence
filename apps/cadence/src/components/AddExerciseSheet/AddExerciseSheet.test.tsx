// Filtering (search/category/favourites), the already-in-workout no-op state, and multi-select
// add, all against the mock repository's real seeded exercise library.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AddExerciseSheet } from './AddExerciseSheet';
import { RepositoryProvider } from '../../domain/RepositoryProvider';
import { MockLoggingRepository } from '../../domain/mockRepository';

async function renderSheet(
	repository: MockLoggingRepository,
	props?: Partial<{ workoutId: string; existingExerciseIds: string[] }>,
) {
	const onAdded = vi.fn();
	const onClose = vi.fn();
	render(
		<RepositoryProvider repository={repository}>
			<AddExerciseSheet
				workoutId={props?.workoutId ?? 'workout-push-a'}
				existingExerciseIds={props?.existingExerciseIds ?? []}
				onClose={onClose}
				onAdded={onAdded}
			/>
		</RepositoryProvider>,
	);
	await act(async () => {}); // flush the initial listExercises() load
	return { onAdded, onClose };
}

describe('AddExerciseSheet', () => {
	it('lists the seeded exercise library', async () => {
		await renderSheet(new MockLoggingRepository());
		expect(screen.getByText('Bench Press')).toBeInTheDocument();
		expect(screen.getByText('Lateral Raise')).toBeInTheDocument();
		expect(screen.getByText('Running')).toBeInTheDocument();
	});

	it('filters by a search query', async () => {
		await renderSheet(new MockLoggingRepository());
		fireEvent.change(screen.getByPlaceholderText('Search exercises'), {
			target: { value: 'bench' },
		});
		expect(screen.getByText('Bench Press')).toBeInTheDocument();
		expect(screen.queryByText('Running')).not.toBeInTheDocument();
	});

	it('filters by category', async () => {
		await renderSheet(new MockLoggingRepository());
		fireEvent.click(screen.getByRole('button', { name: 'cardio' }));
		expect(screen.getByText('Running')).toBeInTheDocument();
		expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
	});

	it('shows no matches when the favourites filter excludes everything', async () => {
		await renderSheet(new MockLoggingRepository());
		fireEvent.click(screen.getByRole('button', { name: 'Favourites' }));
		expect(screen.getByText('No exercises match.')).toBeInTheDocument();
	});

	it('marks an exercise already in the workout as unselectable', async () => {
		await renderSheet(new MockLoggingRepository(), { existingExerciseIds: ['ex-bench-press'] });
		expect(screen.getByText('Already added')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Bench Press/ })).toBeDisabled();
	});

	it('selecting exercises updates the footer count, and Add calls addWorkoutExercise for each', async () => {
		const repository = new MockLoggingRepository();
		const addSpy = vi.spyOn(repository, 'addWorkoutExercise');
		const { onAdded } = await renderSheet(repository);

		fireEvent.click(screen.getByRole('button', { name: /Bench Press/ }));
		fireEvent.click(screen.getByRole('button', { name: /Running/ }));
		expect(screen.getByRole('button', { name: 'Add 2 exercise(s)' })).toBeEnabled();

		await act(async () =>
			fireEvent.click(screen.getByRole('button', { name: 'Add 2 exercise(s)' })),
		);

		expect(addSpy).toHaveBeenCalledWith('workout-push-a', 'ex-bench-press');
		expect(addSpy).toHaveBeenCalledWith('workout-push-a', 'ex-running');
		expect(addSpy).toHaveBeenCalledTimes(2);
		expect(onAdded).toHaveBeenCalledTimes(1);
	});

	it('keeps Add disabled with nothing selected', async () => {
		await renderSheet(new MockLoggingRepository());
		expect(screen.getByRole('button', { name: 'Add exercise' })).toBeDisabled();
	});
});
