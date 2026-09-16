// Verifies the hook applies derived tokens only when the shared preference is on and the plugin reports a full, supported palette, and clears them otherwise
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { getMaterialYouColours } from '@liminal-hq/plugin-material-you';
import { useMaterialYouTheme } from './useMaterialYouTheme';
import { applyMaterialYouTokens } from './applyMaterialYouTokens';
import { RepositoryProvider } from '../domain/RepositoryProvider';
import { SettingsProvider } from '../domain/SettingsProvider';
import { MockLoggingRepository } from '../domain/mockRepository';
import type { Settings } from '../domain/types';

vi.mock('@liminal-hq/plugin-material-you', () => ({
	getMaterialYouColours: vi.fn(),
}));

const FULL_PALETTES = {
	system_accent1: { '400': '#400000', '1000': '#a00000', '900': '#900000', '100': '#100000' },
	system_accent2: { '400': '#004000', '1000': '#00a000', '900': '#009000', '100': '#001000' },
	system_accent3: { '400': '#000040', '1000': '#0000a0', '900': '#000090', '100': '#000010' },
	system_neutral1: { '900': '#909090', '1000': '#f0f0f0', '100': '#101010', '200': '#202020' },
	system_neutral2: { '300': '#0a0a0a', '500': '#0b0b0b', '800': '#0d0d0d' },
};

function renderWithSettings(repository: MockLoggingRepository) {
	function Wrapper({ children }: { children: ReactNode }) {
		return (
			<RepositoryProvider repository={repository}>
				<SettingsProvider>{children}</SettingsProvider>
			</RepositoryProvider>
		);
	}
	return renderHook(() => useMaterialYouTheme(), { wrapper: Wrapper });
}

afterEach(() => {
	applyMaterialYouTokens(null);
	vi.clearAllMocks();
});

describe('useMaterialYouTheme', () => {
	it('applies derived tokens once the palette resolves and the preference is on', async () => {
		vi.mocked(getMaterialYouColours).mockResolvedValue({
			supported: true,
			apiLevel: 31,
			palettes: FULL_PALETTES,
		});

		renderWithSettings(new MockLoggingRepository());

		await waitFor(() =>
			expect(document.documentElement.style.getPropertyValue('--cadence-primary')).toBe('#400000'),
		);
	});

	it('applies nothing when the plugin reports unsupported', async () => {
		vi.mocked(getMaterialYouColours).mockResolvedValue({
			supported: false,
			apiLevel: 0,
			palettes: {},
		});

		renderWithSettings(new MockLoggingRepository());

		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.documentElement.style.getPropertyValue('--cadence-primary')).toBe('');
	});

	it('applies nothing when the shared preference is off, even with a full supported palette', async () => {
		vi.mocked(getMaterialYouColours).mockResolvedValue({
			supported: true,
			apiLevel: 31,
			palettes: FULL_PALETTES,
		});
		class PreferenceOffRepository extends MockLoggingRepository {
			async getSettings(): Promise<Settings> {
				return { ...(await super.getSettings()), useMaterialYou: false };
			}
		}

		renderWithSettings(new PreferenceOffRepository());

		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.documentElement.style.getPropertyValue('--cadence-primary')).toBe('');
	});
});
