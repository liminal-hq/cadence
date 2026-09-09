// Grouped section of items within the context menu
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { MenuSection as MenuSectionType, MenuItem as MenuItemType } from './types';
import { MenuItem } from './MenuItem';

interface MenuSectionProps {
	section: MenuSectionType;
	onItemClick: (itemId: string, action?: () => void) => void;
}

export function MenuSection({ section, onItemClick }: MenuSectionProps) {
	return (
		<div className="menu-section">
			{section.title && <div className="menu-section-title">{section.title}</div>}
			{section.items.map((item, idx) => {
				if ('type' in item && item.type === 'separator') {
					return <div key={idx} className="menu-separator" />;
				}

				const menuItem = item as MenuItemType;
				return <MenuItem key={menuItem.id} item={menuItem} onItemClick={onItemClick} />;
			})}
		</div>
	);
}
