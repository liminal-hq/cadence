// P-61 Timer and workout preferences — closes GitHub issue #2's buildable slice: Vibrate and
// Sound toggles plus the phone/watch/both feedback target, against sound.ts's real on/off state
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { SettingsSubScreenHeader } from './SettingsSubScreenHeader';
import { SettingsRow } from './SettingsRow';
import { Switch } from '../../components/ui/Switch/Switch';
import { SegmentedControl } from '../../components/ui/SegmentedControl/SegmentedControl';
import { Banner } from '../../components/ui/Banner/Banner';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import { Chip } from '../../components/ui/Chip/Chip';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { RestFeedbackDevice, Settings } from '../../domain/types';
import { formatRemaining } from '../../components/RestTimerBar/formatRemaining';
import './settings.css';

const DEFAULT_REST_PRESETS_MS = [60_000, 90_000, 120_000, 180_000, 300_000];

export function TimerSettingsScreen() {
	const navigate = useNavigate();
	const repository = useLoggingRepository();
	const [settings, setSettings] = useState<Settings | null>(null);
	const [restPickerOpen, setRestPickerOpen] = useState(false);

	useEffect(() => {
		repository.getSettings().then(setSettings);
	}, [repository]);

	function patch(next: Partial<Settings>) {
		setSettings((current) => (current ? { ...current, ...next } : current));
		repository.updateSettings(next);
	}

	if (!settings) return null;

	return (
		<div className="settings-screen">
			<SettingsSubScreenHeader title="Rest & workout timers" />
			<div className="settings-screen__content">
				{settings.notificationsDenied && (
					<div className="settings-section__body settings-section__body--padded">
						<Banner
							icon="notifications_off"
							message="Notifications are off, so rest-complete alerts won't show outside the app."
							tone="attention"
							action={{ label: 'Turn on', onClick: () => patch({ notificationsDenied: false }) }}
						/>
					</div>
				)}

				<section>
					<div className="settings-section__body">
						<SettingsRow
							icon="timer"
							label="Default rest"
							subtext="Some exercises override this"
							status={formatRemaining(settings.defaultRestMs)}
							onClick={() => setRestPickerOpen(true)}
						/>
						<SettingsRow
							icon="play_circle"
							label="Start rest automatically"
							trailing={
								<Switch
									checked={settings.restAutoStart}
									onChange={(checked) => patch({ restAutoStart: checked })}
									label="Start rest automatically"
								/>
							}
						/>
						<SettingsRow
							icon="restart_alt"
							label="New rest replaces a running one"
							subtext={
								settings.restReplacesRunning
									? undefined
									: 'A new rest request is ignored while one is already running'
							}
							trailing={
								<Switch
									checked={settings.restReplacesRunning}
									onChange={(checked) => patch({ restReplacesRunning: checked })}
									label="New rest replaces a running one"
								/>
							}
						/>
					</div>
				</section>

				<section>
					<h2 className="settings-section__title">Feedback</h2>
					<div className="settings-section__body">
						<SettingsRow
							icon="vibration"
							label="Vibrate"
							trailing={
								<Switch
									checked={settings.vibrateEnabled}
									onChange={(checked) => patch({ vibrateEnabled: checked })}
									label="Vibrate"
								/>
							}
						/>
						<SettingsRow
							icon="volume_up"
							label="Sound"
							subtext="Chime · respects silent mode"
							trailing={
								<Switch
									checked={settings.soundEnabled}
									onChange={(checked) => patch({ soundEnabled: checked })}
									label="Sound"
								/>
							}
						/>
						<SettingsRow icon="devices" label="Which device buzzes at rest end" />
						<div className="settings-section__body--padded">
							<SegmentedControl<RestFeedbackDevice>
								options={[
									{ value: 'watch', label: 'Watch' },
									{ value: 'phone', label: 'Phone' },
									{ value: 'both', label: 'Both' },
								]}
								value={settings.restFeedbackDevice}
								onChange={(value) => patch({ restFeedbackDevice: value })}
							/>
						</div>
					</div>
				</section>

				<section>
					<h2 className="settings-section__title">Workout timer</h2>
					<div className="settings-section__body">
						<SettingsRow
							icon="play_circle"
							label="Start with the workout"
							trailing={
								<Switch
									checked={settings.workoutTimerAutoStart}
									onChange={(checked) => patch({ workoutTimerAutoStart: checked })}
									label="Start with the workout"
								/>
							}
						/>
						<SettingsRow
							icon="lightbulb"
							label="Keep screen on during a workout"
							subtext="Dims after 2 min instead of locking"
							trailing={
								<Switch
									checked={settings.keepScreenOnDuringWorkout}
									onChange={(checked) => patch({ keepScreenOnDuringWorkout: checked })}
									label="Keep screen on during a workout"
								/>
							}
						/>
						<SettingsRow
							icon="tune"
							label="Per-exercise overrides"
							onClick={() => navigate({ to: '/settings/timers/overrides' })}
						/>
					</div>
				</section>
			</div>

			<Dialog
				open={restPickerOpen}
				onClose={() => setRestPickerOpen(false)}
				headline="Default rest"
				role="dialog"
			>
				<div className="settings-rest-picker">
					{DEFAULT_REST_PRESETS_MS.map((ms) => (
						<Chip
							key={ms}
							variant="filter"
							label={formatRemaining(ms)}
							selected={settings.defaultRestMs === ms}
							onClick={() => {
								patch({ defaultRestMs: ms });
								setRestPickerOpen(false);
							}}
						/>
					))}
				</div>
			</Dialog>
		</div>
	);
}
