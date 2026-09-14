// A list with up/down reorder controls per row, calling back with the whole new order —
// simpler and more robust than drag-and-drop for a first pass (SPEC.md's "reorder is explicit
// and durable" requirement doesn't demand a particular interaction, just that it commit for real)
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ReactNode } from 'react';
import { IconButton } from '../IconButton/IconButton';
import './ReorderableList.css';

export interface ReorderableListProps<T> {
	items: T[];
	getKey: (item: T) => string;
	onReorder: (next: T[]) => void;
	renderItem: (item: T, index: number) => ReactNode;
}

export function ReorderableList<T>({
	items,
	getKey,
	onReorder,
	renderItem,
}: ReorderableListProps<T>) {
	function move(index: number, delta: number) {
		const target = index + delta;
		if (target < 0 || target >= items.length) return;
		const next = [...items];
		const [moved] = next.splice(index, 1);
		next.splice(target, 0, moved);
		onReorder(next);
	}

	return (
		<div className="ui-reorderable-list">
			{items.map((item, index) => (
				<div key={getKey(item)} className="ui-reorderable-list__row">
					<div className="ui-reorderable-list__content">{renderItem(item, index)}</div>
					<div className="ui-reorderable-list__controls">
						<IconButton
							icon="arrow_upward"
							label="Move up"
							size="small"
							disabled={index === 0}
							onClick={() => move(index, -1)}
						/>
						<IconButton
							icon="arrow_downward"
							label="Move down"
							size="small"
							disabled={index === items.length - 1}
							onClick={() => move(index, 1)}
						/>
					</div>
				</div>
			))}
		</div>
	);
}
