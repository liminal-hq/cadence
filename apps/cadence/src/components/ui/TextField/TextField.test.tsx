// Renders an input by default and a textarea when multiline, and reports value changes
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TextField } from './TextField';

describe('TextField', () => {
	it('renders a single-line input by default and reports changes', () => {
		const onChange = vi.fn();
		render(<TextField label="Name" value="Push day" onChange={onChange} />);

		const input = screen.getByLabelText('Name');
		expect(input.tagName).toBe('INPUT');
		fireEvent.change(input, { target: { value: 'Pull day' } });
		expect(onChange).toHaveBeenCalledWith('Pull day');
	});

	it('renders a textarea when multiline', () => {
		render(<TextField label="Note" value="" onChange={() => {}} multiline />);
		expect(screen.getByLabelText('Note').tagName).toBe('TEXTAREA');
	});

	it('disables the control when disabled', () => {
		render(<TextField label="Name" value="" onChange={() => {}} disabled />);
		expect(screen.getByLabelText('Name')).toBeDisabled();
	});
});
