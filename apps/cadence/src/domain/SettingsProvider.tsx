// Loads Settings once and shares it app-wide, so every screen reads/writes through one place instead of each repeating its own fetch-then-patch boilerplate
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import { useLoggingRepository } from './RepositoryProvider';
import type { Settings } from './types';

interface SettingsContextValue {
	/** `null` until the initial `getSettings()` call resolves. */
	settings: Settings | null;
	/** The message from the most recent failed `updateSettings` call, if any — cleared on the next attempt or by calling `clearError`. */
	error: string | null;
	clearError: () => void;
	/** Set only when the initial load itself failed — distinct from `error`, which is about a failed write against already-loaded settings. */
	loadError: string | null;
	/** Retries the initial load. This provider mounts once at the app root rather than per-screen, so — unlike the fetch each settings screen used to run in its own effect — a rejected load has no remount to retry it on; a settings-dependent screen calls this itself rather than the provider retrying on its own. */
	reload: () => void;
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
	// Guards against an earlier write's rollback or stale success clobbering a later write that has since superseded it — only the most-recently-issued call is still allowed to touch `settings` once it settles.
	const latestRequestId = useRef(0);

	const reload = useCallback(() => {
		setLoadError(null);
		repository.getSettings().then(setSettings, (err) => {
			setLoadError(err instanceof Error ? err.message : String(err));
		});
	}, [repository]);

	useEffect(reload, [reload]);

	async function updateSettings(patch: Partial<Settings>): Promise<void> {
		const requestId = ++latestRequestId.current;
		const previous = settings;
		setSettings((current) => (current ? { ...current, ...patch } : current));
		setError(null);
		try {
			// Trusts the backend's returned row over the optimistic merge above, in case a patch resolves to something other than a literal field-for-field overwrite.
			const updated = await repository.updateSettings(patch);
			if (requestId === latestRequestId.current) setSettings(updated);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			if (requestId === latestRequestId.current) setSettings(previous);
		}
	}

	return (
		<SettingsContext.Provider
			value={{
				settings,
				error,
				clearError: () => setError(null),
				loadError,
				reload,
				updateSettings,
			}}
		>
			{children}
		</SettingsContext.Provider>
	);
}

export function useSettings(): SettingsContextValue {
	const context = useContext(SettingsContext);
	if (!context) throw new Error('useSettings must be used within a SettingsProvider');
	return context;
}
