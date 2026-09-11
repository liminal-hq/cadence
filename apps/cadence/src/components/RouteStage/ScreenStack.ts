// Path-keyed stack of previously-rendered screens, mirroring real browser-history transitions
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ReactNode } from 'react';

export interface ScreenStackEntry {
	path: string;
	node: ReactNode;
}

export type ScreenStackAction = 'push' | 'pop' | 'replace';

/**
 * Mirrors `router.history`'s own PUSH/POP/REPLACE actions exactly, rather than guessing a
 * transition's shape from path identity: an earlier version treated "does this path already
 * exist deeper in the stack?" as "the user went back to it," truncating there -- but a plain
 * `<Link to="/settings">` back button pushes a genuinely new history entry even when `/settings`
 * was already visited, so that guess diverges from what `router.history.back()` actually returns
 * to the moment any in-app link points at an already-visited path. Driving this off the real
 * action type keeps the stack and the browser's own history in lockstep by construction.
 */
export class ScreenStack {
	private entries: ScreenStackEntry[] = [];

	apply(action: ScreenStackAction, path: string, node: ReactNode): void {
		if (action === 'pop') {
			// Never pop the last entry -- there's nowhere further back to go, and an unexpected
			// extra BACK action (e.g. from outside the app's own tracked history) shouldn't leave
			// the stack empty.
			if (this.entries.length > 1) this.entries.pop();
			return;
		}

		if (action === 'replace' && this.entries.length > 0) {
			this.entries[this.entries.length - 1] = { path, node };
			return;
		}

		this.entries.push({ path, node });
	}

	getPrevious(): ScreenStackEntry | null {
		if (this.entries.length < 2) return null;
		return this.entries[this.entries.length - 2];
	}
}
