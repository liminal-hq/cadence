// P-44's Stats tab — the same computeStats data the Graph/Records tabs already derive,
// presented as period-scoped summary numbers rather than a trend or a record
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useMemo, useState } from 'react';
import { SegmentedControl } from '../../components/ui/SegmentedControl/SegmentedControl';
import { StatTile } from './StatTile';
import { computeStats } from './computeStats';
import { addDays } from './historyDates';
import { formatNumber } from '../../domain/format';
import { TODAY_DATE } from '../../domain/seedData';
import type { MetricProfile } from '../../domain/types';
import { flattenDatedSets, type ExerciseHistoryEntry } from './loadExerciseHistory';
import './ExerciseStatsTab.css';

interface ExerciseStatsTabProps {
	history: ExerciseHistoryEntry[];
	metricProfile: MetricProfile;
}

type Period = '7' | '30' | '365' | 'all';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
	{ value: '7', label: 'Week' },
	{ value: '30', label: 'Month' },
	{ value: '365', label: 'Year' },
	{ value: 'all', label: 'All time' },
];

export function ExerciseStatsTab({ history, metricProfile }: ExerciseStatsTabProps) {
	const [period, setPeriod] = useState<Period>('all');
	const datedSets = useMemo(() => flattenDatedSets(history), [history]);
	// Inclusive N-day window ending today — "Week" (7) means today and the 6 days before it.
	const range =
		period === 'all'
			? undefined
			: { startDate: addDays(TODAY_DATE, -Number(period) + 1), endDate: TODAY_DATE };
	const stats = computeStats(datedSets, range);

	return (
		<div className="exercise-stats-tab">
			<SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
			<div className="exercise-stats-tab__grid">
				<StatTile value={String(stats.setCount)} label="Sets" />
				{metricProfile === 'weight-reps' ? (
					<>
						<StatTile value={String(stats.repCount)} label="Reps" />
						<StatTile value={`${formatNumber(stats.volumeKg)} kg`} label="Volume" />
						<StatTile
							value={
								stats.maxWeightKg !== undefined ? `${formatNumber(stats.maxWeightKg)} kg` : '—'
							}
							label="Max weight"
						/>
						<StatTile
							value={
								stats.bestEstimatedOneRm !== undefined
									? `${formatNumber(stats.bestEstimatedOneRm)} kg`
									: '—'
							}
							label="Est. 1RM"
						/>
					</>
				) : (
					<StatTile
						value={
							stats.totalDistanceKm !== undefined
								? `${formatNumber(stats.totalDistanceKm)} km`
								: '—'
						}
						label="Distance"
					/>
				)}
			</div>
		</div>
	);
}
