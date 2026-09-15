// A pointer- and keyboard-draggable list, calling back with the whole new order
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ReactNode } from 'react';
import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
	type DragEndEvent,
} from '@dnd-kit/core';
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconButton } from '../IconButton/IconButton';
import './ReorderableList.css';

export interface ReorderableListProps<T> {
	items: T[];
	getKey: (item: T) => string;
	onReorder: (next: T[]) => void;
	renderItem: (item: T, index: number) => ReactNode;
}

/** Pure id-to-index reorder math, split out from the `DndContext` wiring so it's unit-testable
 *  without a real layout -- dnd-kit's own drag gesture can't be meaningfully simulated under
 *  happy-dom/jsdom, which report zero-sized rects for every element. Returns `items` unchanged
 *  (same reference) if either id is missing or they're equal, so callers can skip the `onReorder`
 *  call entirely on a no-op drag. */
export function reorderByKeys<T>(
	items: T[],
	getKey: (item: T) => string,
	activeKey: string,
	overKey: string,
): T[] {
	if (activeKey === overKey) return items;
	const oldIndex = items.findIndex((item) => getKey(item) === activeKey);
	const newIndex = items.findIndex((item) => getKey(item) === overKey);
	if (oldIndex === -1 || newIndex === -1) return items;
	return arrayMove(items, oldIndex, newIndex);
}

interface RowProps {
	id: string;
	children: ReactNode;
}

// One sortable row: `useSortable` supplies both the drag transform for the row being moved and
// the `listeners`/`attributes` that make the handle itself draggable -- those need to land on the
// real DOM button (via IconButton's prop-spreading), not just be read and discarded, or nothing
// would actually respond to a pointer or keyboard.
function Row({ id, children }: RowProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id,
	});

	return (
		<div
			ref={setNodeRef}
			className="ui-reorderable-list__row"
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
				opacity: isDragging ? 0.5 : 1,
				zIndex: isDragging ? 1 : undefined,
			}}
		>
			<div className="ui-reorderable-list__content">{children}</div>
			<IconButton
				icon="drag_handle"
				label="Reorder"
				size="small"
				className="ui-reorderable-list__handle"
				{...attributes}
				{...listeners}
			/>
		</div>
	);
}

export function ReorderableList<T>({
	items,
	getKey,
	onReorder,
	renderItem,
}: ReorderableListProps<T>) {
	// PointerSensor covers mouse/touch drag; KeyboardSensor is the accessible fallback the old
	// up/down buttons already provided -- Tab to a handle, Space to pick up, arrow keys to move,
	// Space to drop, Escape to cancel. A small activation distance on the pointer sensor stops an
	// ordinary tap (e.g. on a row's own text field) from being mistaken for a drag.
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over) return;
		const next = reorderByKeys(items, getKey, String(active.id), String(over.id));
		if (next !== items) onReorder(next);
	}

	const ids = items.map(getKey);

	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
			<SortableContext items={ids} strategy={verticalListSortingStrategy}>
				<div className="ui-reorderable-list">
					{items.map((item, index) => (
						<Row key={getKey(item)} id={getKey(item)}>
							{renderItem(item, index)}
						</Row>
					))}
				</div>
			</SortableContext>
		</DndContext>
	);
}
