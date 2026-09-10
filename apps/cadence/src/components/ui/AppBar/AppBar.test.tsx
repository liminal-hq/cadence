// size controls whether a leading back control renders; back supports both a routed Link
// (`to`) and a plain dismiss button (`onClick`); actions and trailingContent render only
// when provided
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppBar } from './AppBar';

vi.mock('@tanstack/react-router', () => ({
	Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
		<a href={to} {...rest}>
			{children}
		</a>
	),
}));

describe('AppBar', () => {
	it('renders no leading control by default', () => {
		render(<AppBar title="Today" />);
		expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
	});

	it('renders a routed Link when back.to is given', () => {
		render(<AppBar title="Bench Press" size="medium" back={{ to: '/today' }} />);
		expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/today');
	});

	it('renders a plain dismiss button when back.onClick is given, with a custom icon/label', () => {
		const onClick = vi.fn();
		render(<AppBar title="Note" size="medium" back={{ icon: 'close', label: 'Close', onClick }} />);

		fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(onClick).toHaveBeenCalledOnce();
	});

	it('renders each action with its own icon button and fires its onClick', () => {
		const onClick = vi.fn();
		render(
			<AppBar
				title="History"
				actions={[
					{ icon: 'search', label: 'Search' },
					{ icon: 'settings', label: 'Settings', onClick },
				]}
			/>,
		);

		expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
		expect(onClick).toHaveBeenCalledOnce();
	});

	it('renders the category tag only when provided', () => {
		const { rerender } = render(<AppBar title="Bench Press" size="medium" />);
		expect(screen.queryByText('chest')).not.toBeInTheDocument();

		rerender(
			<AppBar
				title="Bench Press"
				size="medium"
				tag={{ label: 'chest', background: '#fff', colour: '#000' }}
			/>,
		);
		expect(screen.getByText('chest')).toBeInTheDocument();
	});

	it('renders trailingContent only when provided', () => {
		render(<AppBar title="Note" trailingContent={<button>Save</button>} />);
		expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
	});
});
