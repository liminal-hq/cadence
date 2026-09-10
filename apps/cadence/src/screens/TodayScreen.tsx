// Today -- the operational home of Cadence (SPEC.md section 8.1). The two smaller preview
// links are temporary scaffolding to reach the other demo scenarios until a real workout
// list exists to launch them from naturally.
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
			<div className="screen-empty-state__preview-links">
				<Link to="/log/$scenario" params={{ scenario: 'sam-superset-dark' }}>
					Preview: offline superset
				</Link>
				<Link to="/log/$scenario" params={{ scenario: 'priya-first-run' }}>
					Preview: first workout
				</Link>
			</div>
		</div>
	);
}
