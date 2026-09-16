// Loads Settings once and shares it app-wide, so every screen reads/writes through one place instead of each repeating its own fetch-then-patch boilerplate
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLoggingRepository } from './RepositoryProvider';
import type { Settings } from './types';

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

	useEffect(() => {
		repository.getSettings().then(setSettings);
	}, [repository]);

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
