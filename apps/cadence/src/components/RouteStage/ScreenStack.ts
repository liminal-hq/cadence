// Path-keyed cache of previously-rendered screens, ported from Threshold's
// ScreenStack. Deliberately unbounded (not capped at depth 2) so a
// Home -> A -> B -> back-to-A -> back sequence still correctly reveals Home.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ReactNode } from 'react';

export interface ScreenStackEntry {
	path: string;
	node: ReactNode;
}

export class ScreenStack {
	private entries: ScreenStackEntry[] = [];

	/**
	 * Refreshes the top entry in place if `path` is already current; promotes
	 * and truncates if `path` exists deeper in the stack (a non-linear "leaf"
	 * navigation, e.g. tapping back into a screen reached a different way);
	 * otherwise pushes a new entry.
	 */
	setCurrent(path: string, node: ReactNode): void {
		const index = this.entries.findIndex((entry) => entry.path === path);

		if (index === this.entries.length - 1) {
			if (index !== -1) this.entries[index] = { path, node };
			else this.entries.push({ path, node });
			return;
		}

		if (index !== -1) {
			this.entries = [...this.entries.slice(0, index), { path, node }];
			return;
		}

		this.entries.push({ path, node });
	}

	getPrevious(): ScreenStackEntry | null {
		if (this.entries.length < 2) return null;
		return this.entries[this.entries.length - 2];
	}
}
