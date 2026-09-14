// M3-ish labeled text field — a single-line input or multi-line textarea, replacing the
// ad hoc <label>/<input> pairs BarbellEditorScreen hand-rolled before this existed
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ChangeEvent, KeyboardEvent } from 'react';
import { classNames } from '../classNames';
import './TextField.css';

export interface TextFieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	/** Renders a <textarea> instead of a single-line <input>. */
	multiline?: boolean;
	type?: 'text' | 'number';
	min?: number;
	step?: number;
	autoFocus?: boolean;
	disabled?: boolean;
	onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export function TextField({
	label,
	value,
	onChange,
	placeholder,
	multiline = false,
	type = 'text',
	min,
	step,
	autoFocus = false,
	disabled = false,
	onKeyDown,
}: TextFieldProps) {
	function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
		onChange(event.target.value);
	}

	return (
		<label className={classNames('ui-text-field', disabled && 'ui-text-field--disabled')}>
			<span className="ui-text-field__label">{label}</span>
			{multiline ? (
				<textarea
					className="ui-text-field__control ui-text-field__control--multiline"
					value={value}
					placeholder={placeholder}
					onChange={handleChange}
					autoFocus={autoFocus}
					disabled={disabled}
					rows={3}
				/>
			) : (
				<input
					className="ui-text-field__control"
					value={value}
					placeholder={placeholder}
					onChange={handleChange}
					autoFocus={autoFocus}
					disabled={disabled}
					type={type}
					min={min}
					step={step}
					onKeyDown={onKeyDown}
				/>
			)}
		</label>
	);
}
