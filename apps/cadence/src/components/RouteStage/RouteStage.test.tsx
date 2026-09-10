// RouteStage stays inert (no underlay, no transform) with no gesture source.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouteStage } from './RouteStage';

let mockPathname = '/today';
vi.mock('@tanstack/react-router', () => ({
	useLocation: () => ({ pathname: mockPathname }),
}));

describe('RouteStage', () => {
	it('renders the current route with no underlay when nothing is dragging', () => {
		mockPathname = '/today';
		const { container } = render(
			<RouteStage>
				<div>Today content</div>
			</RouteStage>,
		);

		expect(screen.getByText('Today content')).toBeInTheDocument();
		expect(container.querySelector('.route-stage__underlay')).toBeNull();
	});

	it('stays inert (no underlay) across a route change, since no gesture source exists yet', () => {
		mockPathname = '/today';
		const { rerender, container } = render(
			<RouteStage>
				<div>Today content</div>
			</RouteStage>,
		);

		mockPathname = '/log/sam-default';
		rerender(
			<RouteStage>
				<div>Logging content</div>
			</RouteStage>,
		);

		expect(screen.getByText('Logging content')).toBeInTheDocument();
		expect(container.querySelector('.route-stage__underlay')).toBeNull();
	});
});
