// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BottomSheet } from './BottomSheet';

describe('BottomSheet', () => {
	it('dismisses when the backdrop is clicked', async () => {
		const onClose = vi.fn();
		render(
			<BottomSheet onClose={onClose} ariaLabel="Test sheet">
				<div>Content</div>
			</BottomSheet>,
		);

		fireEvent.click(screen.getByRole('dialog').parentElement!);
		await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
	});

	it('dismisses on Escape', async () => {
		const onClose = vi.fn();
		render(
			<BottomSheet onClose={onClose} ariaLabel="Test sheet">
				<div>Content</div>
			</BottomSheet>,
		);

		fireEvent.keyDown(document, { key: 'Escape' });
		await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
	});

	it('does not dismiss when the sheet content is clicked', () => {
		const onClose = vi.fn();
		render(
			<BottomSheet onClose={onClose} ariaLabel="Test sheet">
				<div>Content</div>
			</BottomSheet>,
		);

		fireEvent.click(screen.getByText('Content'));
		expect(onClose).not.toHaveBeenCalled();
	});

	it('dismisses when dragged down past the threshold', async () => {
		const onClose = vi.fn();
		render(
			<BottomSheet onClose={onClose} ariaLabel="Test sheet">
				<div>Content</div>
			</BottomSheet>,
		);

		const handle = screen.getByRole('dialog').querySelector('.bottom-sheet__handle')!;
		fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 });
		fireEvent.pointerMove(handle, { clientY: 200, pointerId: 1 });
		fireEvent.pointerUp(handle, { clientY: 200, pointerId: 1 });

		await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
	});

	it('snaps back without dismissing on a short drag', () => {
		const onClose = vi.fn();
		render(
			<BottomSheet onClose={onClose} ariaLabel="Test sheet">
				<div>Content</div>
			</BottomSheet>,
		);

		const handle = screen.getByRole('dialog').querySelector('.bottom-sheet__handle')!;
		fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 });
		fireEvent.pointerMove(handle, { clientY: 20, pointerId: 1 });
		fireEvent.pointerUp(handle, { clientY: 20, pointerId: 1 });

		expect(onClose).not.toHaveBeenCalled();
	});
});
