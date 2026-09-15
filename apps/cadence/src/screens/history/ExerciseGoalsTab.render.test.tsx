// Component-level regression coverage: a failed delete must not silently discard the in-progress
// edit draft underneath it, and a failed initial load must not leave the tab blank forever
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ExerciseGoalsTab } from './ExerciseGoalsTab';
import { RepositoryProvider } from '../../domain/RepositoryProvider';
import { MockLoggingRepository } from '../../domain/mockRepository';
import type { Exercise, ExerciseGoal } from '../../domain/types';

const EXERCISE: Exercise = {
	id: 'ex-bench-press',
	name: 'Bench Press',
	category: 'chest',
	metricProfile: 'weight-reps',
};

class FailingDeleteRepository extends MockLoggingRepository {
	async listExerciseGoals(exerciseId: string): Promise<ExerciseGoal[]> {
		return [
			{
				id: 'goal-1',
				exerciseId,
				title: 'Bench 100kg',
				archived: false,
				targetWeightKg: 100,
			},
		];
	}

	async deleteExerciseGoal(): Promise<void> {
		throw new Error('network error');
	}
}

class FailingLoadRepository extends MockLoggingRepository {
	async listExerciseGoals(): Promise<ExerciseGoal[]> {
		throw new Error('failed to load goals');
	}
}

describe('ExerciseGoalsTab', () => {
	it('preserves the open edit draft when deleting that goal fails', async () => {
		render(
			<RepositoryProvider repository={new FailingDeleteRepository()}>
				<ExerciseGoalsTab exercise={EXERCISE} history={[]} />
			</RepositoryProvider>,
		);
		await act(async () => {});

		fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		const titleField = screen.getByLabelText('Title') as HTMLInputElement;
		fireEvent.change(titleField, { target: { value: 'Bench 105kg (edited)' } });

		fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		const dialog = screen.getByRole('dialog');
		fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
		await act(async () => {});

		// The delete failed -- the draft (with its unsaved edit) must still be open, not discarded.
		expect(screen.getByDisplayValue('Bench 105kg (edited)')).toBeInTheDocument();
		expect(screen.getByText('network error')).toBeInTheDocument();
	});

	it('shows a retryable error instead of staying blank forever when the initial load fails', async () => {
		render(
			<RepositoryProvider repository={new FailingLoadRepository()}>
				<ExerciseGoalsTab exercise={EXERCISE} history={[]} />
			</RepositoryProvider>,
		);
		await act(async () => {});

		expect(screen.getByText("Couldn't load goals")).toBeInTheDocument();
		expect(screen.getByText('failed to load goals')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
	});
});
