// M3 bottom navigation bar — the four primary Cadence destinations
// (SPEC.md section 7). Shared verbatim between desktop and mobile.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import './BottomNav.css';

export type Destination = 'today' | 'history' | 'plan' | 'progress';

const DESTINATIONS: { id: Destination; label: string; icon: string }[] = [
	{ id: 'today', label: 'Today', icon: 'today' },
	{ id: 'history', label: 'History', icon: 'history' },
	{ id: 'plan', label: 'Plan', icon: 'list_alt' },
	{ id: 'progress', label: 'Progress', icon: 'monitoring' },
];

interface BottomNavProps {
	active: Destination;
	onChange: (destination: Destination) => void;
}

export function BottomNav({ active, onChange }: BottomNavProps) {
	return (
		<nav className="bottom-nav">
			{DESTINATIONS.map((destination) => {
				const isActive = destination.id === active;
				return (
					<button
						key={destination.id}
						className="bottom-nav__item"
						aria-current={isActive ? 'page' : undefined}
						onClick={() => onChange(destination.id)}
					>
						<span className={`bottom-nav__pill ${isActive ? 'is-active' : ''}`} aria-hidden="true">
							<span className={`material-symbols-rounded ${isActive ? 'is-filled' : ''}`}>
								{destination.icon}
							</span>
						</span>
						<span className={`bottom-nav__label ${isActive ? 'is-active' : ''}`}>
							{destination.label}
						</span>
					</button>
				);
			})}
		</nav>
	);
}
