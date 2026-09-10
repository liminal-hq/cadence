// Action and dismiss are optional and only render when provided; dismiss fires a callback
// rather than hiding itself — the parent owns visibility, same as every other primitive here.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Banner } from './Banner';

describe('Banner', () => {
	it('renders the message', () => {
		render(<Banner icon="wifi_off" message="You're offline." />);
		expect(screen.getByText("You're offline.")).toBeInTheDocument();
	});

	it('omits the action and dismiss controls when not provided', () => {
		render(<Banner icon="wifi_off" message="You're offline." />);
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});

	it('fires the action callback', () => {
		const onClick = vi.fn();
		render(<Banner icon="health_and_safety" message="2 workouts found." action={{ label: 'Review', onClick }} />);

		fireEvent.click(screen.getByRole('button', { name: 'Review' }));
		expect(onClick).toHaveBeenCalledOnce();
	});

	it('fires onDismiss without hiding itself', () => {
		const onDismiss = vi.fn();
		render(<Banner icon="notifications_off" message="Notifications are off." onDismiss={onDismiss} />);

		fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
		expect(onDismiss).toHaveBeenCalledOnce();
		expect(screen.getByText('Notifications are off.')).toBeInTheDocument();
	});
});
