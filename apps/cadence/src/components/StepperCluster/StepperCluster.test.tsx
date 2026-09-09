// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepperCluster, type StepperField } from './StepperCluster';

function makeField(overrides: Partial<StepperField> = {}): StepperField {
	return { label: 'kg', value: 80, increment: 2.5, onChange: vi.fn(), ...overrides };
}

describe('StepperCluster', () => {
	it('increases and decreases by the configured increment', async () => {
		const onChange = vi.fn();
		render(
			<StepperCluster
				setPositionLabel="Set 1 of 4"
				primary={makeField({ label: 'kg', value: 80, increment: 2.5, onChange })}
				secondary={makeField({ label: 'reps', value: 8, increment: 1 })}
				canPrev={false}
				canNext={true}
				onLog={() => {}}
				logLabel="Log set 1"
				logDisabled={false}
			/>,
		);

		await userEvent.click(screen.getByRole('button', { name: 'Increase kg' }));
		expect(onChange).toHaveBeenCalledWith(82.5);

		await userEvent.click(screen.getByRole('button', { name: 'Decrease kg' }));
		expect(onChange).toHaveBeenCalledWith(77.5);
	});

	it('shows an em-dash and disables Log when a field has no value yet', () => {
		render(
			<StepperCluster
				setPositionLabel="Set 1 of 1"
				primary={makeField({ value: undefined })}
				secondary={makeField({ label: 'reps', value: undefined, increment: 1 })}
				canPrev={false}
				canNext={false}
				onLog={() => {}}
				logLabel="Log set 1"
				logDisabled={true}
			/>,
		);

		expect(screen.getAllByText('—')).toHaveLength(2);
		expect(screen.getByRole('button', { name: 'Log set 1' })).toBeDisabled();
	});

	it('enables Log once both values are set', () => {
		render(
			<StepperCluster
				setPositionLabel="Set 1 of 1"
				primary={makeField({ value: 80 })}
				secondary={makeField({ label: 'reps', value: 8, increment: 1 })}
				canPrev={false}
				canNext={false}
				onLog={() => {}}
				logLabel="Log set 1"
				logDisabled={false}
			/>,
		);

		expect(screen.getByRole('button', { name: 'Log set 1' })).toBeEnabled();
	});
});
