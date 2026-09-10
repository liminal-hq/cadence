// Save/Complete stays gated while a distance-duration set's duration is unset.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SetEditorSheet } from './SetEditorSheet';
import type { Exercise, SetEntry } from '../../domain/types';

const RUNNING: Exercise = {
	id: 'ex-running',
	name: 'Running',
	category: 'cardio',
	metricProfile: 'distance-duration',
	distanceIncrementKm: 0.1,
	durationIncrementSec: 10,
};

const INVALID_SET: SetEntry = {
	id: 'set-run-1',
	workoutExerciseId: 'we-running',
	order: 1,
	status: 'planned',
	distanceKm: 5.2,
};

function ControlledSheet() {
	const [set, setSet] = useState(INVALID_SET);
	return (
		<SetEditorSheet
			set={set}
			exercise={RUNNING}
			workoutLabel="Morning run · Tue 8 Sept"
			onClose={() => {}}
			onSave={setSet}
			onDelete={() => {}}
			onOpenNote={() => {}}
		/>
	);
}

describe('SetEditorSheet', () => {
	it('blocks Save planned while distance is set but duration is not', () => {
		render(<ControlledSheet />);

		expect(screen.getByRole('button', { name: 'Save planned' })).toBeDisabled();
		expect(screen.getByText('Enter a time, or leave blank')).toBeInTheDocument();
	});

	it('re-enables Save planned once the duration is filled in', () => {
		render(<ControlledSheet />);

		fireEvent.click(screen.getByRole('button', { name: 'Increase Duration · mm:ss' }));

		expect(screen.getByRole('button', { name: 'Save planned' })).toBeEnabled();
		expect(screen.queryByText('Enter a time, or leave blank')).not.toBeInTheDocument();
	});

	it('does not block Save for a weight-reps set with both values present', () => {
		const benchPress: Exercise = {
			id: 'ex-bench-press',
			name: 'Bench Press',
			category: 'chest',
			metricProfile: 'weight-reps',
			weightIncrementKg: 2.5,
			repsIncrement: 1,
		};
		const set: SetEntry = {
			id: 'set-1',
			workoutExerciseId: 'we-1',
			order: 1,
			status: 'planned',
			weightKg: 80,
			reps: 8,
		};

		render(
			<SetEditorSheet
				set={set}
				exercise={benchPress}
				workoutLabel="Push A · Tue 8 Sept"
				onClose={() => {}}
				onSave={vi.fn()}
				onDelete={() => {}}
				onOpenNote={() => {}}
			/>,
		);

		expect(screen.getByRole('button', { name: 'Save planned' })).toBeEnabled();
	});
});
