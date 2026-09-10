// ScreenStack's promote-and-truncate behaviour on non-linear navigation.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { ScreenStack } from './ScreenStack';

describe('ScreenStack', () => {
	it('has no previous entry until a second screen is pushed', () => {
		const stack = new ScreenStack();
		expect(stack.getPrevious()).toBeNull();

		stack.setCurrent('/today', 'today');
		expect(stack.getPrevious()).toBeNull();
	});

	it('exposes the entry below the current top as previous', () => {
		const stack = new ScreenStack();
		stack.setCurrent('/today', 'today');
		stack.setCurrent('/log/sam-default', 'log');

		expect(stack.getPrevious()).toEqual({ path: '/today', node: 'today' });
	});

	it('refreshes the top entry in place when the same path repeats', () => {
		const stack = new ScreenStack();
		stack.setCurrent('/today', 'today-v1');
		stack.setCurrent('/log/sam-default', 'log');
		stack.setCurrent('/log/sam-default', 'log-v2');

		expect(stack.getPrevious()).toEqual({ path: '/today', node: 'today-v1' });
	});

	it('promotes and truncates when navigating back to a screen deeper in the stack', () => {
		const stack = new ScreenStack();
		stack.setCurrent('/today', 'today');
		stack.setCurrent('/log/sam-default', 'log-a');
		stack.setCurrent('/history', 'history');

		// Non-linear nav: back to /today, which already existed at the bottom.
		stack.setCurrent('/today', 'today-refreshed');

		// /log/sam-default and /history are gone; there's nothing below /today anymore.
		expect(stack.getPrevious()).toBeNull();
	});
});
