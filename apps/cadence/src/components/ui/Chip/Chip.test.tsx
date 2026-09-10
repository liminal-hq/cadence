// Filter chips toggle a selected/aria-pressed state, assist chips don't, and input chips expose a separate remove control
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Chip } from './Chip';

describe('Chip', () => {
	it('exposes filter selection via aria-pressed', () => {
		render(<Chip variant="filter" label="Chest" selected />);
		expect(screen.getByRole('button', { name: 'Chest' })).toHaveAttribute('aria-pressed', 'true');
	});

	it('does not expose aria-pressed for an assist chip', () => {
		render(<Chip variant="assist" label="Plates" onClick={() => {}} />);
		expect(screen.getByRole('button', { name: 'Plates' })).not.toHaveAttribute('aria-pressed');
	});

	it('fires onRemove from a separate control on an input chip', () => {
		const onRemove = vi.fn();
		render(<Chip variant="input" label="Chest" onRemove={onRemove} />);

		fireEvent.click(screen.getByRole('button', { name: 'Remove Chest' }));
		expect(onRemove).toHaveBeenCalledOnce();
	});

	it('renders the compact small-size geometry', () => {
		render(<Chip variant="assist" label="Default" size="small" />);
		expect(screen.getByRole('button', { name: 'Default' })).toHaveClass('ui-chip--size-small');
	});
});
