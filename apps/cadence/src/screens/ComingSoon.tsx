// Placeholder body for the three destinations that don't have a real
// screen yet -- proves the bottom nav is fully wired without pretending
// there's a finished screen behind it.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import './screens.css';

interface ComingSoonProps {
	screen: string;
}

export function ComingSoon({ screen }: ComingSoonProps) {
	return (
		<div className="screen-empty-state">
			<h2 className="screen-empty-state__headline">{screen} is coming soon</h2>
			<p className="screen-empty-state__body">
				This destination is wired into the navigation but doesn&apos;t have a screen yet.
			</p>
		</div>
	);
}
