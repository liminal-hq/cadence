// The one interaction this screen set is worth a dedicated test for: the delete button stays
// disabled until the confirm word is typed exactly, then fires once and closes
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DeleteAllHistoryDialog } from './DeleteAllHistoryDialog';

describe('DeleteAllHistoryDialog', () => {
	it('keeps Delete disabled until DELETE is typed exactly, then confirms and closes', () => {
		const onConfirm = vi.fn();
		const onClose = vi.fn();
		render(
			<DeleteAllHistoryDialog
				open
				onClose={onClose}
				onConfirm={onConfirm}
				workoutCount={3}
				setCount={10}
			/>,
		);

		expect(screen.getByText(/3 workouts and 10 sets/)).toBeInTheDocument();
		const deleteButton = screen.getByRole('button', { name: 'Delete' });
		expect(deleteButton).toBeDisabled();

		const input = screen.getByLabelText('Type DELETE to confirm');
		fireEvent.change(input, { target: { value: 'delete' } });
		expect(deleteButton).toBeDisabled();

		fireEvent.change(input, { target: { value: 'DELETE' } });
		expect(deleteButton).toBeEnabled();

		fireEvent.click(deleteButton);
		expect(onConfirm).toHaveBeenCalledOnce();
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('resets the confirm text when reopened', () => {
		const { rerender } = render(
			<DeleteAllHistoryDialog
				open={false}
				onClose={vi.fn()}
				onConfirm={vi.fn()}
				workoutCount={1}
				setCount={1}
			/>,
		);

		rerender(
			<DeleteAllHistoryDialog
				open
				onClose={vi.fn()}
				onConfirm={vi.fn()}
				workoutCount={1}
				setCount={1}
			/>,
		);

		expect(screen.getByLabelText('Type DELETE to confirm')).toHaveValue('');
	});
});
