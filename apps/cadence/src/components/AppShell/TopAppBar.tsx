// Tab-root top app bar — a thin, size="large" configuration of the shared AppBar primitive.
// Actions are configured per destination by TabsLayout, not hardcoded here.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { AppBar, type AppBarAction } from '../ui/AppBar/AppBar';

interface TopAppBarProps {
	title: string;
	subtitle?: string;
	actions?: AppBarAction[];
}

export function TopAppBar({ title, subtitle, actions }: TopAppBarProps) {
	return <AppBar title={title} subtitle={subtitle} size="large" actions={actions} />;
}
