// P-47 Training analysis — period/metric/category-or-exercise breakdown across every completed set, with drill-down back to the originating workout (SPEC.md 8.7: "selecting an analytic value reveals the originating workout and set"). Progress's default landing screen, replacing ProgressScreen.tsx's ComingSoon.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '../../components/ui/Button/Button';
import { Chip } from '../../components/ui/Chip/Chip';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { SegmentedControl } from '../../components/ui/SegmentedControl/SegmentedControl';
import { Surface } from '../../components/ui/Surface/Surface';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import { formatNumber, todayLocalDate } from '../../domain/format';
import { addDays, formatCalendarDateLabel } from '../history/historyDates';
import type { AnalysisSetEntry } from '../../domain/types';
import {
	ANALYSIS_METRICS,
	ANALYSIS_METRIC_DEFINITIONS,
	ANALYSIS_METRIC_LABELS,
	ANALYSIS_METRIC_UNITS,
	computeBreakdown,
	countTrainingDays,
	type AnalysisGroupBy,
	type AnalysisMetric,
} from './computeTrainingAnalysis';
import './progress.css';

export type Period = '7d' | '30d' | '90d' | '1y' | 'all';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
	{ value: '7d', label: '7 days' },
	{ value: '30d', label: '30 days' },
	{ value: '90d', label: '90 days' },
	{ value: '1y', label: '1 year' },
	{ value: 'all', label: 'All time' },
];

const GROUP_BY_OPTIONS: { value: AnalysisGroupBy; label: string }[] = [
	{ value: 'category', label: 'By category' },
	{ value: 'exercise', label: 'By exercise' },
];

const EARLIEST_DATE = '2000-01-01';

export function dateRangeFor(
	period: Period,
	today: string,
): { startDate: string; endDate: string } {
	if (period === 'all') return { startDate: EARLIEST_DATE, endDate: today };
	const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[period];
	// The backend's BETWEEN range is inclusive of both endpoints, so a window of exactly `days` dates ending on `today` starts `days - 1` days earlier, not `days` days earlier.
	return { startDate: addDays(today, -(days - 1)), endDate: today };
}

// Bare, no own AppBar — TabsLayout's shared AppShell supplies the title/top bar here, same shape as TodayScreen/RoutineListScreen.
export function TrainingAnalysisScreen() {
	const repository = useLoggingRepository();
	const navigate = useNavigate();
	const [period, setPeriod] = useState<Period>('30d');
	const [metric, setMetric] = useState<AnalysisMetric>('volume');
	const [groupBy, setGroupBy] = useState<AnalysisGroupBy>('category');
	const [entries, setEntries] = useState<AnalysisSetEntry[] | null>(null);
	const [expandedKey, setExpandedKey] = useState<string | null>(null);

	const today = useMemo(() => todayLocalDate(), []);
	const { startDate, endDate } = useMemo(() => dateRangeFor(period, today), [period, today]);

	useEffect(() => {
		let cancelled = false;
		setEntries(null);
		repository.listAnalysisSets(startDate, endDate).then((result) => {
			if (!cancelled) setEntries(result);
		});
		return () => {
			cancelled = true;
		};
	}, [repository, startDate, endDate]);

	if (!entries) return null;

	const rows = computeBreakdown(entries, metric, groupBy);
	const unit = ANALYSIS_METRIC_UNITS[metric];

	return (
		<div className="training-analysis">
			<div className="training-analysis__filters">
				{PERIOD_OPTIONS.map((option) => (
					<Chip
						key={option.value}
						variant="filter"
						label={option.label}
						selected={period === option.value}
						onClick={() => setPeriod(option.value)}
					/>
				))}
			</div>

			<div className="training-analysis__filters">
				{ANALYSIS_METRICS.map((option) => (
					<Chip
						key={option}
						variant="filter"
						label={ANALYSIS_METRIC_LABELS[option]}
						selected={metric === option}
						onClick={() => setMetric(option)}
					/>
				))}
			</div>

			<p className="training-analysis__metric-definition">{ANALYSIS_METRIC_DEFINITIONS[metric]}</p>

			<SegmentedControl options={GROUP_BY_OPTIONS} value={groupBy} onChange={setGroupBy} />

			{entries.length === 0 ? (
				<EmptyState
					headline="No data yet"
					body="Complete some sets in this period to see a breakdown here."
				/>
			) : rows.length === 0 ? (
				<EmptyState
					headline="No matching sets"
					body={`No sets in this period support ${ANALYSIS_METRIC_LABELS[metric].toLowerCase()}.`}
				/>
			) : (
				<>
					<p className="training-analysis__caption">
						{countTrainingDays(entries)} training day
						{countTrainingDays(entries) === 1 ? '' : 's'} in this period · completed sets only
					</p>
					<table className="training-analysis__table">
						<caption className="ui-visually-hidden">
							{ANALYSIS_METRIC_LABELS[metric]} by {groupBy}
						</caption>
						<thead>
							<tr>
								<th scope="col">{groupBy === 'category' ? 'Category' : 'Exercise'}</th>
								<th scope="col">
									{ANALYSIS_METRIC_LABELS[metric]}
									{unit ? ` (${unit})` : ''}
								</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<Fragment key={row.key}>
									<tr>
										<td>
											<button
												type="button"
												className="training-analysis__row-toggle"
												onClick={() =>
													setExpandedKey((current) => (current === row.key ? null : row.key))
												}
											>
												{row.label}
											</button>
										</td>
										<td>{formatNumber(row.value)}</td>
									</tr>
									{expandedKey === row.key && (
										<tr>
											<td colSpan={2}>
												<Surface
													tone="container-low"
													radius="m"
													className="training-analysis__detail"
												>
													{row.entries.map((entry) => (
														<div key={entry.setId} className="training-analysis__entry">
															<span>{formatCalendarDateLabel(entry.date)}</span>
															<span>{entry.exerciseName}</span>
															<Button
																variant="text"
																onClick={() =>
																	navigate({
																		to: '/history/workout/$workoutId',
																		params: { workoutId: entry.workoutId },
																	})
																}
															>
																Open workout
															</Button>
														</div>
													))}
												</Surface>
											</td>
										</tr>
									)}
								</Fragment>
							))}
						</tbody>
					</table>
				</>
			)}
		</div>
	);
}
