// A size="medium" AppBar defaulting back to the Settings hub, shared by every Settings
// sub-screen — none of them carry a category tag, unlike DetailAppBar's exercise screens
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { AppBar, type AppBarAction } from '../../components/ui/AppBar/AppBar';

interface SettingsSubScreenHeaderProps {
	title: string;
	backTo?: string;
	actions?: AppBarAction[];
}

export function SettingsSubScreenHeader({
	title,
	backTo = '/settings',
	actions,
}: SettingsSubScreenHeaderProps) {
	return <AppBar title={title} size="medium" back={{ to: backTo }} actions={actions} />;
}
