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
	type Announcements,
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
	/** A human-readable name for an item, announced to screen readers during a keyboard drag instead of its raw key — every caller's key is a persisted id (a UUID in the real backend), which means nothing read aloud. Falls back to the key itself when omitted. */
	getLabel?: (item: T) => string;
}

/** Pure id-to-index reorder math, split out from the `DndContext` wiring so it's unit-testable without a real layout — dnd-kit's own drag gesture can't be meaningfully simulated under happy-dom/jsdom, which report zero-sized rects for every element. Returns `items` unchanged (same reference) if either id is missing or they're equal, so callers can skip the `onReorder` call entirely on a no-op drag. */
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

/** Resolves a drag event's raw id (a persisted UUID in the real backend) to a human-readable name for screen-reader announcements — falls back to the id itself when the item can't be found or the caller didn't supply `getLabel`. */
export function resolveItemLabel<T>(
	items: T[],
	getKey: (item: T) => string,
	getLabel: ((item: T) => string) | undefined,
	id: string,
): string {
	const item = items.find((candidate) => getKey(candidate) === id);
	return item && getLabel ? getLabel(item) : id;
}

interface RowProps {
	id: string;
	children: ReactNode;
	index: number;
	canMoveUp: boolean;
	canMoveDown: boolean;
	onMoveUp: () => void;
	onMoveDown: () => void;
}

// One sortable row: `useSortable` supplies both the drag transform for the row being moved and the `listeners`/`attributes` that make the handle itself draggable — those need to land on the real DOM button (via IconButton's prop-spreading), not just be read and discarded, or nothing would actually respond to a pointer or keyboard.
// A drag gesture (pointer or keyboard) has no equivalent for a touch screen reader, which operates by synthesizing a click rather than real pointer or key events — so every row also gets a pair of click-operable, visually hidden move actions, satisfying WCAG 2.5.7's "single pointer" alternative without reintroducing the two visible buttons this component was built to replace.
function Row({ id, children, index, canMoveUp, canMoveDown, onMoveUp, onMoveDown }: RowProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
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
			<button
				type="button"
				className="ui-reorderable-list__move"
				disabled={!canMoveUp}
				onClick={onMoveUp}
			>
				{`Move item ${index + 1} up`}
			</button>
			<button
				type="button"
				className="ui-reorderable-list__move"
				disabled={!canMoveDown}
				onClick={onMoveDown}
			>
				{`Move item ${index + 1} down`}
			</button>
			<IconButton
				ref={setActivatorNodeRef}
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
	getLabel,
}: ReorderableListProps<T>) {
	// PointerSensor covers mouse/touch drag; KeyboardSensor is the accessible fallback the old up/down buttons already provided — Tab to a handle, Space to pick up, arrow keys to move, Space to drop, Escape to cancel. A small activation distance on the pointer sensor stops an ordinary tap (e.g. on a row's own text field) from being mistaken for a drag.
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

	function handleMoveByClick(index: number, delta: number) {
		const targetIndex = index + delta;
		if (targetIndex < 0 || targetIndex >= items.length) return;
		onReorder(arrayMove(items, index, targetIndex));
	}

	function labelFor(id: string): string {
		return resolveItemLabel(items, getKey, getLabel, id);
	}

	// dnd-kit's default live-region announcements interpolate raw ids — substituting `labelFor` gives a keyboard screen-reader user the same "picked up/moved/dropped" phrasing naming an actual item instead of an opaque database key.
	const announcements: Announcements = {
		onDragStart({ active }) {
			return `Picked up ${labelFor(String(active.id))}.`;
		},
		onDragOver({ active, over }) {
			if (!over) return `${labelFor(String(active.id))} is no longer over a droppable area.`;
			if (over.id === active.id)
				return `${labelFor(String(active.id))} is back at its original position.`;
			return `${labelFor(String(active.id))} was moved to the position of ${labelFor(String(over.id))}.`;
		},
		onDragEnd({ active, over }) {
			if (!over) return `${labelFor(String(active.id))} was dropped.`;
			return `${labelFor(String(active.id))} was dropped at the position of ${labelFor(String(over.id))}.`;
		},
		onDragCancel({ active }) {
			return `Dragging was cancelled. ${labelFor(String(active.id))} was returned to its original position.`;
		},
	};

	const ids = items.map(getKey);

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragEnd={handleDragEnd}
			accessibility={{ announcements }}
		>
			<SortableContext items={ids} strategy={verticalListSortingStrategy}>
				<div className="ui-reorderable-list">
					{items.map((item, index) => (
						<Row
							key={getKey(item)}
							id={getKey(item)}
							index={index}
							canMoveUp={index > 0}
							canMoveDown={index < items.length - 1}
							onMoveUp={() => handleMoveByClick(index, -1)}
							onMoveDown={() => handleMoveByClick(index, 1)}
						>
							{renderItem(item, index)}
						</Row>
					))}
				</div>
			</SortableContext>
		</DndContext>
	);
}
