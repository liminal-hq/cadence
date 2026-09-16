// Verifies the settings hub surfaces a retry when the shared settings load fails, instead of silently showing default-looking statuses with no way to recover
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsHubScreen } from './SettingsHubScreen';
import { RepositoryProvider } from '../../domain/RepositoryProvider';
import { SettingsProvider } from '../../domain/SettingsProvider';
import { MockLoggingRepository } from '../../domain/mockRepository';

vi.mock('@tanstack/react-router', () => ({
	Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
		<a href={to} {...rest}>
			{children}
		</a>
	),
	useNavigate: () => vi.fn(),
}));

const BANNER_TEXT = "Couldn't load settings — statuses below may not be accurate until you retry.";

describe('SettingsHubScreen', () => {
	it('offers a retry banner when the shared settings load fails, and clears it once the retry succeeds', async () => {
		const repository = new MockLoggingRepository();
		vi.spyOn(repository, 'getSettings').mockRejectedValueOnce(new Error('disk full'));

		render(
			<RepositoryProvider repository={repository}>
				<SettingsProvider>
					<SettingsHubScreen />
				</SettingsProvider>
			</RepositoryProvider>,
		);

		await waitFor(() => expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument());

		await act(async () => {
			screen.getByText('Try again').click();
		});

		await waitFor(() => expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument());
	});

	it('renders no banner once the shared settings load succeeds', async () => {
		const repository = new MockLoggingRepository();

		render(
			<RepositoryProvider repository={repository}>
				<SettingsProvider>
					<SettingsHubScreen />
				</SettingsProvider>
			</RepositoryProvider>,
		);

		await waitFor(() => expect(screen.getByText('Kilograms')).toBeInTheDocument());
		expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
	});
});
