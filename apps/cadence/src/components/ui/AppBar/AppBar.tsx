// Shared app-bar shell that TopAppBar and DetailAppBar both configure, replacing two independently-hardcoded headers
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

// The two sizes keep their original, different title/subtitle layouts (large: title and
// subtitle share one baseline row; medium: subtitle stacks on its own line below the title
// row) so adopting this primitive doesn't change either screen's appearance.

import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { IconButton } from '../IconButton/IconButton';
import { Tag, type TagProps } from '../Tag/Tag';
import './AppBar.css';

export interface AppBarAction {
	icon: string;
	label: string;
	onClick?: () => void;
	active?: boolean;
}

export type AppBarBack = { label?: string; icon?: string } & (
	{ to: string } | { onClick: () => void }
);

export interface AppBarProps {
	title: string;
	subtitle?: string;
	/** 'large' = tab-root scale, no leading element (TopAppBar). 'medium' = detail scale, expects `back` (DetailAppBar). */
	size?: 'large' | 'medium';
	/** `{ to }` navigates via the router (routed screens); `{ onClick }` just dismisses (an
	 *  overlay with nowhere to navigate to, e.g. SetNoteScreen). */
	back?: AppBarBack;
	tag?: TagProps;
	actions?: AppBarAction[];
	trailingContent?: ReactNode;
}

export function AppBar({
	title,
	subtitle,
	size = 'large',
	back,
	tag,
	actions,
	trailingContent,
}: AppBarProps) {
	return (
		<header className={`ui-app-bar ui-app-bar--${size}`}>
			{back &&
				('to' in back ? (
					<Link to={back.to} className="ui-app-bar__back" aria-label={back.label ?? 'Back'}>
						<span className="material-symbols-rounded" aria-hidden="true">
							{back.icon ?? 'arrow_back'}
						</span>
					</Link>
				) : (
					<button
						type="button"
						className="ui-app-bar__back"
						aria-label={back.label ?? 'Back'}
						onClick={back.onClick}
					>
						<span className="material-symbols-rounded" aria-hidden="true">
							{back.icon ?? 'arrow_back'}
						</span>
					</button>
				))}
			{size === 'large' ? (
				<div className="ui-app-bar__title">
					{title}
					{subtitle && <span className="ui-app-bar__subtitle">{subtitle}</span>}
				</div>
			) : (
				<div className="ui-app-bar__titles">
					<div className="ui-app-bar__title-row">
						<span className="ui-app-bar__title">{title}</span>
						{tag && <Tag {...tag} />}
					</div>
					{subtitle && <span className="ui-app-bar__subtitle">{subtitle}</span>}
				</div>
			)}
			{actions?.map((action) => (
				<IconButton
					key={action.label}
					icon={action.icon}
					label={action.label}
					variant={action.active ? 'tonal' : 'standard'}
					size="large"
					onClick={action.onClick}
				/>
			))}
			{trailingContent}
		</header>
	);
}
