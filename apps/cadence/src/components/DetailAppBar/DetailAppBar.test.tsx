// Confirms this wrapper configures AppBar as size="medium" with the category tag and backTo
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DetailAppBar } from './DetailAppBar';

vi.mock('@tanstack/react-router', () => ({
	Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
		<a href={to} {...rest}>
			{children}
		</a>
	),
}));

describe('DetailAppBar', () => {
	it('renders the title, category tag, and a Link pointed at backTo', () => {
		render(<DetailAppBar title="Bench Press" category="chest" backTo="/today" />);

		expect(screen.getByText('Bench Press')).toBeInTheDocument();
		expect(screen.getByText('chest')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/today');
	});

	it('renders the given actions', () => {
		render(
			<DetailAppBar
				title="Bench Press"
				category="chest"
				backTo="/today"
				actions={[{ icon: 'more_vert', label: 'More' }]}
			/>,
		);

		expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
	});
});
