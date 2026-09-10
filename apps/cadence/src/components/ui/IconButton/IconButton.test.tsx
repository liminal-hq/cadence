// aria-label is always required and rendered; size/variant map to the right classes.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from './IconButton';

describe('IconButton', () => {
	it('renders the given label as its accessible name', () => {
		render(<IconButton icon="close" label="Close" />);
		expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
	});

	it.each(['small', 'medium', 'default', 'large', 'xl'] as const)(
		'supports the %s size',
		(size) => {
			render(<IconButton icon="close" label="Close" size={size} />);
			expect(screen.getByRole('button', { name: 'Close' })).toHaveClass(
				`ui-icon-button--size-${size}`,
			);
		},
	);

	it('fires onClick when enabled', () => {
		const onClick = vi.fn();
		render(<IconButton icon="close" label="Close" onClick={onClick} />);
		fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(onClick).toHaveBeenCalledOnce();
	});
});
