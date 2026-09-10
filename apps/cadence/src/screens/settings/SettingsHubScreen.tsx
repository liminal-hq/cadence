// P-60 Settings hub — a single scrollable list grouped under SPEC.md section 8.10's seven
// headings, every row a real navigation target (Version is the one static exception)
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AppBar } from '../../components/ui/AppBar/AppBar';
import { SettingsRow } from './SettingsRow';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { Settings } from '../../domain/types';
import { CATEGORY_COLOURS } from '../../data/categoryColours';
import './settings.css';

const CADENCE_VERSION = '2026.9.0';

interface SettingsSection {
	title: string;
	rows: {
		icon: string;
		label: string;
		status?: string;
		statusTone?: 'default' | 'attention';
		to: string;
	}[];
}

export function SettingsHubScreen() {
	const navigate = useNavigate();
	const repository = useLoggingRepository();
	const [settings, setSettings] = useState<Settings | null>(null);
	const [barbellCount, setBarbellCount] = useState(0);

	useEffect(() => {
		repository.getSettings().then(setSettings);
		repository.listBarbellConfigs().then((list) => setBarbellCount(list.length));
	}, [repository]);

	const sections: SettingsSection[] = [
		{
			title: 'Training',
			rows: [
				{
					icon: 'straighten',
					label: 'Units',
					status: settings?.weightUnit === 'lb' ? 'Pounds' : 'Kilograms',
					to: '/settings/units',
				},
				{ icon: 'timer', label: 'Rest & workout timers', to: '/settings/timers' },
				{ icon: 'functions', label: '1RM formula', status: 'Epley', to: '/settings/1rm-formula' },
			],
		},
		{
			title: 'Exercises and equipment',
			rows: [
				{
					icon: 'fitness_center',
					label: 'Plates & barbells',
					status: `${barbellCount} config${barbellCount === 1 ? '' : 's'}`,
					to: '/settings/plates',
				},
				{
					icon: 'label',
					label: 'Categories',
					status: `${Object.keys(CATEGORY_COLOURS).length} categories`,
					to: '/settings/categories',
				},
			],
		},
		{
			title: 'History and progress',
			rows: [
				{
					icon: 'calendar_month',
					label: 'Week start & graphs',
					status: 'Monday',
					to: '/settings/graphs',
				},
			],
		},
		{
			title: 'Appearance and accessibility',
			rows: [
				{
					icon: 'palette',
					label: 'Theme & wallpaper colours',
					status: 'System',
					to: '/settings/theme',
				},
				{ icon: 'vibration', label: 'Motion, haptics & sound', to: '/settings/accessibility' },
			],
		},
		{
			title: 'Devices and integrations',
			rows: [
				{
					icon: 'watch',
					label: 'Wear OS watch',
					status: '1 conflict',
					statusTone: 'attention',
					to: '/settings/watch',
				},
				{
					icon: 'favorite',
					label: 'Health Connect',
					status: 'Not connected',
					to: '/settings/health-connect',
				},
				{
					icon: 'notifications',
					label: 'Notifications, widgets & shortcuts',
					status: settings?.notificationsDenied ? 'Off' : 'On',
					statusTone: settings?.notificationsDenied ? 'attention' : 'default',
					to: '/settings/notifications',
				},
			],
		},
		{
			title: 'Data and privacy',
			rows: [
				{ icon: 'backup', label: 'Backup & data', to: '/settings/data' },
				{ icon: 'bug_report', label: 'Diagnostics & experiments', to: '/settings/diagnostics' },
			],
		},
	];

	return (
		<div className="settings-screen">
			{/* Settings is a top-level route outside TabsLayout (like /log/$scenario), so it has
			    no bottom nav — back is the only way out until a real caller (History's own
			    screen, once PR C lands) replaces this fallback with its own contextual origin. */}
			<AppBar title="Settings" size="large" back={{ to: '/today' }} />
			<div className="settings-screen__content">
				{sections.map((section) => (
					<section key={section.title}>
						<h2 className="settings-section__title">{section.title}</h2>
						<div className="settings-section__body">
							{section.rows.map((row) => (
								<SettingsRow
									key={row.label}
									icon={row.icon}
									label={row.label}
									status={row.status}
									statusTone={row.statusTone}
									onClick={() => navigate({ to: row.to })}
								/>
							))}
						</div>
					</section>
				))}
				<section>
					<h2 className="settings-section__title">About</h2>
					<div className="settings-section__body">
						<SettingsRow icon="info" label="Version" status={CADENCE_VERSION} />
					</div>
				</section>
			</div>
		</div>
	);
}
