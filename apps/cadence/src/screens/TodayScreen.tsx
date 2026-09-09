// Today -- the operational home of Cadence (SPEC.md section 8.1). No workout yet, so this
// renders the no-workout empty state; "Start workout" opens the Sam-default Logging scenario,
// since there's no real Workout-detail/Add-exercise screen yet to route through
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Link } from '@tanstack/react-router';
import './screens.css';

export function TodayScreen() {
	return (
		<div className="screen-empty-state">
			<h2 className="screen-empty-state__headline">No workout yet today</h2>
			<p className="screen-empty-state__body">
				A workout is created the moment you log a set, or you can start one now.
			</p>
			<Link to="/log/$scenario" params={{ scenario: 'sam-default' }} className="button-filled">
				Start workout
			</Link>
		</div>
	);
}
