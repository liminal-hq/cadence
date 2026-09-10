// Numbered preview badge marking an upcoming coach mark target, before its step is reached --
// requires a `position: relative` parent, per Logging.dc.html's Priya canvas.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import './CoachMarkTooltip.css';

interface CoachMarkBadgeProps {
	step: number;
}

export function CoachMarkBadge({ step }: CoachMarkBadgeProps) {
	return (
		<span className="coach-mark-badge" aria-hidden="true">
			{step}
		</span>
	);
}
