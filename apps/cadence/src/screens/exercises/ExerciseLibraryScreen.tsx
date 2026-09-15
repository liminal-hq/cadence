// P-33 Exercise library — browse and maintain the reusable exercise catalogue outside a workout
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AppBar } from '../../components/ui/AppBar/AppBar';
import { Chip } from '../../components/ui/Chip/Chip';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { IconButton } from '../../components/ui/IconButton/IconButton';
import { Tag } from '../../components/ui/Tag/Tag';
import { TextField } from '../../components/ui/TextField/TextField';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { Category, Exercise } from '../../domain/types';
import '../screens.css';
import './exercises.css';

export function ExerciseLibraryScreen() {
	const repository = useLoggingRepository();
	const navigate = useNavigate();
	const [exercises, setExercises] = useState<Exercise[] | null>(null);
	const [categories, setCategories] = useState<Category[]>([]);
	const [query, setQuery] = useState('');
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const [favouritesOnly, setFavouritesOnly] = useState(false);
	const [showArchived, setShowArchived] = useState(false);

	useEffect(() => {
		repository.listExercises().then(setExercises);
		repository.listCategories().then(setCategories);
	}, [repository]);

	if (!exercises) return null;

	const categoryById = new Map(categories.map((c) => [c.id, c]));
	const trimmedQuery = query.trim().toLowerCase();
	const filtered = exercises.filter((exercise) => {
		if (!showArchived && exercise.archived) return false;
		if (favouritesOnly && !exercise.favourite) return false;
		if (categoryFilter && exercise.category !== categoryFilter) return false;
		if (trimmedQuery && !exercise.name.toLowerCase().includes(trimmedQuery)) return false;
		return true;
	});

	function goToNewExercise() {
		navigate({ to: '/exercise-library/new', search: { name: query.trim() } });
	}

	return (
		<div className="screen-shell">
			<AppBar title="Exercise library" size="medium" back={{ to: '/settings' }} />
			<div className="screen-shell__content exercises-screen__content">
				<div className="exercise-library__toolbar">
					<TextField label="Search" value={query} onChange={setQuery} placeholder="Exercise name" />
					<div className="exercise-library__filters">
						<Chip
							variant="filter"
							label="Favourites"
							selected={favouritesOnly}
							onClick={() => setFavouritesOnly((current) => !current)}
						/>
						<Chip
							variant="filter"
							label="Archived"
							selected={showArchived}
							onClick={() => setShowArchived((current) => !current)}
						/>
						{categories.map((category) => (
							<Chip
								key={category.id}
								variant="filter"
								label={category.name}
								selected={categoryFilter === category.id}
								onClick={() =>
									setCategoryFilter((current) => (current === category.id ? null : category.id))
								}
							/>
						))}
					</div>
				</div>

				{filtered.length === 0 ? (
					<EmptyState
						headline="No exercises found"
						body={
							trimmedQuery
								? `Nothing matches "${query.trim()}" yet.`
								: 'Nothing matches these filters yet.'
						}
					/>
				) : (
					<div className="exercise-library__list">
						{filtered.map((exercise) => {
							const category = categoryById.get(exercise.category);
							return (
								<div
									key={exercise.id}
									className={`exercise-library__row${exercise.archived ? ' exercise-library__row--archived' : ''}`}
								>
									<button
										type="button"
										className="exercise-library__row-main"
										onClick={() =>
											navigate({
												to: '/exercise-library/$exerciseId/edit',
												params: { exerciseId: exercise.id },
											})
										}
									>
										<span className="exercise-library__row-name">{exercise.name}</span>
										{category && (
											<Tag
												label={category.name}
												background={category.colourBackground}
												colour={category.colourText}
											/>
										)}
									</button>
									<IconButton
										icon="history"
										label={`${exercise.name} history`}
										onClick={() =>
											navigate({ to: '/exercise/$exerciseId', params: { exerciseId: exercise.id } })
										}
									/>
								</div>
							);
						})}
					</div>
				)}

				{trimmedQuery && !exercises.some((e) => e.name.toLowerCase() === trimmedQuery) && (
					<Chip
						variant="assist"
						icon="add"
						label={`Create "${query.trim()}"`}
						onClick={goToNewExercise}
					/>
				)}
			</div>
		</div>
	);
}
