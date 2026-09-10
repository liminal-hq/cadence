// Variant/tone/size classes render correctly; onClick fires unless disabled.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
	it.each(['filled', 'tonal', 'outlined', 'text'] as const)('renders the %s variant', (variant) => {
		render(<Button variant={variant}>Save</Button>);
		expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(`ui-button--${variant}`);
	});

	it('fires onClick when enabled', () => {
		const onClick = vi.fn();
		render(
			<Button variant="filled" onClick={onClick}>
				Save
			</Button>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Save' }));
		expect(onClick).toHaveBeenCalledOnce();
	});

	it('does not fire onClick when disabled', () => {
		const onClick = vi.fn();
		render(
			<Button variant="filled" disabled onClick={onClick}>
				Save
			</Button>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Save' }));
		expect(onClick).not.toHaveBeenCalled();
	});

	it('applies the error tone class', () => {
		render(
			<Button variant="text" tone="error">
				Delete
			</Button>,
		);
		expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('ui-button--tone-error');
	});

	it('applies fullWidth and size classes', () => {
		render(
			<Button variant="filled" size="large" fullWidth>
				Log set
			</Button>,
		);
		const button = screen.getByRole('button', { name: 'Log set' });
		expect(button).toHaveClass('ui-button--full-width');
		expect(button).toHaveClass('ui-button--size-large');
	});
});
