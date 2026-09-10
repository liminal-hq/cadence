// P-44 Exercise detail — the durable analytical home for one exercise, reachable from both
// History (P-42/P-43 drill-down) and Logging's exercise screen. All five tabs stay visible even
// with no data, per the design's "so nothing unlocks later" intent — Goals is a placeholder.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { DetailAppBar } from '../../components/DetailAppBar/DetailAppBar';
import { Tabs } from '../../components/ui/Tabs/Tabs';
import { ExerciseHistoryTab } from './ExerciseHistoryTab';
import { ExerciseGraphTab } from './ExerciseGraphTab';
import { ExerciseRecordsTab } from './ExerciseRecordsTab';
import { ExerciseStatsTab } from './ExerciseStatsTab';
import { ExerciseGoalsTab } from './ExerciseGoalsTab';
import { loadExerciseHistory, type ExerciseHistoryEntry } from './loadExerciseHistory';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { Exercise } from '../../domain/types';
import '../screens.css';
import './ExerciseDetailScreen.css';

interface ExerciseDetailScreenProps {
	exerciseId: string;
	backTo?: string;
}

type TabValue = 'history' | 'graph' | 'records' | 'stats' | 'goals';

const TAB_OPTIONS: { value: TabValue; label: string }[] = [
	{ value: 'history', label: 'History' },
	{ value: 'graph', label: 'Graph' },
	{ value: 'records', label: 'Records' },
	{ value: 'stats', label: 'Stats' },
	{ value: 'goals', label: 'Goals' },
];

const SINCE_FORMAT = new Intl.DateTimeFormat('en-CA', { month: 'short', year: 'numeric' });

export function ExerciseDetailScreen({
	exerciseId,
	backTo = '/history',
}: ExerciseDetailScreenProps) {
	const repository = useLoggingRepository();
	const [exercise, setExercise] = useState<Exercise | null>(null);
	const [history, setHistory] = useState<ExerciseHistoryEntry[] | null>(null);
	const [tab, setTab] = useState<TabValue>('history');

	useEffect(() => {
		let cancelled = false;
		Promise.all([
			repository.getExercise(exerciseId),
			loadExerciseHistory(repository, exerciseId),
		]).then(([loadedExercise, loadedHistory]) => {
			if (cancelled) return;
			setExercise(loadedExercise);
			setHistory(loadedHistory);
		});
		return () => {
			cancelled = true;
		};
	}, [repository, exerciseId]);

	if (!exercise || !history) return null;

	async function toggleFavourite() {
		const updated = await repository.updateExerciseFavourite(exerciseId, !exercise!.favourite);
		setExercise(updated);
	}

	const earliestDate = history.length ? history[history.length - 1].workout.date : undefined;
	const subtitle = [
		`${history.length} workout${history.length === 1 ? '' : 's'}`,
		earliestDate ? `since ${SINCE_FORMAT.format(new Date(`${earliestDate}T00:00:00`))}` : undefined,
		exercise.metricProfile === 'weight-reps' ? 'Weight + Reps' : 'Distance + Duration',
	]
		.filter(Boolean)
		.join(' · ');

	return (
		<div className="screen-shell">
			<DetailAppBar
				title={exercise.name}
				category={exercise.category}
				subtitle={subtitle}
				backTo={backTo}
				actions={[
					{
						icon: 'star',
						label: exercise.favourite ? 'Remove favourite' : 'Add favourite',
						active: exercise.favourite,
						iconFilled: true,
						onClick: toggleFavourite,
					},
					{ icon: 'edit', label: 'Edit exercise' },
				]}
			/>
			<div className="screen-shell__content exercise-detail">
				<div className="exercise-detail__tabs">
					<Tabs options={TAB_OPTIONS} value={tab} onChange={setTab} />
				</div>
				{tab === 'history' && <ExerciseHistoryTab exercise={exercise} history={history} />}
				{tab === 'graph' && <ExerciseGraphTab exercise={exercise} history={history} />}
				{tab === 'records' && (
					<ExerciseRecordsTab history={history} metricProfile={exercise.metricProfile} />
				)}
				{tab === 'stats' && (
					<ExerciseStatsTab history={history} metricProfile={exercise.metricProfile} />
				)}
				{tab === 'goals' && <ExerciseGoalsTab />}
			</div>
		</div>
	);
}
