// P-12 Workout detail (the real, in-progress version) — the ordered list of a workout's
// exercises, reached from Today's "Start workout" action, opening each row into P-14 Exercise
// logging. Distinct from history/WorkoutDetailScreen, which is the read-only historical/completed
// workout view at /history/workout/$workoutId.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AppBar } from '../components/ui/AppBar/AppBar';
import { Button } from '../components/ui/Button/Button';
import { EmptyState } from '../components/ui/EmptyState/EmptyState';
import { AddExerciseSheet } from '../components/AddExerciseSheet/AddExerciseSheet';
import { SetChipRow } from './history/SetChipRow';
import { useLoggingRepository } from '../domain/RepositoryProvider';
import type { LoggingRepository } from '../domain/repository';
import type { MetricProfile, SetEntry, Workout } from '../domain/types';
import './screens.css';
import './ActiveWorkoutScreen.css';

interface ActiveWorkoutScreenProps {
	workoutId: string;
}

interface ActiveWorkoutExercise {
	workoutExerciseId: string;
	exerciseId: string;
	name: string;
	metricProfile: MetricProfile;
	archived?: boolean;
	sets: SetEntry[];
}

interface ActiveWorkout {
	workout: Workout;
	exercises: ActiveWorkoutExercise[];
}

async function loadActiveWorkout(
	repository: LoggingRepository,
	workoutId: string,
): Promise<ActiveWorkout> {
	const [workout, workoutExercises] = await Promise.all([
		repository.getWorkout(workoutId),
		repository.listWorkoutExercisesByWorkout(workoutId),
	]);
	const exercises = await Promise.all(
		workoutExercises.map(async (we) => {
			const [exercise, sets] = await Promise.all([
				repository.getExercise(we.exerciseId),
				repository.listSets(we.id),
			]);
			return {
				workoutExerciseId: we.id,
				exerciseId: exercise.id,
				name: exercise.name,
				metricProfile: exercise.metricProfile,
				archived: exercise.archived,
				sets,
			};
		}),
	);
	return { workout, exercises };
}

export function ActiveWorkoutScreen({ workoutId }: ActiveWorkoutScreenProps) {
	const repository = useLoggingRepository();
	const navigate = useNavigate();
	const [active, setActive] = useState<ActiveWorkout | null>(null);
	const [addExerciseOpen, setAddExerciseOpen] = useState(false);

	const reload = useCallback(() => {
		loadActiveWorkout(repository, workoutId).then(setActive);
	}, [repository, workoutId]);

	useEffect(() => {
		let cancelled = false;
		loadActiveWorkout(repository, workoutId).then((loaded) => {
			if (!cancelled) setActive(loaded);
		});
		return () => {
			cancelled = true;
		};
	}, [repository, workoutId]);

	if (!active) return null;
	const { workout, exercises } = active;

	return (
		<div className="screen-shell">
			<AppBar title={workout.title || 'Workout'} size="medium" back={{ to: '/today' }} />
			<div className="screen-shell__content active-workout">
				{exercises.length === 0 ? (
					<EmptyState
						headline="No exercises yet"
						body="Add an exercise to get started."
						action={
							<Button variant="filled" icon="add" onClick={() => setAddExerciseOpen(true)}>
								Add exercise
							</Button>
						}
					/>
				) : (
					<>
						<div className="active-workout__exercises">
							{exercises.map((exercise) => (
								<button
									key={exercise.workoutExerciseId}
									type="button"
									className="active-workout__exercise-link"
									onClick={() =>
										navigate({
											to: '/workout-exercise/$workoutExerciseId',
											params: { workoutExerciseId: exercise.workoutExerciseId },
										})
									}
								>
									<SetChipRow
										exerciseName={exercise.name}
										metricProfile={exercise.metricProfile}
										archived={exercise.archived}
										sets={exercise.sets}
									/>
								</button>
							))}
						</div>
						<Button variant="tonal" icon="add" onClick={() => setAddExerciseOpen(true)}>
							Add exercise
						</Button>
					</>
				)}
			</div>
			{addExerciseOpen && (
				<AddExerciseSheet
					workoutId={workoutId}
					existingExerciseIds={exercises.map((e) => e.exerciseId)}
					onClose={() => setAddExerciseOpen(false)}
					onAdded={() => {
						setAddExerciseOpen(false);
						reload();
					}}
				/>
			)}
		</div>
	);
}
