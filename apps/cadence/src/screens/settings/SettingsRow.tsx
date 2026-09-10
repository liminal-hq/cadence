// One list row shared by every Settings screen: icon, label, optional subtext/status, and a
// trailing chevron, switch, or other control — reused across all seven groups in the hub alone
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ReactNode } from 'react';
import { classNames } from '../../components/ui/classNames';
import './SettingsRow.css';

export interface SettingsRowProps {
	icon: string;
	label: string;
	subtext?: string;
	status?: string;
	statusTone?: 'default' | 'attention';
	/** Colours the label/icon for a destructive row, e.g. "Delete all history". */
	tone?: 'default' | 'error';
	/** A Switch or other control, replacing the default chevron. */
	trailing?: ReactNode;
	onClick?: () => void;
}

export function SettingsRow({
	icon,
	label,
	subtext,
	status,
	statusTone = 'default',
	tone = 'default',
	trailing,
	onClick,
}: SettingsRowProps) {
	const classes = classNames('settings-row', tone === 'error' && 'settings-row--error');

	const content = (
		<>
			<span className="material-symbols-rounded settings-row__icon" aria-hidden="true">
				{icon}
			</span>
			<span className="settings-row__text">
				<span className="settings-row__label">{label}</span>
				{subtext && <span className="settings-row__subtext">{subtext}</span>}
			</span>
			{status && (
				<span
					className={classNames(
						'settings-row__status',
						statusTone === 'attention' && 'settings-row__status--attention',
					)}
				>
					{status}
				</span>
			)}
			{trailing}
			{!trailing && onClick && (
				<span className="material-symbols-rounded settings-row__chevron" aria-hidden="true">
					chevron_right
				</span>
			)}
		</>
	);

	if (onClick) {
		return (
			<button type="button" className={classes} onClick={onClick}>
				{content}
			</button>
		);
	}

	return <div className={classes}>{content}</div>;
}
