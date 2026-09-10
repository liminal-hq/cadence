// P-45 Exercise graph — metric/point selection, a hand-built SVG chart with a real <table>
// accessible alternative (SPEC.md 8.7: "chart accessible summary/table alternative"), and
// Priya's single-set illustration state faithfully reproduced rather than a generic empty state
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { SegmentedControl } from '../../components/ui/SegmentedControl/SegmentedControl';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { LineChart } from './LineChart';
import { EmptyGraphIllustration } from './EmptyGraphIllustration';
import { computeGraphPoints, type GraphMetric, type GraphPoint } from './computeGraphPoints';
import { ONE_REP_MAX_FORMULA_NAME } from './oneRepMax';
import { formatCalendarDateLabel } from './historyDates';
import { formatNumber } from '../../domain/format';
import type { Exercise } from '../../domain/types';
import { flattenDatedSets, type ExerciseHistoryEntry } from './loadExerciseHistory';
import './ExerciseGraphTab.css';

interface ExerciseGraphTabProps {
	exercise: Exercise;
	history: ExerciseHistoryEntry[];
}

const WEIGHT_REPS_METRICS: { value: GraphMetric; label: string }[] = [
	{ value: 'weight', label: 'Weight' },
	{ value: 'estimated-1rm', label: 'Est. 1RM' },
	{ value: 'volume', label: 'Volume' },
];

const DISTANCE_DURATION_METRICS: { value: GraphMetric; label: string }[] = [
	{ value: 'distance', label: 'Distance' },
	{ value: 'pace', label: 'Pace' },
];

function metricUnit(metric: GraphMetric): string {
	switch (metric) {
		case 'weight':
		case 'estimated-1rm':
			return 'kg';
		case 'volume':
			return 'kg';
		case 'distance':
			return 'km';
		case 'pace':
			return 'sec/km';
	}
}

function findEntry(history: ExerciseHistoryEntry[], setId: string) {
	for (const entry of history) {
		const set = entry.sets.find((s) => s.id === setId);
		if (set) return { entry, set };
	}
	return undefined;
}

export function ExerciseGraphTab({ exercise, history }: ExerciseGraphTabProps) {
	const navigate = useNavigate();
	const metricOptions =
		exercise.metricProfile === 'weight-reps' ? WEIGHT_REPS_METRICS : DISTANCE_DURATION_METRICS;
	const [metric, setMetric] = useState<GraphMetric>(metricOptions[0].value);
	const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
	const [showTable, setShowTable] = useState(false);
	const [saved, setSaved] = useState(false);

	const datedSets = useMemo(() => flattenDatedSets(history), [history]);
	const points = useMemo(() => computeGraphPoints(datedSets, metric), [datedSets, metric]);

	if (points.length === 0) {
		return (
			<div className="exercise-graph-tab">
				<EmptyState
					headline="No data yet"
					body="Completed sets for this exercise will chart here."
				/>
			</div>
		);
	}

	if (points.length === 1) {
		return (
			<div className="exercise-graph-tab">
				<EmptyGraphIllustration />
			</div>
		);
	}

	const selected = points.find((p) => p.setId === selectedSetId) ?? points[points.length - 1];
	const found = findEntry(history, selected.setId);

	return (
		<div className="exercise-graph-tab">
			<SegmentedControl options={metricOptions} value={metric} onChange={setMetric} />

			<LineChart
				points={points}
				selectedSetId={selected.setId}
				onSelectPoint={(p: GraphPoint) => setSelectedSetId(p.setId)}
			/>

			{found && (
				<div className="exercise-graph-tab__detail">
					<p className="exercise-graph-tab__detail-line">
						{formatCalendarDateLabel(selected.date)} ·{' '}
						{exercise.metricProfile === 'weight-reps'
							? `${formatNumber(selected.weightKg ?? 0)} kg × ${selected.reps ?? 0}`
							: `${formatNumber(selected.distanceKm ?? 0)} km`}
						{metric === 'estimated-1rm' && (
							<span className="exercise-graph-tab__formula">
								{' '}
								· est. 1RM {formatNumber(selected.value)} kg ({ONE_REP_MAX_FORMULA_NAME})
							</span>
						)}
					</p>
					<Button
						variant="text"
						onClick={() =>
							navigate({
								to: '/history/workout/$workoutId',
								params: { workoutId: found.entry.workout.id },
							})
						}
					>
						Open set
					</Button>
				</div>
			)}

			<p className="exercise-graph-tab__caption">
				Completed sets only · gaps shown as gaps · values in {metricUnit(metric)}
			</p>

			<div className="exercise-graph-tab__footer">
				<Button variant="text" onClick={() => setShowTable((v) => !v)}>
					{showTable ? 'Hide table' : 'View as table'}
				</Button>
				<Button
					variant="text"
					icon={saved ? 'bookmark' : 'bookmark_border'}
					onClick={() => setSaved((v) => !v)}
				>
					{saved ? 'Saved' : 'Save this view'}
				</Button>
			</div>

			{showTable && (
				<table className="exercise-graph-tab__table">
					<caption className="ui-visually-hidden">
						{exercise.name} — {metricOptions.find((m) => m.value === metric)?.label} over time
					</caption>
					<thead>
						<tr>
							<th scope="col">Date</th>
							<th scope="col">Value ({metricUnit(metric)})</th>
						</tr>
					</thead>
					<tbody>
						{points.map((point) => (
							<tr key={point.setId}>
								<td>{formatCalendarDateLabel(point.date)}</td>
								<td>{formatNumber(point.value)}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}
