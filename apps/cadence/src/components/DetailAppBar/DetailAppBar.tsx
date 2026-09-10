// Back arrow, exercise title + category tag, subtitle, and history/overflow actions -- the
// exercise-detail pattern SPEC.md section 7 calls for reuse of across Logging, History, Progress
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { Link } from '@tanstack/react-router';
import { CATEGORY_COLOURS, DEFAULT_CATEGORY_COLOUR } from '../../data/categoryColours';
import './DetailAppBar.css';

interface DetailAppBarProps {
	title: string;
	category: string;
	subtitle?: string;
	onOverflow?: () => void;
}

export function DetailAppBar({ title, category, subtitle, onOverflow }: DetailAppBarProps) {
	const colour = CATEGORY_COLOURS[category] ?? DEFAULT_CATEGORY_COLOUR;

	return (
		<header className="detail-app-bar">
			<Link to="/today" className="detail-app-bar__back" aria-label="Back">
				<span className="material-symbols-rounded">arrow_back</span>
			</Link>
			<div className="detail-app-bar__titles">
				<div className="detail-app-bar__title-row">
					<span className="detail-app-bar__title">{title}</span>
					<span
						className="detail-app-bar__category"
						style={{ background: colour.background, color: colour.text }}
					>
						{category}
					</span>
				</div>
				{subtitle && <span className="detail-app-bar__subtitle">{subtitle}</span>}
			</div>
			<button className="detail-app-bar__action" aria-label="History">
				<span className="material-symbols-rounded">monitoring</span>
			</button>
			<button className="detail-app-bar__action" aria-label="More" onClick={onOverflow}>
				<span className="material-symbols-rounded">more_vert</span>
			</button>
		</header>
	);
}
