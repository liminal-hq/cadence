// Supplies the active LoggingRepository to the component tree. `main.tsx` passes the real
// `tauriRepository`; tests pass `mockRepository` instead — no component changes either way.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { createContext, useContext, type ReactNode } from 'react';
import type { LoggingRepository } from './repository';

const RepositoryContext = createContext<LoggingRepository | null>(null);

interface RepositoryProviderProps {
	repository: LoggingRepository;
	children: ReactNode;
}

export function RepositoryProvider({ repository, children }: RepositoryProviderProps) {
	return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>;
}

export function useLoggingRepository(): LoggingRepository {
	const repository = useContext(RepositoryContext);
	if (!repository) throw new Error('useLoggingRepository must be used within a RepositoryProvider');
	return repository;
}
