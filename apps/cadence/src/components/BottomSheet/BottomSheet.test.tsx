// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BottomSheet } from './BottomSheet';

describe('BottomSheet', () => {
	it('dismisses when the backdrop is clicked', () => {
		const onClose = vi.fn();
		render(
			<BottomSheet onClose={onClose} ariaLabel="Test sheet">
				<div>Content</div>
			</BottomSheet>,
		);

		fireEvent.click(screen.getByRole('dialog').parentElement!);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('dismisses on Escape', () => {
		const onClose = vi.fn();
		render(
			<BottomSheet onClose={onClose} ariaLabel="Test sheet">
				<div>Content</div>
			</BottomSheet>,
		);

		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledOnce();
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
});
