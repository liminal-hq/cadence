// Renders as a real switch role; onChange fires with the toggled value; disabled suppresses it.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch';

describe('Switch', () => {
	it('reflects checked via aria-checked', () => {
		render(<Switch checked label="Vibrate" onChange={() => {}} />);
		expect(screen.getByRole('switch', { name: 'Vibrate' })).toHaveAttribute('aria-checked', 'true');
	});

	it('calls onChange with the toggled value', () => {
		const onChange = vi.fn();
		render(<Switch checked={false} label="Vibrate" onChange={onChange} />);

		fireEvent.click(screen.getByRole('switch', { name: 'Vibrate' }));
		expect(onChange).toHaveBeenCalledWith(true);
	});

	it('does not fire onChange when disabled', () => {
		const onChange = vi.fn();
		render(<Switch checked={false} label="Vibrate" disabled onChange={onChange} />);

		fireEvent.click(screen.getByRole('switch', { name: 'Vibrate' }));
		expect(onChange).not.toHaveBeenCalled();
	});
});
