// One labelled number — shared by WorkoutDetailScreen's summary row (P-43) and the Stats tab
// (P-44), so the two don't each hand-roll the same value/label column
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import './StatTile.css';

export interface StatTileProps {
	value: string;
	label: string;
}

export function StatTile({ value, label }: StatTileProps) {
	return (
		<div className="stat-tile">
			<span className="stat-tile__value">{value}</span>
			<span className="stat-tile__label">{label}</span>
		</div>
	);
}
