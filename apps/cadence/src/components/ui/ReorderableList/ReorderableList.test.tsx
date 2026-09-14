// Up/down controls report the whole reordered array, disabled at each boundary
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReorderableList } from './ReorderableList';

const ITEMS = [
	{ id: 'a', label: 'A' },
	{ id: 'b', label: 'B' },
	{ id: 'c', label: 'C' },
];

describe('ReorderableList', () => {
	it('moves an item down and reports the new order', () => {
		const onReorder = vi.fn();
		render(
			<ReorderableList
				items={ITEMS}
				getKey={(item) => item.id}
				onReorder={onReorder}
				renderItem={(item) => item.label}
			/>,
		);

		fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0]);
		expect(onReorder).toHaveBeenCalledWith([
			{ id: 'b', label: 'B' },
			{ id: 'a', label: 'A' },
			{ id: 'c', label: 'C' },
		]);
	});

	it('moves an item up and reports the new order', () => {
		const onReorder = vi.fn();
		render(
			<ReorderableList
				items={ITEMS}
				getKey={(item) => item.id}
				onReorder={onReorder}
				renderItem={(item) => item.label}
			/>,
		);

		fireEvent.click(screen.getAllByRole('button', { name: 'Move up' })[2]);
		expect(onReorder).toHaveBeenCalledWith([
			{ id: 'a', label: 'A' },
			{ id: 'c', label: 'C' },
			{ id: 'b', label: 'B' },
		]);
	});

	it('disables move-up on the first row and move-down on the last', () => {
		render(
			<ReorderableList
				items={ITEMS}
				getKey={(item) => item.id}
				onReorder={() => {}}
				renderItem={(item) => item.label}
			/>,
		);

		expect(screen.getAllByRole('button', { name: 'Move up' })[0]).toBeDisabled();
		expect(screen.getAllByRole('button', { name: 'Move down' })[2]).toBeDisabled();
	});
});
