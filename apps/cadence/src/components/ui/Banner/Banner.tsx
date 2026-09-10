// Icon + message + optional action/dismiss, tinted container — consolidates the offline
// banner, the notifications-denied warning, the draft-restored banner, and the Health
// Connect/Settings banners, which all independently converged on this same shape.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { IconButton } from '../IconButton/IconButton';
import './Banner.css';

export interface BannerProps {
	icon: string;
	message: string;
	tone?: 'attention' | 'primary';
	action?: { label: string; onClick: () => void };
	onDismiss?: () => void;
}

export function Banner({ icon, message, tone = 'attention', action, onDismiss }: BannerProps) {
	return (
		<div className={`ui-banner ui-banner--${tone}`}>
			<span className="material-symbols-rounded ui-banner__icon" aria-hidden="true">
				{icon}
			</span>
			<p className="ui-banner__message">{message}</p>
			{action && (
				<button type="button" className="ui-banner__action" onClick={action.onClick}>
					{action.label}
				</button>
			)}
			{onDismiss && (
				<IconButton icon="close" label="Dismiss" size="small" onClick={onDismiss} />
			)}
		</div>
	);
}
