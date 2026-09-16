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
import type { Settings } from './types';

vi.mock('@tanstack/react-router', () => ({
	Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
		<a href={to} {...rest}>
			{children}
		</a>
	),
}));

function Probe() {
	const { settings, error, clearError, loadError, reload, updateSettings } = useSettings();

	if (!settings) return <SettingsLoadFailure title="Test settings" />;

	return (
		<div>
			<span data-testid="weight-unit">{settings.weightUnit}</span>
			<span data-testid="error">{error ?? 'none'}</span>
			<span data-testid="load-error">{loadError ?? 'none'}</span>
			<button onClick={() => updateSettings({ weightUnit: 'lb' })}>change</button>
			<button onClick={clearError}>dismiss</button>
			<button onClick={reload}>manual reload</button>
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

	it('keeps a later successful write even when an earlier write rejects afterward', async () => {
		const repository = new MockLoggingRepository();
		renderProbe(repository);
		await waitFor(() => expect(screen.getByTestId('weight-unit').textContent).toBe('kg'));

		let rejectFirst: (err: Error) => void = () => {};
		let resolveSecond: (value: Settings) => void = () => {};
		const first = new Promise<Settings>((_, reject) => {
			rejectFirst = reject;
		});
		const second = new Promise<Settings>((resolve) => {
			resolveSecond = resolve;
		});
		vi.spyOn(repository, 'updateSettings').mockReturnValueOnce(first).mockReturnValueOnce(second);

		act(() => {
			screen.getByText('change').click();
			screen.getByText('change').click();
		});

		const afterSecond: Settings = { ...(await repository.getSettings()), weightUnit: 'lb' };
		await act(async () => resolveSecond(afterSecond));
		await waitFor(() => expect(screen.getByTestId('weight-unit').textContent).toBe('lb'));

		await act(async () => rejectFirst(new Error('offline')));

		await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('offline'));
		expect(screen.getByTestId('weight-unit').textContent).toBe('lb');
	});

	it('serializes writes so a backend call for an earlier patch is never still in flight when a later one starts', async () => {
		const repository = new MockLoggingRepository();
		renderProbe(repository);
		await waitFor(() => expect(screen.getByTestId('weight-unit').textContent).toBe('kg'));

		const calls: number[] = [];
		let resolveFirst: (value: Settings) => void = () => {};
		const first = new Promise<Settings>((resolve) => {
			resolveFirst = resolve;
		});
		vi.spyOn(repository, 'updateSettings').mockImplementation(async (patch) => {
			calls.push(calls.length);
			if (calls.length === 1) await first;
			return { ...(await repository.getSettings()), ...patch };
		});

		await act(async () => {
			screen.getByText('change').click();
			screen.getByText('change').click();
		});

		// The second call must not have reached the repository yet — it's queued behind the first.
		expect(calls).toEqual([0]);

		await act(async () => resolveFirst(await repository.getSettings()));
		await waitFor(() => expect(calls).toEqual([0, 1]));
	});

	it('rolls back to the last backend-confirmed value, not another failed write’s optimistic snapshot, when queued writes fail in turn', async () => {
		const repository = new MockLoggingRepository();
		renderProbe(repository);
		await waitFor(() => expect(screen.getByTestId('weight-unit').textContent).toBe('kg'));

		let callIndex = 0;
		vi.spyOn(repository, 'updateSettings').mockImplementation(async () => {
			callIndex += 1;
			throw new Error(callIndex === 1 ? 'offline' : 'offline again');
		});

		await act(async () => {
			screen.getByText('change').click();
			screen.getByText('change').click();
		});

		await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('offline again'));
		expect(screen.getByTestId('weight-unit').textContent).toBe('kg');
	});

	it('ignores a stale reload’s success once a newer reload has already settled', async () => {
		const repository = new MockLoggingRepository();
		const baseline = await repository.getSettings();
		let resolveStale: (value: Settings) => void = () => {};
		const stale = new Promise<Settings>((resolve) => {
			resolveStale = resolve;
		});
		let callIndex = 0;
		vi.spyOn(repository, 'getSettings').mockImplementation(async () => {
			callIndex += 1;
			if (callIndex === 1) return baseline;
			if (callIndex === 2) return stale;
			return { ...baseline, weightUnit: 'lb' };
		});

		renderProbe(repository);
		await waitFor(() => expect(screen.getByTestId('weight-unit').textContent).toBe('kg'));

		await act(async () => {
			screen.getByText('manual reload').click(); // stale, stays pending
			screen.getByText('manual reload').click(); // resolves immediately
		});
		await waitFor(() => expect(screen.getByTestId('weight-unit').textContent).toBe('lb'));

		await act(async () => resolveStale(baseline));

		expect(screen.getByTestId('weight-unit').textContent).toBe('lb');
	});

	it('ignores a stale reload’s failure once a newer reload has already succeeded', async () => {
		const repository = new MockLoggingRepository();
		const baseline = await repository.getSettings();
		let rejectStale: (err: Error) => void = () => {};
		const stale = new Promise<Settings>((_, reject) => {
			rejectStale = reject;
		});
		let callIndex = 0;
		vi.spyOn(repository, 'getSettings').mockImplementation(async () => {
			callIndex += 1;
			if (callIndex === 1) return baseline;
			if (callIndex === 2) return stale;
			return baseline;
		});

		renderProbe(repository);
		await waitFor(() => expect(screen.getByTestId('weight-unit').textContent).toBe('kg'));

		await act(async () => {
			screen.getByText('manual reload').click(); // stale, stays pending
			screen.getByText('manual reload').click(); // resolves immediately
		});
		await waitFor(() => expect(screen.getByTestId('load-error').textContent).toBe('none'));

		await act(async () => rejectStale(new Error('stale disk error')));

		expect(screen.getByTestId('load-error').textContent).toBe('none');
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
