// P-48 Exercise goals — define and review a target, with progress computed live over logged history (SPEC.md 8.8: a goal and a record are different entities, so achievement is a manual toggle distinct from that computed progress)
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { Banner } from '../../components/ui/Banner/Banner';
import { Button } from '../../components/ui/Button/Button';
import { Chip } from '../../components/ui/Chip/Chip';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Surface } from '../../components/ui/Surface/Surface';
import { Switch } from '../../components/ui/Switch/Switch';
import { TextField } from '../../components/ui/TextField/TextField';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import { formatDurationSec, formatNumber } from '../../domain/format';
import type { Exercise, ExerciseGoal, ExerciseGoalValues } from '../../domain/types';
import { computeGoalProgress } from './computeGoalProgress';
import { formatCalendarDateLabel } from './historyDates';
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
		const weight = goal.targetWeightKg != null ? `${formatNumber(goal.targetWeightKg)} kg` : '—';
		const reps = goal.targetReps != null ? goal.targetReps : '—';
		return `${weight} × ${reps}`;
	}
	const distance =
		goal.targetDistanceKm != null ? `${formatNumber(goal.targetDistanceKm)} km` : '—';
	const duration = goal.targetDurationSec != null ? formatDurationSec(goal.targetDurationSec) : '—';
	return `${distance} · ${duration}`;
}

function bestLabel(
	best: ReturnType<typeof computeGoalProgress>['best'],
	metricProfile: Exercise['metricProfile'],
): string {
	if (!best) return 'No history yet';
	const date = formatCalendarDateLabel(best.date);
	if (metricProfile === 'weight-reps') {
		const weight = best.weightKg != null ? formatNumber(best.weightKg) : '—';
		return `Best so far: ${weight} kg × ${best.reps ?? '—'} (${date})`;
	}
	const distance = best.distanceKm != null ? formatNumber(best.distanceKm) : '—';
	const duration = best.durationSec != null ? formatDurationSec(best.durationSec) : '—';
	return `Best so far: ${distance} km · ${duration} (${date})`;
}

/** Which profile a goal's own stored target fields belong to — `undefined` for a targetless goal. Distinct from `exercise.metricProfile`, which can drift away from it if the exercise's profile changes after the goal was created (nothing currently locks that for a history-free exercise). */
function goalMetricProfile(goal: ExerciseGoal): Exercise['metricProfile'] | undefined {
	if (goal.targetWeightKg != null || goal.targetReps != null) return 'weight-reps';
	if (goal.targetDistanceKm != null || goal.targetDurationSec != null) return 'distance-duration';
	return undefined;
}

function draftHasTarget(
	draft: ExerciseGoalValues,
	metricProfile: Exercise['metricProfile'],
): boolean {
	return metricProfile === 'weight-reps'
		? draft.targetWeightKg != null || draft.targetReps != null
		: draft.targetDistanceKm != null || draft.targetDurationSec != null;
}

/** `undefined` when the draft is safe to save — otherwise a message to show the user. Both integer fields map to a Rust `i32` (a fractional value fails deserialization rather than the intended validation error), and an inverted date range can never be achieved (`computeGoalProgress`'s eligible window requires on-or-after start AND on-or-before target). */
export function draftValidationError(
	draft: ExerciseGoalValues,
	metricProfile: Exercise['metricProfile'],
): string | undefined {
	if (!draft.title.trim()) return 'Enter a title.';
	if (!draftHasTarget(draft, metricProfile)) return 'Enter a target.';
	if (draft.targetWeightKg != null && !(draft.targetWeightKg > 0)) {
		return 'Target weight must be greater than zero.';
	}
	if (draft.targetReps != null && !Number.isInteger(draft.targetReps)) {
		return 'Target reps must be a whole number.';
	}
	if (draft.targetReps != null && !(draft.targetReps > 0)) {
		return 'Target reps must be greater than zero.';
	}
	if (draft.targetDistanceKm != null && !(draft.targetDistanceKm > 0)) {
		return 'Target distance must be greater than zero.';
	}
	if (draft.targetDurationSec != null && !Number.isInteger(draft.targetDurationSec)) {
		return 'Target duration must be a whole number of seconds.';
	}
	if (draft.targetDurationSec != null && !(draft.targetDurationSec > 0)) {
		return 'Target duration must be greater than zero.';
	}
	if (draft.startDate && draft.targetDate && draft.targetDate < draft.startDate) {
		return 'Target date must be on or after the start date.';
	}
	return undefined;
}

/** `undefined` when the goal has neither date set — nothing to render on the row. */
function dateRangeLabel(goal: ExerciseGoal): string | undefined {
	if (!goal.startDate && !goal.targetDate) return undefined;
	const start = goal.startDate ? formatCalendarDateLabel(goal.startDate) : 'the start';
	const target = goal.targetDate ? formatCalendarDateLabel(goal.targetDate) : 'no deadline';
	return `${start} → ${target}`;
}

