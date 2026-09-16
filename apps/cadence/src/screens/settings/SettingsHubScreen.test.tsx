// Verifies the settings hub surfaces a retry when the shared settings load fails, instead of silently showing default-looking statuses with no way to recover
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getMaterialYouColours } from '@liminal-hq/plugin-material-you';
import { SettingsHubScreen } from './SettingsHubScreen';
import { RepositoryProvider } from '../../domain/RepositoryProvider';
import { SettingsProvider, useSettings } from '../../domain/SettingsProvider';
import { MockLoggingRepository } from '../../domain/mockRepository';

// Stands in for a settings sub-screen the user has since navigated away from — the write it
// started can still reject after the hub is what's on screen.
function TriggerFailingWrite() {
	const { updateSettings } = useSettings();
	return <button onClick={() => updateSettings({ weightUnit: 'lb' })}>trigger write</button>;
}

vi.mock('@liminal-hq/plugin-material-you', () => ({
	getMaterialYouColours: vi.fn().mockResolvedValue({ supported: true, apiLevel: 31, palettes: {} }),
}));

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

	it('shows "System" rather than "Material You" when the preference is on but the plugin reports unsupported', async () => {
		vi.mocked(getMaterialYouColours).mockResolvedValueOnce({
			supported: false,
			apiLevel: 0,
			palettes: {},
		});
		const repository = new MockLoggingRepository();

		render(
			<RepositoryProvider repository={repository}>
				<SettingsProvider>
					<SettingsHubScreen />
				</SettingsProvider>
			</RepositoryProvider>,
		);

		await waitFor(() => expect(screen.getByText('Kilograms')).toBeInTheDocument());
		expect(screen.getByText('System')).toBeInTheDocument();
		expect(screen.queryByText('Material You')).not.toBeInTheDocument();
	});

	it('shows "Material You" once the plugin confirms support, matching the on preference', async () => {
		const repository = new MockLoggingRepository();

		render(
			<RepositoryProvider repository={repository}>
				<SettingsProvider>
					<SettingsHubScreen />
				</SettingsProvider>
			</RepositoryProvider>,
		);

		await waitFor(() => expect(screen.getByText('Material You')).toBeInTheDocument());
	});

	it('surfaces a write failure here even if it settles after the originating screen was left', async () => {
		const repository = new MockLoggingRepository();
		vi.spyOn(repository, 'updateSettings').mockRejectedValueOnce(new Error('offline'));

		render(
			<RepositoryProvider repository={repository}>
				<SettingsProvider>
					<TriggerFailingWrite />
					<SettingsHubScreen />
				</SettingsProvider>
			</RepositoryProvider>,
		);
		await waitFor(() => expect(screen.getByText('Kilograms')).toBeInTheDocument());

		await act(async () => {
			screen.getByText('trigger write').click();
		});

		await waitFor(() => expect(screen.getByText('offline')).toBeInTheDocument());

		await act(async () => {
			screen.getByLabelText('Dismiss').click();
		});

		expect(screen.queryByText('offline')).not.toBeInTheDocument();
	});
});
