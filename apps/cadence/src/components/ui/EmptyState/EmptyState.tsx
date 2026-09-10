// Centred headline/body/optional-action block for a screen with nothing in it yet.
// Promoted from screens.css's screen-empty-state classes, used by TodayScreen/ComingSoon.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ReactNode } from 'react';
import './EmptyState.css';

export interface EmptyStateProps {
	headline: string;
	body: string;
	action?: ReactNode;
	children?: ReactNode;
}

export function EmptyState({ headline, body, action, children }: EmptyStateProps) {
	return (
		<div className="ui-empty-state">
			<h2 className="ui-empty-state__headline">{headline}</h2>
			<p className="ui-empty-state__body">{body}</p>
			{action}
			{children}
		</div>
	);
}
