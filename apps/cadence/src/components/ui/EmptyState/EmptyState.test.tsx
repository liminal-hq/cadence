// Headline/body always render; action/children are optional slots, not required.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
	it('renders the headline and body', () => {
		render(<EmptyState headline="No history yet" body="Log a set to get started." />);

		expect(screen.getByText('No history yet')).toBeInTheDocument();
		expect(screen.getByText('Log a set to get started.')).toBeInTheDocument();
	});

	it('renders an action node when provided', () => {
		render(
			<EmptyState
				headline="No history yet"
				body="Log a set to get started."
				action={<button>Start</button>}
			/>,
		);

		expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
	});

	it('omits any action when none is provided', () => {
		render(<EmptyState headline="No history yet" body="Log a set to get started." />);

		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});
});
