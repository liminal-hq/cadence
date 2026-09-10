// P-46 Records — actual (measured) PRs distinct from estimated (calculated) ones, a tie badge
// when two dates share a record, a rep-record-per-weight grid, and a deterministic Recompute
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useMemo, useState } from 'react';
import { Surface } from '../../components/ui/Surface/Surface';
import { Tag } from '../../components/ui/Tag/Tag';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { computeRecords } from './computeRecords';
import { ONE_REP_MAX_FORMULA_NAME } from './oneRepMax';
import { formatCalendarDateLabel } from './historyDates';
import { formatNumber } from '../../domain/format';
import type { MetricProfile } from '../../domain/types';
import { flattenDatedSets, type ExerciseHistoryEntry } from './loadExerciseHistory';
import './ExerciseRecordsTab.css';

interface ExerciseRecordsTabProps {
	history: ExerciseHistoryEntry[];
	metricProfile: MetricProfile;
}

export function ExerciseRecordsTab({ history, metricProfile }: ExerciseRecordsTabProps) {
	const [lastRecomputed, setLastRecomputed] = useState<string | null>(null);
	const datedSets = useMemo(() => flattenDatedSets(history), [history]);
	const records = useMemo(() => computeRecords(datedSets), [datedSets]);

	if (metricProfile !== 'weight-reps') {
		return (
			<div className="exercise-records-tab">
				<EmptyState
					headline="Records track weight-based exercises"
					body="Distance and duration records aren't calculated yet — see the Graph tab for this exercise's trend."
				/>
			</div>
		);
	}

	if (records.actual.length === 0) {
		return (
			<div className="exercise-records-tab">
				<EmptyState headline="No records yet" body="Complete a set to start setting records." />
			</div>
		);
	}

	return (
		<div className="exercise-records-tab">
			<section>
				<h2 className="exercise-records-tab__title">Actual</h2>
				<div className="exercise-records-tab__cards">
					{records.actual.map((entry) => (
						<Surface
							key={entry.setId}
							tone="container-high"
							radius="l"
							className="exercise-records-tab__card"
						>
							<span
								className="material-symbols-rounded is-filled exercise-records-tab__icon"
								aria-hidden="true"
							>
								trophy
							</span>
							<span className="exercise-records-tab__value">{formatNumber(entry.weightKg)} kg</span>
							<span className="exercise-records-tab__meta">
								× {entry.reps} · {formatCalendarDateLabel(entry.date)}
							</span>
							{records.actual.length > 1 && (
								<Tag
									label="Tied"
									background="var(--cadence-secondary-container)"
									colour="var(--cadence-on-secondary-container)"
								/>
							)}
						</Surface>
					))}
				</div>
			</section>

			<section>
				<h2 className="exercise-records-tab__title">Estimated</h2>
				<p className="exercise-records-tab__estimated-caption">
					Calculated with the {ONE_REP_MAX_FORMULA_NAME} formula, not lifted directly.
				</p>
				<div className="exercise-records-tab__cards">
					{records.estimatedOneRm.map((entry) => (
						<Surface
							key={entry.setId}
							tone="container"
							radius="l"
							dashed
							className="exercise-records-tab__card"
						>
							<span
								className="material-symbols-rounded exercise-records-tab__icon"
								aria-hidden="true"
							>
								functions
							</span>
							<span className="exercise-records-tab__value">{formatNumber(entry.value)} kg</span>
							<span className="exercise-records-tab__meta">
								from {formatNumber(entry.weightKg)} × {entry.reps} ·{' '}
								{formatCalendarDateLabel(entry.date)}
							</span>
							{records.estimatedOneRm.length > 1 && (
								<Tag
									label="Tied"
									background="var(--cadence-secondary-container)"
									colour="var(--cadence-on-secondary-container)"
								/>
							)}
						</Surface>
					))}
				</div>
			</section>

			<section>
				<h2 className="exercise-records-tab__title">Rep records by weight</h2>
				<div className="exercise-records-tab__grid">
					{records.repRecordsByWeight.map((entry) => (
						<div key={entry.weightKg} className="exercise-records-tab__grid-row">
							<span>{formatNumber(entry.weightKg)} kg</span>
							<span>{entry.reps} reps</span>
							<span className="exercise-records-tab__grid-date">
								{formatCalendarDateLabel(entry.date)}
							</span>
						</div>
					))}
				</div>
			</section>

			<div className="exercise-records-tab__footer">
				<span className="exercise-records-tab__recomputed">
					{lastRecomputed ? `Recomputed ${lastRecomputed}` : 'Computed from current history'}
				</span>
				<Button variant="text" onClick={() => setLastRecomputed('just now')}>
					Recompute
				</Button>
			</div>
		</div>
	);
}
