// Today -- the operational home of Cadence (SPEC.md section 8.1). No
// workout yet, so this renders the no-workout empty state; starting a
// workout is not wired up yet since there's no Rust domain layer.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import './screens.css';

export function TodayScreen() {
	return (
		<div className="screen-empty-state">
			<h2 className="screen-empty-state__headline">No workout yet today</h2>
			<p className="screen-empty-state__body">
				A workout is created the moment you log a set, or you can start one now.
			</p>
			<button className="button-filled">Start workout</button>
		</div>
	);
}
