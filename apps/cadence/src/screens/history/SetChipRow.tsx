// One exercise's completed sets as a row of compact chips — shared by WorkoutDetailScreen (P-43)
// and the exercise detail History tab (P-44), which both need the exact same visual language
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { MetricProfile, SetEntry } from '../../domain/types';
import { formatNumber } from '../../domain/format';
import './SetChipRow.css';

interface SetChipRowProps {
	/** Omit when the surrounding context already identifies the exercise (e.g. every card on
	 *  the exercise's own detail page) — showing its own name on every row there is redundant. */
	exerciseName?: string;
	metricProfile: MetricProfile;
	archived?: boolean;
	sets: SetEntry[];
}

export function SetChipRow({ exerciseName, metricProfile, archived, sets }: SetChipRowProps) {
	const completed = sets.filter((s) => s.status === 'completed');

	return (
		<div className="set-chip-row">
			{exerciseName && (
				<span
					className={
						archived ? 'set-chip-row__name set-chip-row__name--archived' : 'set-chip-row__name'
					}
				>
					{exerciseName}
				</span>
			)}
			<div className="set-chip-row__chips">
				{completed.map((set) => (
					<span key={set.id} className="set-chip-row__chip">
						{metricProfile === 'weight-reps'
							? `${formatNumber(set.weightKg ?? 0)} × ${set.reps ?? 0}`
							: `${formatNumber(set.distanceKm ?? 0)} km`}
						{set.isRecord && (
							<span
								className="material-symbols-rounded is-filled set-chip-row__trophy"
								aria-label="Personal record"
							>
								trophy
							</span>
						)}
					</span>
				))}
				{completed.length === 0 && (
					<span className="set-chip-row__chip set-chip-row__chip--planned">
						Planned, not yet logged
					</span>
				)}
			</div>
		</div>
	);
}
