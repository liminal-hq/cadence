// Regression coverage for the P-32 redesign: a dangling exercise reference must render as a "missing exercise" row rather than blanking the whole screen, and the "values come from" selector's default must track what the exercise's own most recently added set actually used
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it, vi } from 'vitest';
import { defaultPopulationMode, loadEditorState } from './RoutineEditorScreen';
import { MockLoggingRepository } from '../../domain/mockRepository';
import { SEED_LAST_PERFORMANCE } from '../../domain/types';

describe('loadEditorState', () => {
	it('loads every exercise normally when all references resolve', async () => {
		const repo = new MockLoggingRepository();
		const routine = await repo.createRoutine('Push day');
		const section = await repo.addRoutineSection(routine.id, 'A');
		await repo.addRoutineExercise(section.id, 'ex-bench-press');

		const state = await loadEditorState(repo, routine.id);

		expect(state.sections).toHaveLength(1);
		expect(state.sections[0].exercises).toHaveLength(1);
		expect(state.sections[0].exercises[0].exercise?.name).toBe('Bench Press');
	});

	it('renders a dangling exercise reference as `exercise: null` instead of failing the whole load', async () => {
		const repo = new MockLoggingRepository();
		const routine = await repo.createRoutine('Push day');
		const section = await repo.addRoutineSection(routine.id, 'A');
		await repo.addRoutineExercise(section.id, 'ex-bench-press');
		await repo.addRoutineExercise(section.id, 'no-such-exercise');

		const state = await loadEditorState(repo, routine.id);

		expect(state.sections[0].exercises).toHaveLength(2);
		expect(state.sections[0].exercises[0].exercise?.name).toBe('Bench Press');
		expect(state.sections[0].exercises[1].exercise).toBeNull();
		expect(state.sections[0].exercises[1].templates).toEqual([]);
	});

	it('propagates a set-template load failure instead of misreading it as a missing exercise', async () => {
		const repo = new MockLoggingRepository();
		const routine = await repo.createRoutine('Push day');
		const section = await repo.addRoutineSection(routine.id, 'A');
		await repo.addRoutineExercise(section.id, 'ex-bench-press');
		vi.spyOn(repo, 'listSetTemplates').mockRejectedValue(new Error('transient DB error'));

		await expect(loadEditorState(repo, routine.id)).rejects.toThrow('transient DB error');
	});

	it('propagates a real backend error from getExercise instead of treating it as a deleted exercise', async () => {
		const repo = new MockLoggingRepository();
		const routine = await repo.createRoutine('Push day');
		const section = await repo.addRoutineSection(routine.id, 'A');
		await repo.addRoutineExercise(section.id, 'ex-bench-press');
		vi.spyOn(repo, 'getExercise').mockRejectedValue(
			Object.assign(new Error('db error'), { kind: 'db' }),
		);

		await expect(loadEditorState(repo, routine.id)).rejects.toThrow('db error');
	});

	it('still treats a tagged notFound error from getExercise as a missing exercise', async () => {
		const repo = new MockLoggingRepository();
		const routine = await repo.createRoutine('Push day');
		const section = await repo.addRoutineSection(routine.id, 'A');
		await repo.addRoutineExercise(section.id, 'ex-bench-press');
		vi.spyOn(repo, 'getExercise').mockRejectedValue(
			Object.assign(new Error('not found'), { kind: 'notFound' }),
		);

		const state = await loadEditorState(repo, routine.id);
		expect(state.sections[0].exercises[0].exercise).toBeNull();
	});
});

describe('defaultPopulationMode', () => {
	it("defaults to 'fixed' when there are no set templates yet", () => {
		expect(defaultPopulationMode([])).toBe('fixed');
	});

	it("reflects the most recently added template's own rule, not the first one's", () => {
		const templates = [
			{ id: '1', routineExerciseId: 'e', order: 1, weightKg: 100, repsMin: 5, repsMax: 5 },
			{ id: '2', routineExerciseId: 'e', order: 2, populationRule: SEED_LAST_PERFORMANCE },
		];
		expect(defaultPopulationMode(templates)).toBe('last-time');
	});

	it("treats a template with no values and no population rule as 'blank'", () => {
		const templates = [{ id: '1', routineExerciseId: 'e', order: 1 }];
		expect(defaultPopulationMode(templates)).toBe('blank');
	});
});
