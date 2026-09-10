// The docked bar's full running/paused/resumed/elapsed cycle, driven by fake timers.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RestTimerBar } from './RestTimerBar';
import { RepositoryProvider } from '../../domain/RepositoryProvider';
import { MockLoggingRepository } from '../../domain/mockRepository';

// fireEvent (not userEvent) throughout: userEvent's internal delay scheduling
// doesn't play well with vi.useFakeTimers() here and hangs the test runner.

describe('RestTimerBar', () => {
	let repository: MockLoggingRepository;

	beforeEach(() => {
		repository = new MockLoggingRepository();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	async function renderBar() {
		render(
			<RepositoryProvider repository={repository}>
				<RestTimerBar />
			</RepositoryProvider>,
		);
		await act(async () => {}); // flush the initial getRestTimerState() promise
	}

	it('starts, counts down, pauses, resumes, and elapses, then resets to inactive', async () => {
		await renderBar();
		expect(screen.getByText('No rest running')).toBeInTheDocument();

		await act(async () => fireEvent.click(screen.getByRole('button', { name: /Start/ })));
		expect(screen.getByText(/Rest 2:00/)).toBeInTheDocument();

		await act(async () => vi.advanceTimersByTime(60_000));
		expect(screen.getByText(/Rest 1:00/)).toBeInTheDocument();

		await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
		expect(screen.getByText(/Paused · 1:00/)).toBeInTheDocument();

		await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Resume' })));
		expect(screen.getByText(/Rest 1:00/)).toBeInTheDocument();

		await act(async () => vi.advanceTimersByTime(60_000));
		expect(screen.getByText('Rest done')).toBeInTheDocument();

		await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Go' })));
		expect(screen.getByText('No rest running')).toBeInTheDocument();
	});

	it('extends the running timer by 30 seconds', async () => {
		await renderBar();

		await act(async () => fireEvent.click(screen.getByRole('button', { name: /Start/ })));
		await act(async () => fireEvent.click(screen.getByRole('button', { name: '+30' })));

		expect(screen.getByText(/of 2:30/)).toBeInTheDocument();
	});
});
