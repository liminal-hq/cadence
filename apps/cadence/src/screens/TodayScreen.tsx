// Today — the operational home of Cadence (SPEC.md section 8.1). The two smaller preview
// links are temporary scaffolding to reach the other demo scenarios until a real workout
// list exists to launch them from naturally.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Link } from '@tanstack/react-router';
import { EmptyState } from '../components/ui/EmptyState/EmptyState';
import './screens.css';

export function TodayScreen() {
	return (
		<EmptyState
			headline="No workout yet today"
			body="A workout is created the moment you log a set, or you can start one now."
			action={
				<Link to="/log/$scenario" params={{ scenario: 'sam-default' }} className="button-filled">
					Start workout
				</Link>
			}
		>
			<div className="screen-empty-state__preview-links">
				<Link to="/log/$scenario" params={{ scenario: 'sam-superset-dark' }}>
					Preview: offline superset
				</Link>
				<Link to="/log/$scenario" params={{ scenario: 'priya-first-run' }}>
					Preview: first workout
				</Link>
			</div>
		</EmptyState>
	);
}
