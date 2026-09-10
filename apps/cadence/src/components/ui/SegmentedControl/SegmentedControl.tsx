// M3 (labs) segmented button, geometry from material-web's segmented-button token file
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import './SegmentedControl.css';

export interface SegmentedControlOption<T extends string> {
	value: T;
	label: string;
	icon?: string;
	iconFilled?: boolean;
	disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
	options: SegmentedControlOption<T>[];
	value: T;
	onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
	options,
	value,
	onChange,
}: SegmentedControlProps<T>) {
	return (
		<div className="ui-segmented-control" role="group">
			{options.map((option) => {
				const active = option.value === value;
				return (
					<button
						key={option.value}
						type="button"
						className={`ui-segmented-control__option${active ? ' ui-segmented-control__option--active' : ''}`}
						aria-current={active}
						disabled={option.disabled}
						onClick={() => onChange(option.value)}
					>
						{option.icon && (
							<span
								className={`material-symbols-rounded ui-segmented-control__icon${option.iconFilled ? ' is-filled' : ''}`}
								aria-hidden="true"
							>
								{option.icon}
							</span>
						)}
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
