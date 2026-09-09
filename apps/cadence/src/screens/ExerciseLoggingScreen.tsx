// Placeholder for the /log/$scenario route -- just enough to make routing
// real and navigable. Replaced with the full fixed stepper-cluster P-14
// screen (SetRow, StepperCluster, RestTimerBar, DetailAppBar) next.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Link } from '@tanstack/react-router';
import type { Scenario } from '../domain/seedData';
import './screens.css';

interface ExerciseLoggingScreenProps {
	scenario: Scenario;
}

export function ExerciseLoggingScreen({ scenario }: ExerciseLoggingScreenProps) {
	return (
		<div className="screen-empty-state">
			<Link to="/today">← Back to Today</Link>
			<h2 className="screen-empty-state__headline">Exercise logging</h2>
			<p className="screen-empty-state__body">Scenario: {scenario}</p>
		</div>
	);
}
