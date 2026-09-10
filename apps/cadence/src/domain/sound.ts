// A short rising two-note chime for the rest timer elapsing, via undertone (Liminal HQ's
// procedural synth engine) rather than a bundled audio asset
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { note, stack } from '@liminal-hq/undertone';

const restElapsedChime = stack(
	note('a5').sound('sine').attack(0.001).decay(0.18).sustain(0).release(0.05).gain(0.35),
	note('d6')
		.sound('sine')
		.attack(0.001)
		.decay(0.22)
		.sustain(0)
		.release(0.08)
		.gain(0.35)
		.nudge(0.14),
);

export function playRestElapsedChime(): void {
	if (typeof window === 'undefined' || !window.AudioContext) return;
	restElapsedChime.play();
}
