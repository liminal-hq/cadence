// P-14 Exercise logging -- the "Preferred direction" fixed stepper-cluster pattern: a pinned
// cluster loads one set at a time, the list below is read-only, and a docked rest timer bar
// keeps rest visible without leaving the screen (SPEC.md section 7)
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useCallback, useEffect, useState } from 'react';
import { DetailAppBar } from '../components/DetailAppBar/DetailAppBar';
import { SetRow, type SetRowState } from '../components/SetRow/SetRow';
import { StepperCluster, type StepperField } from '../components/StepperCluster/StepperCluster';
import { RestTimerBar } from '../components/RestTimerBar/RestTimerBar';
import { useLoggingRepository } from '../domain/RepositoryProvider';
import type { Exercise, SetEntry, WorkoutExercise } from '../domain/types';
import { SCENARIO_TO_WORKOUT_EXERCISE_ID, type Scenario } from '../domain/seedData';
import './screens.css';
import './ExerciseLoggingScreen.css';

interface ExerciseLoggingScreenProps {
	scenario: Scenario;
}

function formatValue(value: number): string {
	return Number.isInteger(value)
		? String(value)
		: value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatDuration(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const rest = Math.round(seconds % 60);
	return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

function setRowState(set: SetEntry, loadedSetId: string | null): SetRowState {
	if (set.status === 'completed') return 'completed';
	if (set.id === loadedSetId) return 'loaded';
	return 'planned';
}

export function ExerciseLoggingScreen({ scenario }: ExerciseLoggingScreenProps) {
	const repository = useLoggingRepository();
	const [currentWorkoutExerciseId, setCurrentWorkoutExerciseId] = useState(
		SCENARIO_TO_WORKOUT_EXERCISE_ID[scenario],
	);
	const [workoutExercise, setWorkoutExercise] = useState<WorkoutExercise | null>(null);
	const [exercise, setExercise] = useState<Exercise | null>(null);
	const [siblings, setSiblings] = useState<WorkoutExercise[]>([]);
	const [sets, setSets] = useState<SetEntry[]>([]);
	const [loadedSetId, setLoadedSetId] = useState<string | null>(null);

	const loadWorkoutExercise = useCallback(
		async (workoutExerciseId: string) => {
			const we = await repository.getWorkoutExercise(workoutExerciseId);
			const [ex, workoutSets, workoutSiblings] = await Promise.all([
				repository.getExercise(we.exerciseId),
				repository.listSets(we.id),
				repository.listWorkoutExercisesByWorkout(we.workoutId),
			]);
			setWorkoutExercise(we);
			setExercise(ex);
			setSiblings(workoutSiblings);
			setSets(workoutSets);
			const firstPlanned = workoutSets.find((s) => s.status === 'planned');
			setLoadedSetId((firstPlanned ?? workoutSets[workoutSets.length - 1])?.id ?? null);
		},
		[repository],
	);

	useEffect(() => {
		setCurrentWorkoutExerciseId(SCENARIO_TO_WORKOUT_EXERCISE_ID[scenario]);
	}, [scenario]);

	useEffect(() => {
		loadWorkoutExercise(currentWorkoutExerciseId);
	}, [currentWorkoutExerciseId, loadWorkoutExercise]);

	if (!workoutExercise || !exercise) return null;

	const loadedSet = sets.find((s) => s.id === loadedSetId) ?? null;
	const loadedIndex = sets.findIndex((s) => s.id === loadedSetId);

	const persistLoadedSet = async (updated: SetEntry) => {
		setSets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
		await repository.saveSet(updated);
	};

	const primaryField: StepperField =
		exercise.metricProfile === 'weight-reps'
			? {
					label: 'kg',
					value: loadedSet?.weightKg,
					increment: exercise.weightIncrementKg ?? 2.5,
					formatValue,
					onChange: (value) => loadedSet && persistLoadedSet({ ...loadedSet, weightKg: value }),
				}
			: {
					label: 'km',
					value: loadedSet?.distanceKm,
					increment: exercise.distanceIncrementKm ?? 0.1,
					formatValue: (v) => v.toFixed(1),
					onChange: (value) => loadedSet && persistLoadedSet({ ...loadedSet, distanceKm: value }),
				};

	const secondaryField: StepperField =
		exercise.metricProfile === 'weight-reps'
			? {
					label: 'reps',
					value: loadedSet?.reps,
					increment: exercise.repsIncrement ?? 1,
					formatValue,
					onChange: (value) => loadedSet && persistLoadedSet({ ...loadedSet, reps: value }),
				}
			: {
					label: 'min:sec',
					value: loadedSet?.durationSec,
					increment: exercise.durationIncrementSec ?? 10,
					formatValue: formatDuration,
					onChange: (value) => loadedSet && persistLoadedSet({ ...loadedSet, durationSec: value }),
				};

	const handleLog = async () => {
		if (!loadedSet) return;
		const completed = await repository.completeSet(loadedSet.id);
		setSets((prev) => prev.map((s) => (s.id === completed.id ? completed : s)));

		const nextPlanned = sets.find((s, i) => i > loadedIndex && s.status === 'planned');
		if (nextPlanned) {
			setLoadedSetId(nextPlanned.id);
			const label =
				exercise.metricProfile === 'weight-reps'
					? `${exercise.name} set ${nextPlanned.order} · ${formatValue(nextPlanned.weightKg ?? 0)} × ${nextPlanned.reps ?? 0}`
					: `${exercise.name} set ${nextPlanned.order}`;
			await repository.startRestTimer(120_000, { forSetId: completed.id, nextSetLabel: label });
		}
	};

	const handleAddSet = async () => {
		const created = await repository.addSet(workoutExercise.id);
		setSets((prev) => [...prev, created]);
		setLoadedSetId(created.id);
	};

	const siblingIndex = siblings.findIndex((s) => s.id === workoutExercise.id);
	const previousExercise = siblingIndex > 0 ? siblings[siblingIndex - 1] : undefined;
	const nextExercise =
		siblingIndex >= 0 && siblingIndex < siblings.length - 1
			? siblings[siblingIndex + 1]
			: undefined;

	return (
		<div className="exercise-logging">
			<DetailAppBar
				title={exercise.name}
				category={exercise.category}
				subtitle={workoutExercise.workoutLabel}
			/>

			<div className="exercise-logging__content">
				{previousExercise || nextExercise ? (
					<div className="exercise-logging__exercise-nav">
						<button
							type="button"
							disabled={!previousExercise}
							onClick={() => previousExercise && setCurrentWorkoutExerciseId(previousExercise.id)}
						>
							<span className="material-symbols-rounded">chevron_left</span>
							Previous exercise
						</button>
						<button
							type="button"
							disabled={!nextExercise}
							onClick={() => nextExercise && setCurrentWorkoutExerciseId(nextExercise.id)}
						>
							Next exercise
							<span className="material-symbols-rounded">chevron_right</span>
						</button>
					</div>
				) : null}

				{workoutExercise.technicalNote && (
					<div className="exercise-logging__note">
						<span className="material-symbols-rounded">sticky_note_2</span>
						<span>{workoutExercise.technicalNote}</span>
					</div>
				)}

				{workoutExercise.lastTimeReference ? (
					<div className="exercise-logging__last-time">
						<div className="exercise-logging__last-time-header">
							<strong>Last time</strong> · {workoutExercise.lastTimeReference.dateLabel}
							<span className="exercise-logging__last-time-best">
								{workoutExercise.lastTimeReference.bestLabel}
							</span>
						</div>
						<div className="exercise-logging__last-time-chips">
							{workoutExercise.lastTimeReference.sets.map((s, i) => (
								<span key={i} className="exercise-logging__last-time-chip">
									<span className="material-symbols-rounded is-filled">check_circle</span>
									{s.valueLabel}
								</span>
							))}
							{workoutExercise.lastTimeReference.quote && (
								<span className="exercise-logging__last-time-quote">
									&ldquo;{workoutExercise.lastTimeReference.quote}&rdquo;
								</span>
							)}
						</div>
					</div>
				) : (
					<div className="exercise-logging__no-history">
						<span className="screen-empty-state__headline">No history yet</span>
						<p className="screen-empty-state__body">Today's sets become next time's reference.</p>
					</div>
				)}

				{loadedSet && (
					<StepperCluster
						setPositionLabel={`Set ${loadedIndex + 1} of ${sets.length}`}
						canPrev={loadedIndex > 0}
						canNext={loadedIndex < sets.length - 1}
						onPrev={() => setLoadedSetId(sets[loadedIndex - 1]?.id ?? null)}
						onNext={() => setLoadedSetId(sets[loadedIndex + 1]?.id ?? null)}
						primary={primaryField}
						secondary={secondaryField}
						onLog={handleLog}
						logLabel={`Log set ${loadedSet.order}`}
						logDisabled={
							exercise.metricProfile === 'weight-reps'
								? loadedSet.weightKg === undefined || loadedSet.reps === undefined
								: loadedSet.distanceKm === undefined || loadedSet.durationSec === undefined
						}
					/>
				)}

				<div className="exercise-logging__set-list">
					<div className="exercise-logging__set-list-header">
						<span>Set</span>
						<span>{exercise.metricProfile === 'weight-reps' ? 'kg' : 'km'}</span>
						<span>{exercise.metricProfile === 'weight-reps' ? 'Reps' : 'min:sec'}</span>
						<span />
					</div>
					{sets.map((set) => (
						<SetRow
							key={set.id}
							order={set.order}
							state={setRowState(set, loadedSetId)}
							primaryValueLabel={
								exercise.metricProfile === 'weight-reps'
									? set.weightKg !== undefined
										? formatValue(set.weightKg)
										: '—'
									: set.distanceKm !== undefined
										? set.distanceKm.toFixed(1)
										: '—'
							}
							secondaryValueLabel={
								exercise.metricProfile === 'weight-reps'
									? set.reps !== undefined
										? formatValue(set.reps)
										: '—'
									: set.durationSec !== undefined
										? formatDuration(set.durationSec)
										: '—'
							}
							isRecord={set.isRecord}
							pendingSync={set.pendingSync}
							hasNote={Boolean(set.note)}
							onClick={() => setLoadedSetId(set.id)}
						/>
					))}
				</div>

				<button type="button" className="exercise-logging__add-set" onClick={handleAddSet}>
					<span className="material-symbols-rounded">add</span>
					Add set
				</button>
			</div>

			<div className="exercise-logging__rest-timer">
				<RestTimerBar />
			</div>
		</div>
	);
}
