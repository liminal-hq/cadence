// P-48 Exercise goals — define and review a target, with progress computed live over logged history (SPEC.md 8.8: a goal and a record are different entities, so achievement is a manual toggle distinct from that computed progress)
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { Banner } from '../../components/ui/Banner/Banner';
import { Button } from '../../components/ui/Button/Button';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Surface } from '../../components/ui/Surface/Surface';
import { Switch } from '../../components/ui/Switch/Switch';
import { TextField } from '../../components/ui/TextField/TextField';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { Exercise, ExerciseGoal, ExerciseGoalValues } from '../../domain/types';
import { computeGoalProgress } from './computeGoalProgress';
import { flattenDatedSets, type ExerciseHistoryEntry } from './loadExerciseHistory';
import './ExerciseGoalsTab.css';

interface ExerciseGoalsTabProps {
	exercise: Exercise;
	history: ExerciseHistoryEntry[];
}

function blankValues(exerciseId: string): ExerciseGoalValues {
	return { exerciseId, title: '' };
}

function targetLabel(goal: ExerciseGoal, metricProfile: Exercise['metricProfile']): string {
	if (metricProfile === 'weight-reps') {
		const weight = goal.targetWeightKg != null ? `${goal.targetWeightKg} kg` : '—';
		const reps = goal.targetReps != null ? goal.targetReps : '—';
		return `${weight} × ${reps}`;
	}
	const distance = goal.targetDistanceKm != null ? `${goal.targetDistanceKm} km` : '—';
	const duration = goal.targetDurationSec != null ? `${goal.targetDurationSec}s` : '—';
	return `${distance} · ${duration}`;
}

function bestLabel(
	best: ReturnType<typeof computeGoalProgress>['best'],
	metricProfile: Exercise['metricProfile'],
): string {
	if (!best) return 'No history yet';
	if (metricProfile === 'weight-reps') {
		return `Best so far: ${best.weightKg ?? '—'} kg × ${best.reps ?? '—'} (${best.date})`;
	}
	return `Best so far: ${best.distanceKm ?? '—'} km · ${best.durationSec ?? '—'}s (${best.date})`;
}

