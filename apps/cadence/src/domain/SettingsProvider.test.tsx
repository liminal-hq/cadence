// Verifies the shared settings context's initial load, optimistic-update-then-reconcile behaviour, and rollback-on-failure — every screen that reads/writes settings goes through this, so a bug here would otherwise surface independently in every one of them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryProvider } from './RepositoryProvider';
import { SettingsProvider, useSettings } from './SettingsProvider';
import { SettingsLoadFailure } from '../screens/settings/SettingsLoadFailure';
import { MockLoggingRepository } from './mockRepository';

function Probe() {
	const { settings, error, clearError, updateSettings } = useSettings();

	if (!settings) return <SettingsLoadFailure />;

	return (
		<div>
			<span data-testid="weight-unit">{settings.weightUnit}</span>
			<span data-testid="error">{error ?? 'none'}</span>
			<button onClick={() => updateSettings({ weightUnit: 'lb' })}>change</button>
			<button onClick={clearError}>dismiss</button>
		</div>
	);
}

function renderProbe(repository: MockLoggingRepository) {
	return render(
		<RepositoryProvider repository={repository}>
			<SettingsProvider>
				<Probe />
			</SettingsProvider>
		</RepositoryProvider>,
	);
}

describe('SettingsProvider', () => {
	it('starts with settings unset and resolves them from the repository', async () => {
		const repository = new MockLoggingRepository();
		renderProbe(repository);

		expect(screen.queryByTestId('weight-unit')).not.toBeInTheDocument();
		await waitFor(() => expect(screen.getByTestId('weight-unit').textContent).toBe('kg'));
	});

	it('optimistically merges a patch, then reconciles to the repository’s own returned value', async () => {
		const repository = new MockLoggingRepository();
		renderProbe(repository);
		await waitFor(() => expect(screen.getByTestId('weight-unit').textContent).toBe('kg'));

		await act(async () => {
			screen.getByText('change').click();
		});

		expect(screen.getByTestId('weight-unit').textContent).toBe('lb');
		expect(await repository.getSettings()).toMatchObject({ weightUnit: 'lb' });
	});

	it('rolls back to the pre-patch value and surfaces an error when the update fails', async () => {
		const repository = new MockLoggingRepository();
		vi.spyOn(repository, 'updateSettings').mockRejectedValueOnce(new Error('offline'));
		renderProbe(repository);
		await waitFor(() => expect(screen.getByTestId('weight-unit').textContent).toBe('kg'));

		await act(async () => {
			screen.getByText('change').click();
		});

		expect(screen.getByTestId('weight-unit').textContent).toBe('kg');
		expect(screen.getByTestId('error').textContent).toBe('offline');

		await act(async () => {
			screen.getByText('dismiss').click();
		});

		expect(screen.getByTestId('error').textContent).toBe('none');
	});

	it('offers a retry when the initial load fails, and recovers once it succeeds', async () => {
		const repository = new MockLoggingRepository();
		vi.spyOn(repository, 'getSettings').mockRejectedValueOnce(new Error('disk full'));
		renderProbe(repository);

		await waitFor(() => expect(screen.getByText("Couldn't load settings")).toBeInTheDocument());
		expect(screen.getByText('disk full')).toBeInTheDocument();

		await act(async () => {
			screen.getByText('Try again').click();
		});

		await waitFor(() => expect(screen.getByTestId('weight-unit').textContent).toBe('kg'));
	});

	it('keeps rendering sibling content that has no dependency on settings when the initial load fails', async () => {
		const repository = new MockLoggingRepository();
		vi.spyOn(repository, 'getSettings').mockRejectedValueOnce(new Error('disk full'));
		render(
			<RepositoryProvider repository={repository}>
				<SettingsProvider>
					<span>settings-independent content</span>
					<Probe />
				</SettingsProvider>
			</RepositoryProvider>,
		);

		await waitFor(() => expect(screen.getByText("Couldn't load settings")).toBeInTheDocument());
		expect(screen.getByText('settings-independent content')).toBeInTheDocument();
	});

	it('throws when used outside a SettingsProvider', () => {
		function Orphan() {
			useSettings();
			return null;
		}
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(() => render(<Orphan />)).toThrow('useSettings must be used within a SettingsProvider');
		consoleError.mockRestore();
	});
});
