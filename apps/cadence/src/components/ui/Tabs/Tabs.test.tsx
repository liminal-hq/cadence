// Clicking a tab calls onChange; the active tab carries aria-selected; ArrowRight/ArrowLeft
// move between tabs (real M3 tab keyboard behaviour), wrapping at the ends.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs';

describe('Tabs', () => {
	const options = [
		{ value: 'history' as const, label: 'History' },
		{ value: 'graph' as const, label: 'Graph' },
		{ value: 'records' as const, label: 'Records' },
	];

	it('marks the active tab via aria-selected', () => {
		render(<Tabs options={options} value="graph" onChange={() => {}} />);

		expect(screen.getByRole('tab', { name: 'Graph' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'false');
	});

	it('calls onChange on click', () => {
		const onChange = vi.fn();
		render(<Tabs options={options} value="history" onChange={onChange} />);

		fireEvent.click(screen.getByRole('tab', { name: 'Records' }));
		expect(onChange).toHaveBeenCalledWith('records');
	});

	it('moves to the next tab on ArrowRight, wrapping from the last to the first', () => {
		const onChange = vi.fn();
		render(<Tabs options={options} value="records" onChange={onChange} />);

		fireEvent.keyDown(screen.getByRole('tab', { name: 'Records' }), { key: 'ArrowRight' });
		expect(onChange).toHaveBeenCalledWith('history');
	});

	it('moves to the previous tab on ArrowLeft, wrapping from the first to the last', () => {
		const onChange = vi.fn();
		render(<Tabs options={options} value="history" onChange={onChange} />);

		fireEvent.keyDown(screen.getByRole('tab', { name: 'History' }), { key: 'ArrowLeft' });
		expect(onChange).toHaveBeenCalledWith('records');
	});
});
