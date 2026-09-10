// A workout row shared by P-40's selected-day expansion and P-42's list — title, relative
// date/duration, provenance pills, and a compact per-exercise set summary
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Tag } from '../../components/ui/Tag/Tag';
import { formatWorkoutDuration } from '../../domain/format';
import type { Workout } from '../../domain/types';
import { formatSetSummary, type SetSummaryExerciseInput } from './formatSetSummary';
import './WorkoutHistoryRow.css';

interface WorkoutHistoryRowProps {
	workout: Workout;
	exercises: SetSummaryExerciseInput[];
	dateLabel: string;
	onClick: () => void;
}

export function WorkoutHistoryRow({
	workout,
	exercises,
	dateLabel,
	onClick,
}: WorkoutHistoryRowProps) {
	const { segments, overflowCount } = formatSetSummary(exercises);

	return (
		<button type="button" className="workout-history-row" onClick={onClick}>
			<div className="workout-history-row__header">
				<span className="workout-history-row__title">{workout.title}</span>
				{workout.loggedByWatch && (
					<Tag
						label="Watch"
						icon="watch"
						background="var(--cadence-secondary-container)"
						colour="var(--cadence-on-secondary-container)"
					/>
				)}
				{workout.source === 'health-connect-import' && (
					<Tag
						label="Health Connect import"
						background="var(--cadence-secondary-container)"
						colour="var(--cadence-on-secondary-container)"
					/>
				)}
				{workout.source === 'fitnotes-import' && (
					<Tag
						label="FitNotes import"
						background="var(--cadence-secondary-container)"
						colour="var(--cadence-on-secondary-container)"
					/>
				)}
			</div>
			<div className="workout-history-row__meta">
				<span>{dateLabel}</span>
				<span>{formatWorkoutDuration(workout.startedAt, workout.completedAt)}</span>
			</div>
			{segments.length > 0 && (
				<p className="workout-history-row__summary">
					{segments.map((segment, index) => (
						<span key={segment.exerciseName} className="workout-history-row__segment">
							{index > 0 && ' · '}
							<span className={segment.archived ? 'workout-history-row__archived' : undefined}>
								{segment.exerciseName} {segment.valueText}
							</span>
							{segment.isRecord && (
								<span
									className="material-symbols-rounded is-filled workout-history-row__trophy"
									aria-label="Personal record"
								>
									trophy
								</span>
							)}
						</span>
					))}
					{overflowCount > 0 && (
						<span className="workout-history-row__overflow"> +{overflowCount}</span>
					)}
				</p>
			)}
		</button>
	);
}
