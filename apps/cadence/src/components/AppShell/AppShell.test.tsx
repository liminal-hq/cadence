// The bottom nav switches the active screen.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './AppShell';
import type { Destination } from './BottomNav';

describe('AppShell', () => {
	it('reports the destination the user selects', async () => {
		const onDestinationChange = vi.fn<(destination: Destination) => void>();
		render(
			<AppShell title="Today" activeDestination="today" onDestinationChange={onDestinationChange}>
				<div>Today content</div>
			</AppShell>,
		);

		await userEvent.click(screen.getByRole('button', { name: 'History' }));

		expect(onDestinationChange).toHaveBeenCalledWith('history');
	});

	it('marks the active destination for assistive tech', () => {
		render(
			<AppShell title="Today" activeDestination="plan" onDestinationChange={() => {}}>
				<div>Plan content</div>
			</AppShell>,
		);

		expect(screen.getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
		expect(screen.getByRole('button', { name: 'Today' })).not.toHaveAttribute('aria-current');
	});
});
