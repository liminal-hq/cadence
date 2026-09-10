// Static, non-interactive label pill — distinct from Chip, which is always interactive.
// Consolidates DetailAppBar's category pill and RestTimerSheet's watch/phone badge.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import './Tag.css';

export interface TagProps {
	label: string;
	background: string;
	color: string;
	icon?: string;
}

export function Tag({ label, background, color, icon }: TagProps) {
	return (
		<span className="ui-tag" style={{ background, color }}>
			{icon && (
				<span className="material-symbols-rounded ui-tag__icon" aria-hidden="true">
					{icon}
				</span>
			)}
			{label}
		</span>
	);
}
