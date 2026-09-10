// Back arrow, exercise title + category tag, subtitle, and actions — the exercise-detail
// pattern SPEC.md section 7 calls for reuse of across Logging, History, Progress. A thin,
// size="medium" configuration of the shared AppBar primitive.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { AppBar, type AppBarAction } from '../ui/AppBar/AppBar';
import { CATEGORY_COLOURS, DEFAULT_CATEGORY_COLOUR } from '../../data/categoryColours';

interface DetailAppBarProps {
	title: string;
	category: string;
	subtitle?: string;
	/** Required, no default — every screen that reuses this must be explicit about where back goes. */
	backTo: string;
	actions?: AppBarAction[];
}

export function DetailAppBar({ title, category, subtitle, backTo, actions }: DetailAppBarProps) {
	const colour = CATEGORY_COLOURS[category] ?? DEFAULT_CATEGORY_COLOUR;

	return (
		<AppBar
			title={title}
			subtitle={subtitle}
			size="medium"
			back={{ to: backTo }}
			tag={{ label: category, background: colour.background, color: colour.text }}
			actions={actions}
		/>
	);
}
