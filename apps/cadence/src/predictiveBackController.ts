// Bridges the native predictive-back gesture events to React, exposing live progress
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// Mirrors plugins/predictive-back/guest-js/index.ts. Duplicated rather than imported directly:
// that file resolves `@tauri-apps/api` via node_modules lookup starting from its own directory,
// which only finds apps/cadence's copy by walking up through apps/cadence itself — something a
// plain relative import across the plugins/ boundary never does. Keep the two in sync by hand;
// the guest-js copy stays the canonical reference for any future non-Cadence consumer.

interface PredictiveBackEvent {
	type: 'started' | 'progress' | 'cancelled' | 'invoked';
	progress: number;
}

const PREDICTIVE_BACK_EVENT = 'predictive-back:event';

async function setCanGoBackNative(canGoBack: boolean): Promise<void> {
	return await invoke('plugin:predictive-back|set_can_go_back', { payload: { canGoBack } });
}

export interface PredictiveBackState {
	active: boolean;
	progress: number;
}

type Listener = (state: PredictiveBackState) => void;

class PredictiveBackController {
	private listeners = new Set<Listener>();
	private state: PredictiveBackState = { active: false, progress: 0 };
	private unlisten: UnlistenFn | null = null;

	public async init(): Promise<void> {
		if (this.unlisten) return;

		this.unlisten = await listen<PredictiveBackEvent>(PREDICTIVE_BACK_EVENT, (event) => {
			const { type, progress } = event.payload;
			switch (type) {
				case 'started':
				case 'progress':
					this.setState({ active: true, progress });
					break;
				case 'cancelled':
					this.setState({ active: false, progress: 0 });
					break;
				case 'invoked':
					this.setState({ active: false, progress: 1 });
					break;
			}
		});
	}

	public subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		listener(this.state);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/** Always calls through to native rather than caching the last value sent — a cheap,
	 * idempotent round-trip, and the native registration can't be assumed to stay in sync with
	 * whatever we last told it (e.g. it's re-asserted independently on Activity resume, since a
	 * pause/resume cycle like screen off/on doesn't reliably survive with the callback still
	 * registered on the native side). */
	public async setCanGoBack(canGoBack: boolean): Promise<void> {
		try {
			await setCanGoBackNative(canGoBack);
		} catch (e) {
			// Not on Android, or the plugin didn't load — nothing to do.
			console.warn('[PredictiveBackController] setCanGoBack failed', e);
		}
	}

	private setState(partial: Partial<PredictiveBackState>) {
		this.state = { ...this.state, ...partial };
		this.listeners.forEach((listener) => listener(this.state));
	}
}

export const predictiveBackController = new PredictiveBackController();
