// P-13 Add exercise — a favourites/category/search picker over the full library, multi-select,
// reused from Workout detail. "Recent exercises" and "create exercise from a no-results query"
// (both real SPEC.md 8.1/8.2 requirements) are deferred: nothing tracks recent-use yet, and there
// is no create-exercise backend command to wire a "create" action into.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '../BottomSheet/BottomSheet';
import { Button } from '../ui/Button/Button';
import { Chip } from '../ui/Chip/Chip';
import { IconButton } from '../ui/IconButton/IconButton';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import { CATEGORY_COLOURS } from '../../data/categoryColours';
import type { Exercise } from '../../domain/types';
import './AddExerciseSheet.css';

interface AddExerciseSheetProps {
	workoutId: string;
	/** Already in this workout — shown but not selectable (SPEC.md 8.1's "exercise already in
	 *  workout" state), so a duplicate add isn't offered as if it were a fresh one. */
	existingExerciseIds: string[];
	onClose: () => void;
	onAdded: () => void;
}

export function AddExerciseSheet({
	workoutId,
	existingExerciseIds,
	onClose,
	onAdded,
}: AddExerciseSheetProps) {
	const repository = useLoggingRepository();
	const [exercises, setExercises] = useState<Exercise[]>([]);
	const [query, setQuery] = useState('');
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const [favouritesOnly, setFavouritesOnly] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [adding, setAdding] = useState(false);

	useEffect(() => {
		repository.listExercises().then(setExercises);
	}, [repository]);

	const existing = useMemo(() => new Set(existingExerciseIds), [existingExerciseIds]);

	const filtered = exercises.filter((exercise) => {
		if (favouritesOnly && !exercise.favourite) return false;
		if (categoryFilter && exercise.category !== categoryFilter) return false;
		if (query.trim() && !exercise.name.toLowerCase().includes(query.trim().toLowerCase())) {
			return false;
		}
		return true;
	});

	function toggleSelected(exerciseId: string) {
		setSelectedIds((current) => {
			const next = new Set(current);
			if (next.has(exerciseId)) next.delete(exerciseId);
			else next.add(exerciseId);
			return next;
		});
	}

	async function handleAdd() {
		setAdding(true);
		// Sequential, not Promise.all — add_workout_exercise reads the workout's current highest
		// sort_order before inserting, and concurrent calls could race on that read.
		for (const exerciseId of selectedIds) {
			await repository.addWorkoutExercise(workoutId, exerciseId);
		}
		setAdding(false);
		onAdded();
	}

	const categories = Object.keys(CATEGORY_COLOURS);

	return (
		<BottomSheet onClose={onClose} ariaLabel="Add exercise">
			<div className="add-exercise-sheet__header">
				<span className="add-exercise-sheet__title">Add exercise</span>
				<IconButton icon="close" label="Close" onClick={onClose} />
			</div>

			<input
				className="add-exercise-sheet__search"
				placeholder="Search exercises"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
			/>

			<div className="add-exercise-sheet__filters">
				<Chip
					variant="filter"
					label="Favourites"
					icon="star"
					selected={favouritesOnly}
					onClick={() => setFavouritesOnly((current) => !current)}
				/>
				{categories.map((category) => (
					<Chip
						key={category}
						variant="filter"
						label={category}
						selected={categoryFilter === category}
						onClick={() => setCategoryFilter((current) => (current === category ? null : category))}
					/>
				))}
			</div>

			<div className="add-exercise-sheet__list">
				{filtered.length === 0 && <p className="add-exercise-sheet__empty">No exercises match.</p>}
				{filtered.map((exercise) => {
					const alreadyInWorkout = existing.has(exercise.id);
					const selected = selectedIds.has(exercise.id);
					const colour = CATEGORY_COLOURS[exercise.category];
					return (
						<button
							key={exercise.id}
							type="button"
							className={`add-exercise-sheet__row${selected ? ' is-selected' : ''}`}
							disabled={alreadyInWorkout}
							onClick={() => toggleSelected(exercise.id)}
						>
							<span
								className="add-exercise-sheet__row-dot"
								style={{ background: colour?.dot }}
								aria-hidden="true"
							/>
							<span className="add-exercise-sheet__row-name">{exercise.name}</span>
							{alreadyInWorkout ? (
								<span className="add-exercise-sheet__row-status">Already added</span>
							) : (
								<span
									className={`material-symbols-rounded${selected ? ' is-filled' : ''} add-exercise-sheet__row-check`}
								>
									{selected ? 'check_circle' : 'radio_button_unchecked'}
								</span>
							)}
						</button>
					);
				})}
			</div>

			<div className="add-exercise-sheet__footer">
				<Button
					variant="filled"
					fullWidth
					disabled={selectedIds.size === 0 || adding}
					onClick={handleAdd}
				>
					{selectedIds.size > 0 ? `Add ${selectedIds.size} exercise(s)` : 'Add exercise'}
				</Button>
			</div>
		</BottomSheet>
	);
}
