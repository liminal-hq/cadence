// P-42 Workout history list — grouped by relative/calendar-month headers, paginated backward in
// fixed-size windows since the mock repository has no server-side cursor to page against
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Button } from '../../components/ui/Button/Button';
import { WorkoutHistoryRow } from './WorkoutHistoryRow';
import { loadWorkoutSummary, type WorkoutSummary } from './loadWorkoutSummary';
import { addDays, daysBefore, formatHistoryGroupLabel, formatRowDateLabel } from './historyDates';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import { TODAY_DATE } from '../../domain/seedData';
import './history.css';

const CHUNK_DAYS = 30;
const MAX_RANGE_DAYS = 365;

interface WorkoutHistoryListProps {
	categoryFilter: string | null;
	searchQuery: string;
	onOpenWorkout: (workoutId: string) => void;
}

export function WorkoutHistoryList({
	categoryFilter,
	searchQuery,
	onOpenWorkout,
}: WorkoutHistoryListProps) {
	const repository = useLoggingRepository();
	const [rangeStart, setRangeStart] = useState(() => addDays(TODAY_DATE, -(CHUNK_DAYS - 1)));
	const [summaries, setSummaries] = useState<WorkoutSummary[] | null>(null);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			const workouts = await repository.listWorkoutsInRange(rangeStart, TODAY_DATE);
			const loaded = await Promise.all(workouts.map((w) => loadWorkoutSummary(repository, w.id)));
			if (!cancelled) setSummaries(loaded);
		}
		load();
		return () => {
			cancelled = true;
		};
	}, [repository, rangeStart]);

	if (summaries === null) return null;

	const query = searchQuery.trim().toLowerCase();
	const filtered = summaries.filter((summary) => {
		if (categoryFilter && summary.primaryCategory !== categoryFilter) return false;
		if (query) {
			const matchesTitle = summary.workout.title.toLowerCase().includes(query);
			const matchesExercise = summary.exercises.some((e) => e.name.toLowerCase().includes(query));
			if (!matchesTitle && !matchesExercise) return false;
		}
		return true;
	});

	const sorted = [...filtered].sort((a, b) => b.workout.date.localeCompare(a.workout.date));

	const groups: { label: string; items: WorkoutSummary[] }[] = [];
	for (const summary of sorted) {
		const label = formatHistoryGroupLabel(summary.workout.date, TODAY_DATE);
		const lastGroup = groups[groups.length - 1];
		if (lastGroup?.label === label) lastGroup.items.push(summary);
		else groups.push({ label, items: [summary] });
	}

	const isFiltered = Boolean(categoryFilter || query);
	const canLoadEarlier = daysBefore(TODAY_DATE, rangeStart) < MAX_RANGE_DAYS;

	if (sorted.length === 0) {
		return (
			<EmptyState
				headline={isFiltered ? 'No matching workouts' : 'No history yet'}
				body={
					isFiltered ? 'Try clearing the filter or search.' : 'Workouts you log will show up here.'
				}
			/>
		);
	}

	return (
		<div className="history-list">
			{groups.map((group) => (
				<section key={group.label}>
					<h2 className="history-hub__section-title">{group.label}</h2>
					<div>
						{group.items.map((summary) => (
							<WorkoutHistoryRow
								key={summary.workout.id}
								workout={summary.workout}
								exercises={summary.exercises}
								dateLabel={formatRowDateLabel(summary.workout.date, TODAY_DATE)}
								onClick={() => onOpenWorkout(summary.workout.id)}
							/>
						))}
					</div>
				</section>
			))}
			{canLoadEarlier && (
				<div className="history-list__load-more">
					<Button
						variant="text"
						onClick={() => setRangeStart((current) => addDays(current, -CHUNK_DAYS))}
					>
						Load earlier · {CHUNK_DAYS} more days
					</Button>
				</div>
			)}
		</div>
	);
}
