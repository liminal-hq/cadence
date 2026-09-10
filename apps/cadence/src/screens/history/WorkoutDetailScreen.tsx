// P-43 Historical workout detail — reached at /history/workout/$workoutId, its own top-level
// route (no AppShell) since its back target and content are workout-specific, not tab-shaped
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AppBar } from '../../components/ui/AppBar/AppBar';
import { Surface } from '../../components/ui/Surface/Surface';
import { Button } from '../../components/ui/Button/Button';
import { Tag } from '../../components/ui/Tag/Tag';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import { formatWorkoutDuration, formatNumber } from '../../domain/format';
import { TODAY_DATE } from '../../domain/seedData';
import { loadWorkoutSummary, type WorkoutSummary } from './loadWorkoutSummary';
import { formatCalendarDateLabel } from './historyDates';
import '../screens.css';
import './WorkoutDetailScreen.css';

interface WorkoutDetailScreenProps {
	workoutId: string;
}

function totalDistanceKm(summary: WorkoutSummary): number {
	return summary.exercises
		.filter((e) => e.metricProfile === 'distance-duration')
		.flatMap((e) => e.sets)
		.filter((s) => s.status === 'completed')
		.reduce((sum, s) => sum + (s.distanceKm ?? 0), 0);
}

function totalVolumeKg(summary: WorkoutSummary): number {
	return summary.exercises
		.filter((e) => e.metricProfile === 'weight-reps')
		.flatMap((e) => e.sets)
		.filter((s) => s.status === 'completed')
		.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
}

function totalCompletedSets(summary: WorkoutSummary): number {
	return summary.exercises.flatMap((e) => e.sets).filter((s) => s.status === 'completed').length;
}

