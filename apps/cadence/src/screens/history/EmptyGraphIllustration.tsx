// The Priya (beginner, single-set) empty-graph state — one real point, a ghost next-point, and
// a crossed-out trend line, faithful to the design canvas rather than a generic empty state
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import './EmptyGraphIllustration.css';

export function EmptyGraphIllustration() {
	return (
		<div className="empty-graph">
			<svg
				className="empty-graph__svg"
				viewBox="0 0 200 100"
				role="img"
				aria-label="An illustration of a single logged point, with a faint outline showing where a second point would appear"
			>
				<line
					className="empty-graph__trend"
					x1="40"
					y1="70"
					x2="160"
					y2="30"
					strokeDasharray="4 4"
				/>
				<line className="empty-graph__cross" x1="30" y1="80" x2="170" y2="20" />
				<circle className="empty-graph__point" cx="40" cy="70" r="6" />
				<circle className="empty-graph__ghost" cx="160" cy="30" r="6" />
			</svg>
			<p className="empty-graph__headline">One set so far</p>
			<p className="empty-graph__body">Graphs and records start with your second workout.</p>
		</div>
	);
}
