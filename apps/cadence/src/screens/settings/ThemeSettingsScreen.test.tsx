// Verifies the Material You toggle is gated on the plugin's own supported result, not on platform alone — Android 8-11 still reports platformType 'android' but the plugin resolves unsupported there
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getMaterialYouColours } from '@liminal-hq/plugin-material-you';
import { ThemeSettingsScreen } from './ThemeSettingsScreen';
import { RepositoryProvider } from '../../domain/RepositoryProvider';
import { SettingsProvider } from '../../domain/SettingsProvider';
import { MockLoggingRepository } from '../../domain/mockRepository';

vi.mock('@liminal-hq/plugin-material-you', () => ({
	getMaterialYouColours: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
	Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
		<a href={to} {...rest}>
			{children}
		</a>
	),
}));

function renderScreen() {
	return render(
		<RepositoryProvider repository={new MockLoggingRepository()}>
			<SettingsProvider>
				<ThemeSettingsScreen />
			</SettingsProvider>
		</RepositoryProvider>,
	);
}

describe('ThemeSettingsScreen', () => {
	it('disables the toggle when the plugin reports unsupported, even though the platform is Android', async () => {
		vi.mocked(getMaterialYouColours).mockResolvedValue({
			supported: false,
			apiLevel: 30,
			palettes: {},
		});

		renderScreen();

		await waitFor(() => expect(screen.getByRole('switch')).toBeDisabled());
		expect(screen.getByText('Available on Android 12 and above')).toBeInTheDocument();
	});

	it('enables the toggle once the plugin reports supported', async () => {
		vi.mocked(getMaterialYouColours).mockResolvedValue({
			supported: true,
			apiLevel: 31,
			palettes: {},
		});

		renderScreen();

		await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
		expect(screen.getByText("Match the app's colours to your wallpaper")).toBeInTheDocument();
	});
});
