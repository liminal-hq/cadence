// P-17 Rest timer, expanded -- opened by tapping the docked RestTimerBar. Same repository-backed
// state as the bar; this just adds the full-screen ring, nudge controls, and device-ownership
// footer
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { BottomSheet } from '../BottomSheet/BottomSheet';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { RestTimerState } from '../../domain/types';
import { formatRemaining } from '../RestTimerBar/formatRemaining';
import './RestTimerSheet.css';

interface RestTimerSheetProps {
	hasWatch: boolean;
	notificationsDenied?: boolean;
	onClose: () => void;
	onGo?: () => void;
}

export function RestTimerSheet({
	hasWatch,
	notificationsDenied,
	onClose,
	onGo,
}: RestTimerSheetProps) {
	const repository = useLoggingRepository();
	const [state, setState] = useState<RestTimerState | null>(null);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		let cancelled = false;
		repository.getRestTimerState().then((initial) => {
			if (!cancelled) setState(initial);
		});
		return () => {
			cancelled = true;
		};
	}, [repository]);

	useEffect(() => repository.subscribeRestTimer(setState), [repository]);

	useEffect(() => {
		if (state?.status !== 'running') return;
		// Resync immediately -- `now` may be stale from before this rest period started, and a
		// fresh targetInstant computed against it would briefly show the wrong remaining time.
		setNow(Date.now());
		const interval = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(interval);
	}, [state?.status, state?.targetInstant]);

	useEffect(() => {
		// Only auto-close once the real state has loaded and then goes inactive
		// (e.g. via Go/Skip) -- `state` starts null while the initial fetch is
		// in flight, and must not be mistaken for "already inactive".
		if (state?.status === 'inactive') onClose();
	}, [state?.status, onClose]);

	if (state === null || state.status === 'inactive') return null;

	const haptics = hasWatch ? (
		<span className="rest-timer-sheet__badge">
			<span className="material-symbols-rounded">watch</span>
			Haptics on watch
		</span>
	) : (
		<span className="rest-timer-sheet__badge">
			<span className="material-symbols-rounded">phone_android</span>
			Haptics on phone
		</span>
	);

	if (state.status === 'elapsed') {
		return (
			<BottomSheet onClose={onClose} ariaLabel="Rest timer">
				<div className="rest-timer-sheet">
					<div className="rest-timer-sheet__header">
						<span className="rest-timer-sheet__resting-label">Rested after</span>
						{haptics}
					</div>

					<div className="rest-timer-sheet__disc">
						<span className="material-symbols-rounded is-filled">notifications_active</span>
						<span className="rest-timer-sheet__disc-headline">Rest done</span>
					</div>

					<div className="rest-timer-sheet__controls">
						<button
							type="button"
							className="rest-timer-sheet__primary-cta"
							onClick={() => {
								repository.dismissRestTimer();
								onGo?.();
								onClose();
							}}
						>
							{state.nextSetLabel ?? 'Continue'}
							<span className="material-symbols-rounded">arrow_forward</span>
						</button>
						<button
							type="button"
							className="rest-timer-sheet__secondary"
							onClick={() =>
								repository.startRestTimer(30_000, { nextSetLabel: state.nextSetLabel })
							}
						>
							+30 more
						</button>
					</div>

					{notificationsDenied && (
						<div className="rest-timer-sheet__warning">
							<span className="material-symbols-rounded">notifications_off</span>
							<div>
								<strong>Notifications are off for Cadence.</strong>
								<div>The rest timer only sounds while the app is open.</div>
							</div>
							<button type="button">Turn on</button>
						</div>
					)}

					<div className="rest-timer-sheet__footer">
						<span>
							<span className="material-symbols-rounded">vibration</span>
							{hasWatch ? 'Watch vibrated' : 'Phone vibrated'}
						</span>
						<span>
							<span className="material-symbols-rounded">
								{hasWatch ? 'volume_off' : 'volume_up'}
							</span>
							{hasWatch ? 'Phone silent' : 'Chime played'}
						</span>
						<span>
							<span className="material-symbols-rounded">{hasWatch ? 'watch' : 'watch_off'}</span>
							{hasWatch ? 'Synced to watch' : 'No watch'}
						</span>
					</div>
				</div>
			</BottomSheet>
		);
	}

	// running or paused
	const isPaused = state.status === 'paused';
	const totalMs = state.totalMs ?? 0;
	const remainingMs = isPaused
		? (state.remainingMsAtPause ?? 0)
		: Math.max(0, (state.targetInstant ? new Date(state.targetInstant).getTime() : now) - now);
	const fraction = totalMs > 0 ? Math.min(1, Math.max(0, 1 - remainingMs / totalMs)) : 0;
	const endsAt = state.targetInstant
		? new Date(state.targetInstant).toLocaleTimeString('en-CA', {
				hour: 'numeric',
				minute: '2-digit',
				second: '2-digit',
			})
		: undefined;

	return (
		<BottomSheet onClose={onClose} ariaLabel="Rest timer">
			<div className="rest-timer-sheet">
				<div className="rest-timer-sheet__header">
					<span className="rest-timer-sheet__resting-label">{isPaused ? 'Paused' : 'Resting'}</span>
					{haptics}
				</div>

				<div
					className="rest-timer-sheet__ring"
					style={{
						background: `conic-gradient(var(--cadence-primary) ${fraction * 360}deg, var(--cadence-surface-container-highest) 0)`,
					}}
				>
					<div className="rest-timer-sheet__ring-inner">
						<span className="rest-timer-sheet__time">{formatRemaining(remainingMs)}</span>
						<span className="rest-timer-sheet__ring-caption">
							of {formatRemaining(totalMs)}
							{endsAt && !isPaused && ` · ends ${endsAt}`}
						</span>
					</div>
				</div>

				<div className="rest-timer-sheet__controls">
					<button
						type="button"
						className="rest-timer-sheet__nudge"
						onClick={() => repository.extendRestTimer(-15_000)}
					>
						−15
					</button>
					<button
						type="button"
						className="rest-timer-sheet__play-pause"
						aria-label={isPaused ? 'Resume' : 'Pause'}
						onClick={() => (isPaused ? repository.resumeRestTimer() : repository.pauseRestTimer())}
					>
						<span className="material-symbols-rounded is-filled">
							{isPaused ? 'play_arrow' : 'pause'}
						</span>
					</button>
					<button
						type="button"
						className="rest-timer-sheet__nudge"
						onClick={() => repository.extendRestTimer(30_000)}
					>
						+30
					</button>
				</div>

				<div className="rest-timer-sheet__secondary-row">
					<button
						type="button"
						className="rest-timer-sheet__outlined"
						onClick={() => repository.startRestTimer(totalMs)}
					>
						<span className="material-symbols-rounded">restart_alt</span>
						Reset {formatRemaining(totalMs)}
					</button>
					<button
						type="button"
						className="rest-timer-sheet__outlined"
						onClick={() => repository.dismissRestTimer()}
					>
						<span className="material-symbols-rounded">skip_next</span>
						Skip rest
					</button>
				</div>

				{state.nextSetLabel && (
					<div className="rest-timer-sheet__up-next">
						<div>
							<span className="rest-timer-sheet__up-next-label">Up next</span>
							<div>{state.nextSetLabel}</div>
						</div>
						<button type="button" onClick={onClose}>
							Open
						</button>
					</div>
				)}

				<div className="rest-timer-sheet__footer">
					<span>
						<span className="material-symbols-rounded">vibration</span>
						{hasWatch ? 'Watch vibrates' : 'Phone vibrates'}
					</span>
					<span>
						<span className="material-symbols-rounded">
							{hasWatch ? 'volume_off' : 'volume_up'}
						</span>
						{hasWatch ? 'Phone silent' : 'Sound on'}
					</span>
					<span>
						<span className="material-symbols-rounded">notifications</span>
						Notification on
					</span>
				</div>
			</div>
		</BottomSheet>
	);
}
