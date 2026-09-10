// Configures AppBar as size="large" with the given title/subtitle/actions, without
// re-testing AppBar's own rendering, just that this wrapper passes the right props through
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopAppBar } from './TopAppBar';

describe('TopAppBar', () => {
	it('renders the title, subtitle, and given actions', () => {
		render(
			<TopAppBar
				title="History"
				subtitle="Thu 21 Aug"
				actions={[{ icon: 'search', label: 'Search' }]}
			/>,
		);

		expect(screen.getByText('History')).toBeInTheDocument();
		expect(screen.getByText('Thu 21 Aug')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
	});
});
