// Platform classification shared by the title bar and the app shell.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { platform } from '@tauri-apps/plugin-os';

export type PlatformType = 'mac' | 'win' | 'linux' | 'android' | 'ios';

export function resolvePlatform(): { platformType: PlatformType; isDesktop: boolean } {
	const os = platform();

	if (os === 'macos') return { platformType: 'mac', isDesktop: true };
	if (os === 'windows') return { platformType: 'win', isDesktop: true };
	if (os === 'linux') return { platformType: 'linux', isDesktop: true };
	if (os === 'ios') return { platformType: 'ios', isDesktop: false };

	return { platformType: 'android', isDesktop: false };
}
