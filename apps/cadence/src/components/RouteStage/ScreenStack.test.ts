// ScreenStack's push/pop/replace behaviour mirroring real browser-history transitions.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { ScreenStack } from './ScreenStack';

describe('ScreenStack', () => {
	it('has no previous entry until a second screen is pushed', () => {
		const stack = new ScreenStack();
		expect(stack.getPrevious()).toBeNull();

		stack.apply('push', '/today', 'today');
		expect(stack.getPrevious()).toBeNull();
	});

	it('exposes the entry below the current top as previous', () => {
		const stack = new ScreenStack();
		stack.apply('push', '/today', 'today');
		stack.apply('push', '/settings', 'settings');

		expect(stack.getPrevious()).toEqual({ path: '/today', node: 'today' });
	});

	it('pop removes the top entry, exposing whatever was pushed before it', () => {
		const stack = new ScreenStack();
		stack.apply('push', '/today', 'today');
		stack.apply('push', '/settings', 'settings');
		stack.apply('push', '/settings/units', 'units');

		stack.apply('pop', '/settings', 'settings');
		expect(stack.getPrevious()).toEqual({ path: '/today', node: 'today' });
	});

	it('replace swaps the top entry in place, leaving previous untouched', () => {
		const stack = new ScreenStack();
		stack.apply('push', '/today', 'today');
		stack.apply('push', '/settings', 'settings-v1');

		stack.apply('replace', '/settings', 'settings-v2');
		expect(stack.getPrevious()).toEqual({ path: '/today', node: 'today' });
	});

	it('push always appends, even to a path already elsewhere in the stack', () => {
		// This is the real-history-alignment case a path-identity-based guess gets wrong: an
		// app-bar "back" link to an already-visited path (e.g. History -> Settings -> Units ->
		// tap a link back to Settings) pushes a genuinely new history entry, not a return to the
		// old one -- router.history.back() from here lands on Units, not History.
		const stack = new ScreenStack();
		stack.apply('push', '/history', 'history');
		stack.apply('push', '/settings', 'settings-a');
		stack.apply('push', '/settings/units', 'units');
		stack.apply('push', '/settings', 'settings-b');

		expect(stack.getPrevious()).toEqual({ path: '/settings/units', node: 'units' });
	});

	it('never pops the last remaining entry', () => {
		const stack = new ScreenStack();
		stack.apply('push', '/today', 'today');

		stack.apply('pop', '/today', 'today');
		expect(stack.getPrevious()).toBeNull();
	});
});
