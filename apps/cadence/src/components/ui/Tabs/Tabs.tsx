// M3 primary tabs — geometry from material-web's _md-comp-primary-navigation-tab.scss.
// A real role="tablist"/"tab" pair with roving tabindex, so arrow-key navigation between
// tabs works the way a native M3 tab strip does.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { KeyboardEvent } from 'react';
import './Tabs.css';

export interface TabsOption<T extends string> {
	value: T;
	label: string;
}

export interface TabsProps<T extends string> {
	options: TabsOption<T>[];
	value: T;
	onChange: (value: T) => void;
}

export function Tabs<T extends string>({ options, value, onChange }: TabsProps<T>) {
	const activeIndex = options.findIndex((o) => o.value === value);

	function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
		if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
		event.preventDefault();
		const delta = event.key === 'ArrowRight' ? 1 : -1;
		const next = options[(index + delta + options.length) % options.length];
		onChange(next.value);
	}

	return (
		<div className="ui-tabs" role="tablist">
			{options.map((option, index) => {
				const active = option.value === value;
				return (
					<button
						key={option.value}
						type="button"
						role="tab"
						aria-selected={active}
						tabIndex={index === activeIndex ? 0 : -1}
						className={`ui-tabs__tab${active ? ' ui-tabs__tab--active' : ''}`}
						onClick={() => onChange(option.value)}
						onKeyDown={(event) => handleKeyDown(event, index)}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
