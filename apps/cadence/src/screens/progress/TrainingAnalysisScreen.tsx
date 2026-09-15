// P-47 Training analysis — period/metric/category-or-exercise breakdown across every completed set, with drill-down back to the originating workout (SPEC.md 8.7: "selecting an analytic value reveals the originating workout and set"). Progress's default landing screen, replacing ProgressScreen.tsx's ComingSoon.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Banner } from '../../components/ui/Banner/Banner';
import { Button } from '../../components/ui/Button/Button';
import { Chip } from '../../components/ui/Chip/Chip';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { SegmentedControl } from '../../components/ui/SegmentedControl/SegmentedControl';
import { Surface } from '../../components/ui/Surface/Surface';
import { TextField } from '../../components/ui/TextField/TextField';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import { formatDurationSec, formatNumber, todayLocalDate } from '../../domain/format';
import { addDays, formatCalendarDateLabel } from '../history/historyDates';
import type { AnalysisFavourite, AnalysisSetEntry, WeightUnit } from '../../domain/types';
import {
	ANALYSIS_METRICS,
	ANALYSIS_METRIC_DEFINITIONS,
	ANALYSIS_METRIC_LABELS,
	computeBreakdown,
	countTrainingDays,
	displayMetricUnit,
	displayMetricValue,
	formatEntrySummary,
	parseAnalysisFavouriteConfig,
	serializeAnalysisFavouriteConfig,
	type AnalysisGroupBy,
	type AnalysisMetric,
	type AnalysisPeriod,
} from './computeTrainingAnalysis';
import './progress.css';

