// "Start workout" surfaces an error banner instead of an unhandled rejection when another workout
// becomes open between this screen's own check and the create call (a double-tap, or another
// device) — SPEC.md 8.1's single-active-workout guard rejects the create in that case.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TodayScreen } from './TodayScreen';
import { RepositoryProvider } from '../domain/RepositoryProvider';
import { MockLoggingRepository } from '../domain/mockRepository';

const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
	useNavigate: () => navigateMock,
}));

async function withNoOpenWorkout(repository: MockLoggingRepository) {
	let open = await repository.getOpenWorkout();
	while (open) {
		await repository.abandonWorkout(open.id);
		open = await repository.getOpenWorkout();
	}
}

describe('TodayScreen', () => {
	it('surfaces an error banner instead of navigating when starting races another workout open', async () => {
		navigateMock.mockClear();
		const repository = new MockLoggingRepository();
		await withNoOpenWorkout(repository);
		vi.spyOn(repository, 'createWorkout').mockRejectedValue(
			new Error("can't start a new workout while workout w-race is already open"),
		);

		render(
			<RepositoryProvider repository={repository}>
				<TodayScreen />
			</RepositoryProvider>,
		);
		await act(async () => {}); // flush the initial getOpenWorkout load

		const startButton = screen.getByRole('button', { name: 'Start workout' });
		await act(async () => fireEvent.click(startButton));

		expect(navigateMock).not.toHaveBeenCalled();
		expect(screen.getByText(/already open/)).toBeInTheDocument();
	});
});
