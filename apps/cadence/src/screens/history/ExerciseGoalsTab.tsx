// The Goals tab stays visible per the design's "so nothing unlocks later" intent, even though
// P-48 Exercise goals is Planned scope and not built here
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import './ExerciseGoalsTab.css';

export function ExerciseGoalsTab() {
	return (
		<div className="exercise-goals-tab">
			<EmptyState
				headline="Goals aren't available yet"
				body="Setting a target for this exercise is planned for a future release."
			/>
		</div>
	);
}