const PERIOD_OPTIONS: { value: AnalysisPeriod; label: string }[] = [
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

// A true minimum, not an arbitrary cutoff — workout dates are plain 'YYYY-MM-DD' strings compared
// lexicographically by the backend's BETWEEN, and a FitNotes import can legitimately predate 2000.
const EARLIEST_DATE = '0001-01-01';

export function dateRangeFor(
	period: AnalysisPeriod,
	today: string,
): { startDate: string; endDate: string } {
	if (period === 'all') return { startDate: EARLIEST_DATE, endDate: today };
	const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[period];
	// The backend's BETWEEN range is inclusive of both endpoints, so a window of exactly `days`
	// dates ending on `today` starts `days - 1` days earlier, not `days` days earlier.
	return { startDate: addDays(today, -(days - 1)), endDate: today };
}

function defaultFavouriteName(metric: AnalysisMetric, groupBy: AnalysisGroupBy): string {
	return `${ANALYSIS_METRIC_LABELS[metric]} by ${groupBy}`;
}

// Bare, no own AppBar — TabsLayout's shared AppShell supplies the title/top bar here, same shape as TodayScreen/RoutineListScreen.
export function TrainingAnalysisScreen() {
	const repository = useLoggingRepository();
	const navigate = useNavigate();
	const [period, setPeriod] = useState<AnalysisPeriod>('30d');
	const [metric, setMetric] = useState<AnalysisMetric>('volume');
	const [groupBy, setGroupBy] = useState<AnalysisGroupBy>('category');
	const [entries, setEntries] = useState<AnalysisSetEntry[] | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [retryToken, setRetryToken] = useState(0);
	const [expandedKey, setExpandedKey] = useState<string | null>(null);
	const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
	const [favourites, setFavourites] = useState<AnalysisFavourite[]>([]);
	const [pinDraftName, setPinDraftName] = useState<string | null>(null);
	const [favouriteError, setFavouriteError] = useState<string | null>(null);

	const today = useMemo(() => todayLocalDate(), []);
	const { startDate, endDate } = useMemo(() => dateRangeFor(period, today), [period, today]);

	useEffect(() => {
		let cancelled = false;
		// Deliberately doesn't clear `entries` here — the previous range's breakdown stays on screen
		// (filters, pin button, and all) until the new one resolves, matching WorkoutHistoryList's
		// same "refetch from backend on a range change" shape rather than blanking the whole screen
		// on every period tap.
		setLoadError(null);
		Promise.all([repository.getSettings(), repository.listAnalysisSets(startDate, endDate)]).then(
			([settings, result]) => {
				if (cancelled) return;
				setWeightUnit(settings.weightUnit);
				setEntries(result);
			},
			(err) => {
				if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
			},
		);
		return () => {
			cancelled = true;
		};
	}, [repository, startDate, endDate, retryToken]);

	useEffect(() => {
		let cancelled = false;
		repository.listAnalysisFavourites().then(
			(all) => {
				if (!cancelled) setFavourites(all);
			},
			(err) => {
				if (!cancelled) setFavouriteError(err instanceof Error ? err.message : String(err));
			},
		);
		return () => {
			cancelled = true;
		};
	}, [repository]);

	function applyFavourite(favourite: AnalysisFavourite) {
		const config = parseAnalysisFavouriteConfig(favourite.config);
		if (!config) return;
		setPeriod(config.period);
		setMetric(config.metric);
		setGroupBy(config.groupBy);
	}

	async function handlePin() {
		if (!pinDraftName?.trim()) return;
		try {
			setFavouriteError(null);
			const config = serializeAnalysisFavouriteConfig({ period, metric, groupBy });
			const created = await repository.createAnalysisFavourite(pinDraftName.trim(), config);
			setFavourites((current) => [...current, created]);
			setPinDraftName(null);
		} catch (err) {
			setFavouriteError(err instanceof Error ? err.message : String(err));
		}
	}

	async function handleUnpin(id: string) {
		try {
			setFavouriteError(null);
			await repository.deleteAnalysisFavourite(id);
			setFavourites((current) => current.filter((f) => f.id !== id));
		} catch (err) {
			setFavouriteError(err instanceof Error ? err.message : String(err));
		}
	}

	if (loadError) {
		return (
			<div className="training-analysis">
				<EmptyState
					headline="Couldn't load this breakdown"
					body={loadError}
					action={
						<Button variant="filled" onClick={() => setRetryToken((t) => t + 1)}>
							Try again
						</Button>
					}
				/>
			</div>
		);
	}

	if (!entries) return null;

	const rows = computeBreakdown(entries, metric, groupBy);
	const unit = displayMetricUnit(metric, weightUnit);

	return (
		<div className="training-analysis">
			{favouriteError && (
				<Banner
					icon="error"
					message={favouriteError}
					tone="attention"
					onDismiss={() => setFavouriteError(null)}
				/>
			)}

			{favourites.length > 0 && (
				<div className="training-analysis__filters">
					{favourites.map((favourite) => (
						<Chip
							key={favourite.id}
							variant="input"
							label={favourite.name}
							onClick={() => applyFavourite(favourite)}
							onRemove={() => handleUnpin(favourite.id)}
						/>
					))}
				</div>
			)}

			{pinDraftName == null ? (
				<Button
					variant="text"
					icon="push_pin"
					onClick={() => setPinDraftName(defaultFavouriteName(metric, groupBy))}
				>
					Pin this view
				</Button>
			) : (
				<Surface tone="container-low" radius="m" className="training-analysis__pin-form">
					<TextField
						label="Favourite name"
						value={pinDraftName}
						onChange={setPinDraftName}
						autoFocus
					/>
					<div className="training-analysis__pin-form-actions">
						<Button variant="text" onClick={() => setPinDraftName(null)}>
							Cancel
						</Button>
						<Button variant="filled" disabled={!pinDraftName.trim()} onClick={handlePin}>
							Save
						</Button>
					</div>
				</Surface>
			)}

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
									{unit && metric !== 'duration' ? ` (${unit})` : ''}
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
										<td>
											{metric === 'duration'
												? formatDurationSec(row.value)
												: formatNumber(displayMetricValue(row.value, metric, weightUnit))}
										</td>
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
															<span>
																{formatCalendarDateLabel(entry.date)} · Set {entry.setOrder}
															</span>
															<span>{entry.exerciseName}</span>
															<span>{formatEntrySummary(entry, weightUnit)}</span>
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