export function ExerciseGoalsTab({ exercise, history }: ExerciseGoalsTabProps) {
	const repository = useLoggingRepository();
	const [goals, setGoals] = useState<ExerciseGoal[] | null>(null);
	const [draft, setDraft] = useState<ExerciseGoalValues | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [goalPendingDelete, setGoalPendingDelete] = useState<ExerciseGoal | null>(null);
	const [showArchived, setShowArchived] = useState(false);
	const [saving, setSaving] = useState(false);

	const reload = () => {
		repository.listExerciseGoals(exercise.id).then(setGoals);
	};

	useEffect(reload, [repository, exercise.id]);

	const hasArchived = Boolean(goals?.some((goal) => goal.archived));
	useEffect(() => {
		// The last archived goal being unarchived or deleted must not strand the view on an empty
		// "No archived goals" state with no chip left to get back to the active list.
		if (!hasArchived) setShowArchived(false);
	}, [hasArchived]);

	if (!goals) return null;

	const datedSets = flattenDatedSets(history);
	const visibleGoals = goals.filter((goal) => goal.archived === showArchived);

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
		const goalProfile = goalMetricProfile(goal);
		const drifted = goalProfile != null && goalProfile !== exercise.metricProfile;
		setEditingId(goal.id);
		setDraft({
			exerciseId: goal.exerciseId,
			title: goal.title,
			// A drifted goal's stored fields belong to the exercise's *previous* metric profile —
			// carrying them into the draft would let a save persist both profiles' fields at once (see
			// goalMetricProfile), so they're dropped here and the user fills in a fresh target instead.
			targetWeightKg: drifted ? undefined : goal.targetWeightKg,
			targetReps: drifted ? undefined : goal.targetReps,
			targetDistanceKm: drifted ? undefined : goal.targetDistanceKm,
			targetDurationSec: drifted ? undefined : goal.targetDurationSec,
			startDate: goal.startDate,
			targetDate: goal.targetDate,
		});
	}

	async function handleSave() {
		if (!draft || saving) return;
		const validationError = draftValidationError(draft, exercise.metricProfile);
		if (validationError) {
			setError(validationError);
			return;
		}
		setSaving(true);
		try {
			setError(null);
			if (editingId) {
				await repository.updateExerciseGoal(editingId, draft);
			} else {
				await repository.createExerciseGoal(draft);
			}
			reload();
			setDraft(null);
			setEditingId(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="exercise-goals-tab">
			{error && (
				<Banner icon="error" message={error} tone="attention" onDismiss={() => setError(null)} />
			)}

			{hasArchived && (
				<Chip
					variant="filter"
					label="Archived"
					selected={showArchived}
					onClick={() => setShowArchived((current) => !current)}
				/>
			)}

			{visibleGoals.length === 0 && !draft ? (
				<EmptyState
					headline={showArchived ? 'No archived goals' : 'No goals yet'}
					body={
						showArchived
							? 'Goals you archive appear here.'
							: 'Set a target for this exercise to track progress toward it.'
					}
					action={
						showArchived ? undefined : (
							<Button variant="filled" icon="add" onClick={startCreate}>
								Add goal
							</Button>
						)
					}
				/>
			) : (
				<div className="exercise-goals-tab__list">
					{visibleGoals.map((goal) => {
						const goalProfile = goalMetricProfile(goal);
						const profileMismatch = goalProfile != null && goalProfile !== exercise.metricProfile;
						const progress = profileMismatch ? null : computeGoalProgress(goal, datedSets);
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
									{progress?.overdue && (
										<span className="exercise-goals-tab__overdue">Overdue</span>
									)}
								</div>
								{profileMismatch ? (
									<span className="exercise-goals-tab__target">
										This goal's target was set for the exercise's previous metric profile and no
										longer applies — edit it to set a new target.
									</span>
								) : (
									<>
										<span className="exercise-goals-tab__target">
											Target: {targetLabel(goal, exercise.metricProfile)}
										</span>
										{dateRangeLabel(goal) && (
											<span className="exercise-goals-tab__dates">{dateRangeLabel(goal)}</span>
										)}
										<span className="exercise-goals-tab__best">
											{progress?.achieved
												? 'Goal met by logged history'
												: bestLabel(progress?.best, exercise.metricProfile)}
										</span>
									</>
								)}
								<div className="exercise-goals-tab__row-actions">
									{!profileMismatch && (
										<Switch
											checked={goal.achievedAt != null}
											onChange={(achieved) =>
												guarded(() => repository.setExerciseGoalAchieved(goal.id, achieved))
											}
											label={goal.achievedAt ? 'Mark not achieved' : 'Mark achieved'}
										/>
									)}
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
					{!draft && !showArchived && (
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
								step={1}
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
								step={1}
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
						<Button
							variant="filled"
							disabled={saving || draftValidationError(draft, exercise.metricProfile) != null}
							onClick={handleSave}
						>
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
								if (editingId === goalPendingDelete.id) {
									setDraft(null);
									setEditingId(null);
								}
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
