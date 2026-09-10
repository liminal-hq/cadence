// P-44's History tab — per-workout cards for every past occurrence of this exercise, most
// recent first, plus a small "About this exercise" section from what's actually modelled today
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useNavigate } from '@tanstack/react-router';
import { Surface } from '../../components/ui/Surface/Surface';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { SetChipRow } from './SetChipRow';
import { formatCalendarDateLabel } from './historyDates';
import type { Exercise } from '../../domain/types';
import type { ExerciseHistoryEntry } from './loadExerciseHistory';
import './ExerciseHistoryTab.css';

interface ExerciseHistoryTabProps {
	exercise: Exercise;
	history: ExerciseHistoryEntry[];
}

export function ExerciseHistoryTab({ exercise, history }: ExerciseHistoryTabProps) {
	const navigate = useNavigate();
	const technicalNote = history.find((h) => h.workoutExercise.technicalNote)?.workoutExercise
		.technicalNote;

	const increment =
		exercise.metricProfile === 'weight-reps'
			? exercise.weightIncrementKg !== undefined
				? `${exercise.weightIncrementKg} kg per step`
				: undefined
			: exercise.distanceIncrementKm !== undefined
				? `${exercise.distanceIncrementKm} km per step`
				: undefined;

	return (
		<div className="exercise-history-tab">
			<Surface tone="container" radius="l" className="exercise-history-tab__about">
				<h2 className="exercise-history-tab__about-title">About this exercise</h2>
				<dl className="exercise-history-tab__about-list">
					<div>
						<dt>Category</dt>
						<dd className="exercise-history-tab__category">{exercise.category}</dd>
					</div>
					<div>
						<dt>Metric</dt>
						<dd>
							{exercise.metricProfile === 'weight-reps' ? 'Weight + Reps' : 'Distance + Duration'}
						</dd>
					</div>
					{increment && (
						<div>
							<dt>Increment</dt>
							<dd>{increment}</dd>
						</div>
					)}
				</dl>
				{technicalNote && <p className="exercise-history-tab__technical-note">“{technicalNote}”</p>}
			</Surface>

			{history.length === 0 ? (
				<EmptyState
					headline="No history yet"
					body="Logged sets for this exercise will show up here."
				/>
			) : (
				<div className="exercise-history-tab__workouts">
					{history.map(({ workout, workoutExercise, sets }) => (
						<button
							key={workoutExercise.id}
							type="button"
							className="exercise-history-tab__workout"
							onClick={() =>
								navigate({ to: '/history/workout/$workoutId', params: { workoutId: workout.id } })
							}
						>
							<span className="exercise-history-tab__workout-date">
								{formatCalendarDateLabel(workout.date)} · {workout.title}
							</span>
							<SetChipRow
								metricProfile={exercise.metricProfile}
								archived={exercise.archived}
								sets={sets}
							/>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
