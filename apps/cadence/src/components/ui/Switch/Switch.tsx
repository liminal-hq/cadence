// M3 Switch, geometry from material-web's switch token file, always showing a checkmark on the selected thumb
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import './Switch.css';

export interface SwitchProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	label?: string;
}

export function Switch({ checked, onChange, disabled = false, label }: SwitchProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			disabled={disabled}
			className={`ui-switch${checked ? ' ui-switch--checked' : ''}`}
			onClick={() => onChange(!checked)}
		>
			<span className="ui-switch__handle">
				{checked && (
					<span className="material-symbols-rounded ui-switch__icon is-filled" aria-hidden="true">
						check
					</span>
				)}
			</span>
		</button>
	);
}
