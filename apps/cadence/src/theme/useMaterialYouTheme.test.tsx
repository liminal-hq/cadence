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

// Keyed by Android's real suffix-to-tone mapping (suffix 0 = tone 100 ... suffix 1000 = tone 0),
// not `tone * 10` — see materialYouTokens.ts's own comment for why.
const FULL_PALETTES = {
	system_accent1: {
		'900': '#100000',
		'800': '#200000',
		'600': '#400000',
		'200': '#800000',
		'100': '#900000',
		'0': '#a00000',
	},
	system_accent2: {
		'900': '#001000',
		'800': '#002000',
		'600': '#004000',
		'200': '#008000',
		'100': '#009000',
		'0': '#00a000',
	},
	system_accent3: {
		'900': '#000010',
		'800': '#000020',
		'600': '#000040',
		'200': '#000080',
		'100': '#000090',
		'0': '#0000a0',
	},
	system_neutral1: {
		'1000': '#000000',
		'900': '#101010',
		'800': '#202020',
		'700': '#303030',
		'100': '#909090',
		'50': '#f0f0f0',
		'10': '#fafafa',
		'0': '#ffffff',
	},
	system_neutral2: { '700': '#0a0a0a', '500': '#0b0b0b', '400': '#0c0c0c', '200': '#0d0d0d' },
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
