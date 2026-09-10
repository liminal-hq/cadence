// Joins class names, dropping any falsy value — shared by primitives that previously each
// hand-rolled their own `[...].filter(Boolean).join(' ')`
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

export function classNames(...values: Array<string | false | null | undefined>): string {
	return values.filter(Boolean).join(' ');
}