export function ExerciseGoalsTab({ exercise, history }: ExerciseGoalsTabProps) {
	const repository = useLoggingRepository();
	const [goals, setGoals] = useState<ExerciseGoal[] | null>(null);
	const [draft, setDraft] = useState<ExerciseGoalValues | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [goalPendingDelete, setGoalPendingDelete] = useState<ExerciseGoal | null>(null);

	const reload = () => {
		repository.listExerciseGoals(exercise.id).then(setGoals);
	};

	useEffect(reload, [repository, exercise.id]);

	if (!goals) return null;

	const datedSets = flattenDatedSets(history);

	async function guarded(action: () => Promise<unknown>) {
		try {
			setError(null);
			await action();
			reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	function startCreate() {
		setEditingId(null);
		setDraft(blankValues(exercise.id));
	}

	function startEdit(goal: ExerciseGoal) {
		setEditingId(goal.id);
		setDraft({
			exerciseId: goal.exerciseId,
			title: goal.title,
			targetWeightKg: goal.targetWeightKg,
			targetReps: goal.targetReps,
			targetDistanceKm: goal.targetDistanceKm,
			targetDurationSec: goal.targetDurationSec,
			startDate: goal.startDate,
			targetDate: goal.targetDate,
		});
	}

	async function handleSave() {
		if (!draft) return;
		if (editingId) {
			await guarded(() => repository.updateExerciseGoal(editingId, draft));
		} else {
			await guarded(() => repository.createExerciseGoal(draft));
		}
		setDraft(null);
		setEditingId(null);
	}

	return (
		<div className="exercise-goals-tab">
			{error && (
				<Banner icon="error" message={error} tone="attention" onDismiss={() => setError(null)} />
			)}

			{goals.length === 0 && !draft ? (
				<EmptyState
					headline="No goals yet"
					body="Set a target for this exercise to track progress toward it."
					action={
						<Button variant="filled" icon="add" onClick={startCreate}>
							Add goal
						</Button>
					}
				/>
			) : (
				<div className="exercise-goals-tab__list">
					{goals.map((goal) => {
						const progress = computeGoalProgress(goal, datedSets);
						return (
							<Surface
								key={goal.id}
								tone="container-low"
								radius="m"
								className="exercise-goals-tab__row"
							>
								<div className="exercise-goals-tab__row-header">
									<span className="exercise-goals-tab__title">{goal.title}</span>
									{goal.achievedAt && (
										<span className="exercise-goals-tab__achieved">Achieved</span>
									)}
								</div>
								<span className="exercise-goals-tab__target">
									Target: {targetLabel(goal, exercise.metricProfile)}
								</span>
								<span className="exercise-goals-tab__best">
									{progress.achieved
										? 'Goal met by logged history'
										: bestLabel(progress.best, exercise.metricProfile)}
								</span>
								<div className="exercise-goals-tab__row-actions">
									<Switch
										checked={goal.achievedAt != null}
										onChange={(achieved) =>
											guarded(() => repository.setExerciseGoalAchieved(goal.id, achieved))
										}
										label={goal.achievedAt ? 'Mark not achieved' : 'Mark achieved'}
									/>
									<Button variant="text" onClick={() => startEdit(goal)}>
										Edit
									</Button>
									<Button
										variant="text"
										onClick={() =>
											guarded(() => repository.setExerciseGoalArchived(goal.id, !goal.archived))
										}
									>
										{goal.archived ? 'Unarchive' : 'Archive'}
									</Button>
									<Button variant="text" tone="error" onClick={() => setGoalPendingDelete(goal)}>
										Delete
									</Button>
								</div>
							</Surface>
						);
					})}
					{!draft && (
						<Button variant="tonal" icon="add" onClick={startCreate}>
							Add goal
						</Button>
					)}
				</div>
			)}

			{draft && (
				<Surface tone="container-low" radius="m" className="exercise-goals-tab__form">
					<TextField
						label="Title"
						value={draft.title}
						onChange={(title) => setDraft({ ...draft, title })}
						autoFocus
					/>
					{exercise.metricProfile === 'weight-reps' ? (
						<>
							<TextField
								label="Target weight (kg)"
								type="number"
								value={draft.targetWeightKg != null ? String(draft.targetWeightKg) : ''}
								onChange={(raw) =>
									setDraft({
										...draft,
										targetWeightKg: raw.trim() === '' ? undefined : Number(raw),
									})
								}
							/>
							<TextField
								label="Target reps"
								type="number"
								value={draft.targetReps != null ? String(draft.targetReps) : ''}
								onChange={(raw) =>
									setDraft({ ...draft, targetReps: raw.trim() === '' ? undefined : Number(raw) })
								}
							/>
						</>
					) : (
						<>
							<TextField
								label="Target distance (km)"
								type="number"
								value={draft.targetDistanceKm != null ? String(draft.targetDistanceKm) : ''}
								onChange={(raw) =>
									setDraft({
										...draft,
										targetDistanceKm: raw.trim() === '' ? undefined : Number(raw),
									})
								}
							/>
							<TextField
								label="Target duration (seconds)"
								type="number"
								value={draft.targetDurationSec != null ? String(draft.targetDurationSec) : ''}
								onChange={(raw) =>
									setDraft({
										...draft,
										targetDurationSec: raw.trim() === '' ? undefined : Number(raw),
									})
								}
							/>
						</>
					)}
					<TextField
						label="Start date"
						type="date"
						value={draft.startDate ?? ''}
						onChange={(startDate) => setDraft({ ...draft, startDate: startDate || undefined })}
					/>
					<TextField
						label="Target date"
						type="date"
						value={draft.targetDate ?? ''}
						onChange={(targetDate) => setDraft({ ...draft, targetDate: targetDate || undefined })}
					/>
					<div className="exercise-goals-tab__form-actions">
						<Button
							variant="text"
							onClick={() => {
								setDraft(null);
								setEditingId(null);
							}}
						>
							Cancel
						</Button>
						<Button variant="filled" disabled={!draft.title.trim()} onClick={handleSave}>
							Save
						</Button>
					</div>
				</Surface>
			)}

			<Dialog
				open={goalPendingDelete != null}
				onClose={() => setGoalPendingDelete(null)}
				headline="Delete this goal?"
				role="dialog"
				actions={
					<>
						<Button variant="text" onClick={() => setGoalPendingDelete(null)}>
							Cancel
						</Button>
						<Button
							variant="filled"
							tone="error"
							onClick={async () => {
								if (!goalPendingDelete) return;
								await guarded(() => repository.deleteExerciseGoal(goalPendingDelete.id));
								setGoalPendingDelete(null);
							}}
						>
							Delete
						</Button>
					</>
				}
			>
				<p>This permanently removes "{goalPendingDelete?.title}".</p>
			</Dialog>
		</div>
	);
}
