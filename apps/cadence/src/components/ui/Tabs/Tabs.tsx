// M3 primary tabs, geometry from material-web's primary-tab token file, with roving-tabindex keyboard navigation
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useRef, type KeyboardEvent } from 'react';
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
	const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

	function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
		if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
		event.preventDefault();
		const delta = event.key === 'ArrowRight' ? 1 : -1;
		const nextIndex = (index + delta + options.length) % options.length;
		onChange(options[nextIndex].value);
		// Moves DOM focus with the selection — onChange only updates the controlled value, and
		// the previously-focused tab becomes tabIndex={-1} on rerender, so without this arrow
		// keys would only ever move focus one step before it got stranded on an unfocusable tab.
		buttonRefs.current[nextIndex]?.focus();
	}

	return (
		<div className="ui-tabs" role="tablist">
			{options.map((option, index) => {
				const active = option.value === value;
				return (
					<button
						key={option.value}
						ref={(el) => {
							buttonRefs.current[index] = el;
						}}
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
