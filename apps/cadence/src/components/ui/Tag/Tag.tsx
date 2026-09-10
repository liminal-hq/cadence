// Static, non-interactive label pill, distinct from Chip, which is always interactive
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import './Tag.css';

export interface TagProps {
	label: string;
	background: string;
	colour: string;
	icon?: string;
}

export function Tag({ label, background, colour, icon }: TagProps) {
	return (
		<span className="ui-tag" style={{ background, color: colour }}>
			{icon && (
				<span className="material-symbols-rounded ui-tag__icon" aria-hidden="true">
					{icon}
				</span>
			)}
			{label}
		</span>
	);
}
