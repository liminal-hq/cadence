// Loads Settings once and shares it app-wide, so every screen reads/writes through one place instead of each repeating its own fetch-then-patch boilerplate
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Button } from '../components/ui/Button/Button';
import { EmptyState } from '../components/ui/EmptyState/EmptyState';
import { useLoggingRepository } from './RepositoryProvider';
import type { Settings } from './types';
import '../screens/screens.css';

interface SettingsContextValue {
	/** `null` until the initial `getSettings()` call resolves. */
	settings: Settings | null;
	/** The message from the most recent failed `updateSettings` call, if any — cleared on the next attempt. */
	error: string | null;
	updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps {
	children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
	const repository = useLoggingRepository();
	const [settings, setSettings] = useState<Settings | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	// This provider mounts once at the app root rather than per-screen, so — unlike the fetch each settings screen used to run in its own effect — a rejected load has no remount to retry it on; without an explicit retry path here, every settings-dependent screen would stay blank until the app restarts.
	const load = useCallback(() => {
		setLoadError(null);
		repository.getSettings().then(setSettings, (err) => {
			setLoadError(err instanceof Error ? err.message : String(err));
		});
	}, [repository]);

	useEffect(load, [load]);

	async function updateSettings(patch: Partial<Settings>): Promise<void> {
		const previous = settings;
		setSettings((current) => (current ? { ...current, ...patch } : current));
		setError(null);
		try {
			// Trusts the backend's returned row over the optimistic merge above, in case a patch resolves to something other than a literal field-for-field overwrite.
			setSettings(await repository.updateSettings(patch));
		} catch (err) {
			setSettings(previous);
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	if (!settings && loadError) {
		return (
			<div className="screen-shell">
				<div className="screen-shell__content">
					<EmptyState
						headline="Couldn't load settings"
						body={loadError}
						action={
							<Button variant="filled" onClick={load}>
								Try again
							</Button>
						}
					/>
				</div>
			</div>
		);
	}

	return (
		<SettingsContext.Provider value={{ settings, error, updateSettings }}>
			{children}
		</SettingsContext.Provider>
	);
}

export function useSettings(): SettingsContextValue {
	const context = useContext(SettingsContext);
	if (!context) throw new Error('useSettings must be used within a SettingsProvider');
	return context;
}
