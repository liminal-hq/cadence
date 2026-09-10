// The compact docked rest timer bar -- subscribed to the repository's RestTimerState (not
// polled), with a local 1s tick re-deriving the countdown from the last-known target instant
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useRef, useState } from 'react';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { RestTimerState } from '../../domain/types';
import { playRestElapsedChime } from '../../domain/sound';
import { formatRemaining } from './formatRemaining';
import './RestTimerBar.css';

const DEFAULT_REST_MS = 2 * 60 * 1000;

interface RestTimerBarProps {
	onOpen?: () => void;
	onGo?: () => void;
}

export function RestTimerBar({ onOpen, onGo }: RestTimerBarProps) {
	const repository = useLoggingRepository();
	const [state, setState] = useState<RestTimerState>({ status: 'inactive' });
	const [now, setNow] = useState(() => Date.now());
	const previousStatus = useRef(state.status);

	useEffect(() => {
		if (state.status === 'elapsed' && previousStatus.current === 'running') {
			playRestElapsedChime();
		}
		previousStatus.current = state.status;
	}, [state.status]);

	useEffect(() => {
		let cancelled = false;
		repository.getRestTimerState().then((initial) => {
			if (!cancelled) setState(initial);
		});
		const unsubscribe = repository.subscribeRestTimer(setState);
		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [repository]);

	useEffect(() => {
		if (state.status !== 'running') return;
		// Resync immediately -- `now` may be stale from a previous rest period (or mount), and a
		// fresh targetInstant computed against it would show more time remaining than the total
		// until the first 1s tick corrected it.
		setNow(Date.now());
		const interval = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(interval);
	}, [state.status, state.targetInstant]);

	if (state.status === 'inactive') {
		return (
			<div className="rest-timer-bar rest-timer-bar--inactive">
				<span className="material-symbols-rounded rest-timer-bar__icon">timer</span>
				<span className="rest-timer-bar__label">No rest running</span>
				<button
					type="button"
					className="rest-timer-bar__outlined-button"
					onClick={() => repository.startRestTimer(DEFAULT_REST_MS)}
				>
					Start {formatRemaining(DEFAULT_REST_MS)}
				</button>
			</div>
		);
	}

	if (state.status === 'paused') {
		const remainingMs = state.remainingMsAtPause ?? 0;
		return (
			<div className="rest-timer-bar rest-timer-bar--paused">
				<button
					type="button"
					className="rest-timer-bar__tap-target"
					aria-label={`Open rest timer, paused with ${formatRemaining(remainingMs)} remaining`}
					onClick={onOpen}
				>
					<span className="material-symbols-rounded rest-timer-bar__icon" aria-hidden="true">
						pause_circle
					</span>
					<div className="rest-timer-bar__text">
						<span>
							<strong>Paused · {formatRemaining(remainingMs)}</strong>
						</span>
						<span className="rest-timer-bar__muted">on {state.ownerDevice ?? 'phone'}</span>
					</div>
				</button>
				<button
					type="button"
					className="rest-timer-bar__icon-button"
					aria-label="Dismiss"
					onClick={(e) => {
						e.stopPropagation();
						repository.dismissRestTimer();
					}}
				>
					<span className="material-symbols-rounded">close</span>
				</button>
				<button
					type="button"
					className="rest-timer-bar__icon-button"
					aria-label="Resume"
					onClick={(e) => {
						e.stopPropagation();
						repository.resumeRestTimer();
					}}
				>
					<span className="material-symbols-rounded">play_arrow</span>
				</button>
			</div>
		);
	}

	if (state.status === 'elapsed') {
		return (
			<div className="rest-timer-bar rest-timer-bar--elapsed">
				<span className="material-symbols-rounded is-filled rest-timer-bar__icon">
					notifications_active
				</span>
				<div className="rest-timer-bar__text">
					<span>
						<strong>Rest done</strong>
					</span>
					{state.nextSetLabel && (
						<span className="rest-timer-bar__muted">Next · {state.nextSetLabel}</span>
					)}
				</div>
				<button
					type="button"
					className="rest-timer-bar__filled-button"
					onClick={() => {
						repository.dismissRestTimer();
						onGo?.();
					}}
				>
					Go
				</button>
			</div>
		);
	}

	// running
	const targetMs = state.targetInstant ? new Date(state.targetInstant).getTime() : now;
	const remainingMs = Math.max(0, targetMs - now);
	const totalMs = state.totalMs ?? DEFAULT_REST_MS;
	const elapsedFraction = Math.min(1, Math.max(0, 1 - remainingMs / totalMs));

	return (
		<div className="rest-timer-bar rest-timer-bar--running">
			<button
				type="button"
				className="rest-timer-bar__tap-target"
				aria-label={`Open rest timer, ${formatRemaining(remainingMs)} remaining of ${formatRemaining(totalMs)}`}
				onClick={onOpen}
			>
				<span className="material-symbols-rounded rest-timer-bar__icon" aria-hidden="true">
					timer
				</span>
				<div className="rest-timer-bar__text">
					<span className="rest-timer-bar__running-row">
						<strong>Rest {formatRemaining(remainingMs)}</strong>
						<span className="rest-timer-bar__muted">of {formatRemaining(totalMs)}</span>
					</span>
					<div className="rest-timer-bar__progress">
						<div
							className="rest-timer-bar__progress-fill"
							style={{ width: `${elapsedFraction * 100}%` }}
						/>
					</div>
				</div>
			</button>
			<button
				type="button"
				className="rest-timer-bar__chip-button"
				onClick={(e) => {
					e.stopPropagation();
					repository.extendRestTimer(30_000);
				}}
			>
				+30
			</button>
			<button
				type="button"
				className="rest-timer-bar__icon-button"
				aria-label="Pause"
				onClick={(e) => {
					e.stopPropagation();
					repository.pauseRestTimer();
				}}
			>
				<span className="material-symbols-rounded">pause</span>
			</button>
		</div>
	);
}
