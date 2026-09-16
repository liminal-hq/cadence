// The reorder math (reorderByKeys) and structural rendering — a real dnd-kit drag gesture can't be meaningfully simulated under happy-dom, which reports zero-sized rects for every element, so the id-to-index logic is tested directly instead
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReorderableList, reorderByKeys, resolveItemLabel } from './ReorderableList';

const ITEMS = [
	{ id: 'a', label: 'A' },
	{ id: 'b', label: 'B' },
	{ id: 'c', label: 'C' },
];

describe('reorderByKeys', () => {
	it('moves an item to a later position', () => {
		expect(reorderByKeys(ITEMS, (i) => i.id, 'a', 'c')).toEqual([
			{ id: 'b', label: 'B' },
			{ id: 'c', label: 'C' },
			{ id: 'a', label: 'A' },
		]);
	});

	it('moves an item to an earlier position', () => {
		expect(reorderByKeys(ITEMS, (i) => i.id, 'c', 'a')).toEqual([
			{ id: 'c', label: 'C' },
			{ id: 'a', label: 'A' },
			{ id: 'b', label: 'B' },
		]);
	});

	it('returns the same array reference for a drop on itself', () => {
		expect(reorderByKeys(ITEMS, (i) => i.id, 'b', 'b')).toBe(ITEMS);
	});

	it('returns the same array reference for an unknown key', () => {
		expect(reorderByKeys(ITEMS, (i) => i.id, 'a', 'no-such-id')).toBe(ITEMS);
		expect(reorderByKeys(ITEMS, (i) => i.id, 'no-such-id', 'a')).toBe(ITEMS);
	});
});

describe('resolveItemLabel', () => {
	it("uses getLabel's own name for an item that exists", () => {
		expect(
			resolveItemLabel(
				ITEMS,
				(i) => i.id,
				(i) => i.label,
				'b',
			),
		).toBe('B');
	});

	it('falls back to the raw key when getLabel is omitted', () => {
		expect(resolveItemLabel(ITEMS, (i) => i.id, undefined, 'b')).toBe('b');
	});

	it('falls back to the raw key when no item matches it', () => {
		expect(
			resolveItemLabel(
				ITEMS,
				(i) => i.id,
				(i) => i.label,
				'no-such-id',
			),
		).toBe('no-such-id');
	});

	it('disambiguates items that share the same label with their 1-based position', () => {
		const duplicates = [
			{ id: 'a', label: 'Bench Press' },
			{ id: 'b', label: 'Squat' },
			{ id: 'c', label: 'Bench Press' },
		];
		expect(
			resolveItemLabel(
				duplicates,
				(i) => i.id,
				(i) => i.label,
				'a',
			),
		).toBe('Bench Press (position 1)');
		expect(
			resolveItemLabel(
				duplicates,
				(i) => i.id,
				(i) => i.label,
				'c',
			),
		).toBe('Bench Press (position 3)');
		expect(
			resolveItemLabel(
				duplicates,
				(i) => i.id,
				(i) => i.label,
				'b',
			),
		).toBe('Squat');
	});
});

describe('ReorderableList', () => {
	it('renders every item with one drag handle each', () => {
		render(
			<ReorderableList
				items={ITEMS}
				getKey={(item) => item.id}
				onReorder={() => {}}
				renderItem={(item) => item.label}
			/>,
		);

		expect(screen.getByText('A')).toBeInTheDocument();
		expect(screen.getByText('B')).toBeInTheDocument();
		expect(screen.getByText('C')).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: 'Reorder' })).toHaveLength(3);
	});

	it('never calls onReorder on its own', () => {
		const onReorder = vi.fn();
		render(
			<ReorderableList
				items={ITEMS}
				getKey={(item) => item.id}
				onReorder={onReorder}
				renderItem={(item) => item.label}
			/>,
		);

		expect(onReorder).not.toHaveBeenCalled();
	});

	it('offers a click-operable move action alongside the drag handle, for assistive tech a drag gesture cannot reach', () => {
		const onReorder = vi.fn();
		render(
			<ReorderableList
				items={ITEMS}
				getKey={(item) => item.id}
				onReorder={onReorder}
				renderItem={(item) => item.label}
			/>,
		);

		fireEvent.click(screen.getByText('Move item 1 down'));
		expect(onReorder).toHaveBeenCalledWith([
			{ id: 'b', label: 'B' },
			{ id: 'a', label: 'A' },
			{ id: 'c', label: 'C' },
		]);
	});

	it('disables moving past either end of the list', () => {
		render(
			<ReorderableList
				items={ITEMS}
				getKey={(item) => item.id}
				onReorder={() => {}}
				renderItem={(item) => item.label}
			/>,
		);

		expect(screen.getByText('Move item 1 up')).toBeDisabled();
		expect(screen.getByText('Move item 3 down')).toBeDisabled();
	});

	it('renders no separate drag handle when showHandle is false', () => {
		render(
			<ReorderableList
				items={ITEMS}
				getKey={(item) => item.id}
				onReorder={() => {}}
				renderItem={(item) => item.label}
				showHandle={false}
			/>,
		);

		expect(screen.getByText('A')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Reorder' })).not.toBeInTheDocument();
	});

	it('passes a drag activator ref to renderItem when showHandle is false, so the caller can make its own element the drag surface instead of a wrapping one', () => {
		let received: unknown;
		render(
			<ReorderableList
				items={ITEMS}
				getKey={(item) => item.id}
				onReorder={() => {}}
				renderItem={(item, _index, dragActivatorProps) => {
					received = dragActivatorProps;
					return item.label;
				}}
				showHandle={false}
			/>,
		);

		expect(received).toMatchObject({ ref: expect.any(Function) });
	});
});
