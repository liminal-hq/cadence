// Clicking an option calls onChange, the active option carries aria-current, and disabled options can't be selected
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl', () => {
	const options = [
		{ value: 'calendar' as const, label: 'Calendar', icon: 'calendar_month' },
		{ value: 'list' as const, label: 'List', icon: 'view_list' },
	];

	it('marks the current value as active via aria-current', () => {
		render(<SegmentedControl options={options} value="calendar" onChange={() => {}} />);

		expect(screen.getByRole('button', { name: 'Calendar' })).toHaveAttribute(
			'aria-current',
			'true',
		);
		expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-current', 'false');
	});

	it('calls onChange with the clicked option value', () => {
		const onChange = vi.fn();
		render(<SegmentedControl options={options} value="calendar" onChange={onChange} />);

		fireEvent.click(screen.getByRole('button', { name: 'List' }));
		expect(onChange).toHaveBeenCalledWith('list');
	});

	it('does not fire onChange for a disabled option', () => {
		const onChange = vi.fn();
		render(
			<SegmentedControl
				options={[...options, { value: 'done' as const, label: 'Done', disabled: true }]}
				value="calendar"
				onChange={onChange}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Done' }));
		expect(onChange).not.toHaveBeenCalled();
	});
});