export function WorkoutDetailScreen({ workoutId }: WorkoutDetailScreenProps) {
	const navigate = useNavigate();
	const repository = useLoggingRepository();
	const [summary, setSummary] = useState<WorkoutSummary | null>(null);
	const [noteDraft, setNoteDraft] = useState('');
	const [overlapWorkoutTitle, setOverlapWorkoutTitle] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		loadWorkoutSummary(repository, workoutId).then((loaded) => {
			if (cancelled) return;
			setSummary(loaded);
			setNoteDraft(loaded.workout.note ?? '');
		});
		return () => {
			cancelled = true;
		};
	}, [repository, workoutId]);

	useEffect(() => {
		const overlapId = summary?.workout.healthConnect?.overlapsWithWorkoutId;
		if (!overlapId) {
			setOverlapWorkoutTitle(null);
			return;
		}
		let cancelled = false;
		repository.getWorkout(overlapId).then((overlap) => {
			if (!cancelled) setOverlapWorkoutTitle(overlap.title);
		});
		return () => {
			cancelled = true;
		};
	}, [repository, summary?.workout.healthConnect?.overlapsWithWorkoutId]);

	if (!summary) return null;
	const { workout, exercises } = summary;

	async function handleSaveNote() {
		const updated = await repository.updateWorkoutNote(workoutId, noteDraft || undefined);
		setSummary((current) => (current ? { ...current, workout: updated } : current));
	}

	async function handleCopyToToday() {
		const duplicated = await repository.duplicateWorkout(workoutId, TODAY_DATE);
		navigate({ to: '/history/workout/$workoutId', params: { workoutId: duplicated.id } });
	}

	return (
		<div className="screen-shell">
			<AppBar title={workout.title} size="medium" back={{ to: '/history' }} />
			<div className="screen-shell__content workout-detail">
				<p className="workout-detail__date">{formatCalendarDateLabel(workout.date)}</p>

				<Surface tone="container" radius="l" className="workout-detail__stats">
					<div className="workout-detail__stat">
						<span className="workout-detail__stat-value">
							{formatWorkoutDuration(workout.startedAt, workout.completedAt)}
						</span>
						<span className="workout-detail__stat-label">Duration</span>
					</div>
					<div className="workout-detail__stat">
						<span className="workout-detail__stat-value">{totalCompletedSets(summary)}</span>
						<span className="workout-detail__stat-label">Sets</span>
					</div>
					{totalDistanceKm(summary) > 0 ? (
						<div className="workout-detail__stat">
							<span className="workout-detail__stat-value">
								{formatNumber(totalDistanceKm(summary))} km
							</span>
							<span className="workout-detail__stat-label">Distance</span>
						</div>
					) : (
						<div className="workout-detail__stat">
							<span className="workout-detail__stat-value">
								{formatNumber(totalVolumeKg(summary))} kg
							</span>
							<span className="workout-detail__stat-label">Volume</span>
						</div>
					)}
				</Surface>

				{workout.source === 'health-connect-import' && workout.healthConnect && (
					<Surface tone="container-high" radius="l" className="workout-detail__hc-card">
						<p className="workout-detail__hc-title">
							Imported from {workout.healthConnect.sourceApp}
						</p>
						{workout.healthConnect.unmappedMetrics &&
							workout.healthConnect.unmappedMetrics.length > 0 && (
								<div>
									<p className="workout-detail__hc-subtitle">Also recorded</p>
									<ul className="workout-detail__hc-list">
										{workout.healthConnect.unmappedMetrics.map((metric) => (
											<li key={metric}>{metric}</li>
										))}
									</ul>
								</div>
							)}
						{overlapWorkoutTitle && (
							<div className="workout-detail__overlap">
								<p className="workout-detail__hc-subtitle">Needs review</p>
								<p>
									This may be the same session as “{overlapWorkoutTitle}”, logged manually the same
									day.
								</p>
								<Button variant="outlined" onClick={() => {}}>
									Change
								</Button>
							</div>
						)}
					</Surface>
				)}

				<div className="workout-detail__exercises">
					{exercises.map((exercise) => {
						const completed = exercise.sets.filter((s) => s.status === 'completed');
						return (
							<div key={exercise.name} className="workout-detail__exercise">
								<span
									className={
										exercise.archived
											? 'workout-detail__exercise-name workout-detail__exercise-name--archived'
											: 'workout-detail__exercise-name'
									}
								>
									{exercise.name}
								</span>
								<div className="workout-detail__set-chips">
									{completed.map((set) => (
										<span key={set.id} className="workout-detail__set-chip">
											{exercise.metricProfile === 'weight-reps'
												? `${formatNumber(set.weightKg ?? 0)} × ${set.reps ?? 0}`
												: `${formatNumber(set.distanceKm ?? 0)} km`}
											{set.isRecord && (
												<span
													className="material-symbols-rounded is-filled workout-detail__set-chip-trophy"
													aria-label="Personal record"
												>
													trophy
												</span>
											)}
										</span>
									))}
									{completed.length === 0 && (
										<span className="workout-detail__set-chip workout-detail__set-chip--planned">
											Planned, not yet logged
										</span>
									)}
								</div>
							</div>
						);
					})}
				</div>

				<div className="workout-detail__note">
					<label className="workout-detail__note-label" htmlFor="workout-note">
						Note
					</label>
					<textarea
						id="workout-note"
						className="workout-detail__note-input"
						value={noteDraft}
						onChange={(event) => setNoteDraft(event.target.value)}
						placeholder="Add a note about this workout"
					/>
					<Button
						variant="text"
						onClick={handleSaveNote}
						disabled={noteDraft === (workout.note ?? '')}
					>
						Save note
					</Button>
				</div>

				<div className="workout-detail__actions">
					<Button variant="tonal" icon="content_copy" onClick={handleCopyToToday}>
						Copy to today
					</Button>
					{workout.loggedByWatch && (
						<Tag
							label="Logged from watch"
							icon="watch"
							background="var(--cadence-secondary-container)"
							colour="var(--cadence-on-secondary-container)"
						/>
					)}
				</div>
			</div>
		</div>
	);
}
