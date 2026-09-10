// Placeholder body for the three destinations that don't have a real
// screen yet — proves the bottom nav is fully wired without pretending
// there's a finished screen behind it.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { EmptyState } from '../components/ui/EmptyState/EmptyState';

interface ComingSoonProps {
	screen: string;
}

export function ComingSoon({ screen }: ComingSoonProps) {
	return (
		<EmptyState
			headline={`${screen} is coming soon`}
			body="This destination is wired into the navigation but doesn't have a screen yet."
		/>
	);
}
