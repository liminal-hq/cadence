// Vite/React entry point.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { RepositoryProvider } from './domain/RepositoryProvider';
import { mockRepository } from './domain/mockRepository';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<RepositoryProvider repository={mockRepository}>
			<RouterProvider router={router} />
		</RepositoryProvider>
	</React.StrictMode>,
);
