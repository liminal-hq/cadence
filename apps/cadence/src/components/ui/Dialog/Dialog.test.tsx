// onClose fires on Escape and on a scrim click but not a content click; renders via
// role="alertdialog"; nothing renders at all while closed.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog', () => {
	it('renders nothing while closed', () => {
		render(
			<Dialog open={false} onClose={() => {}} headline="Delete all history?">
				Body
			</Dialog>,
		);
		expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
	});

	it('renders as an alertdialog labelled by its headline when open', () => {
		render(
			<Dialog open onClose={() => {}} headline="Delete all history?">
				Body
			</Dialog>,
		);
		expect(screen.getByRole('alertdialog', { name: 'Delete all history?' })).toBeInTheDocument();
	});

	it('fires onClose on Escape', () => {
		const onClose = vi.fn();
		render(
			<Dialog open onClose={onClose} headline="Delete all history?">
				Body
			</Dialog>,
		);

		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('fires onClose on a scrim click but not a content click', () => {
		const onClose = vi.fn();
		render(
			<Dialog open onClose={onClose} headline="Delete all history?">
				Body text
			</Dialog>,
		);

		fireEvent.click(screen.getByText('Body text'));
		expect(onClose).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole('alertdialog').parentElement!);
		expect(onClose).toHaveBeenCalledOnce();
	});
});
