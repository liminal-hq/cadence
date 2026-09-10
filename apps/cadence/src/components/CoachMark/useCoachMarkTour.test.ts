// The 5-step tour advances, skips from any step, and finishes with no counter.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCoachMarkTour } from './useCoachMarkTour';

describe('useCoachMarkTour', () => {
	it('does not start when autoStart is false', () => {
		const { result } = renderHook(() => useCoachMarkTour(false));
		expect(result.current.active).toBe(false);
		expect(result.current.step).toBe(0);
	});

	it('advances through all 5 steps via next, then finishes', () => {
		const { result } = renderHook(() => useCoachMarkTour(true));
		expect(result.current.active).toBe(true);
		expect(result.current.step).toBe(0);
		expect(result.current.isLastStep).toBe(false);

		for (let expectedStep = 1; expectedStep < 5; expectedStep++) {
			act(() => result.current.next());
			expect(result.current.active).toBe(true);
			expect(result.current.step).toBe(expectedStep);
		}
		expect(result.current.isLastStep).toBe(true);

		act(() => result.current.next());
		expect(result.current.active).toBe(false);
		expect(result.current.step).toBe(4);
	});

	it('skips from any step', () => {
		const { result } = renderHook(() => useCoachMarkTour(true));
		act(() => result.current.next());
		act(() => result.current.next());
		expect(result.current.step).toBe(2);

		act(() => result.current.skip());
		expect(result.current.active).toBe(false);
	});

	it('ignores next once inactive', () => {
		const { result } = renderHook(() => useCoachMarkTour(true));
		act(() => result.current.skip());
		act(() => result.current.next());
		expect(result.current.active).toBe(false);
		expect(result.current.step).toBe(0);
	});
});
