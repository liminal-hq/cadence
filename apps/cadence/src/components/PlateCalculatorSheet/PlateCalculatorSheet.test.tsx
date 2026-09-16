// Regression coverage for the plate calculator crashing on a null nearestLower/nearestHigher
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { PlateCalculatorSheet } from './PlateCalculatorSheet';
import { RepositoryProvider } from '../../domain/RepositoryProvider';
import { MockLoggingRepository } from '../../domain/mockRepository';
import type { BarbellConfig, PlateCalculationResult } from '../../domain/types';

// Rust's `Option<f64>` fields (nearestLower/nearestHigher) serialize to JSON `null` over Tauri's IPC, not `undefined` — even though the ts-rs-generated TypeScript type says `nearestLower?: number`. The mock repository is "too honest" and returns real `undefined`, which is exactly why this never showed up in a JS unit test before; this test stubs the repository response the way the real backend actually behaves.

const BARBELL: BarbellConfig = {
	id: 'barbell-olympic',
	name: 'Olympic',
	barWeight: 20,
	displayUnit: 'kg',
	availablePlates: [1.25, 2.5, 5, 10, 20],
	isDefault: true,
};

class NullResolutionRepository extends MockLoggingRepository {
	async listBarbellConfigs(): Promise<BarbellConfig[]> {
		return [BARBELL];
	}

	async calculatePlates(): Promise<PlateCalculationResult> {
		// The real Tauri IPC shape for "no lower resolution exists" -- a target below the bar's
		// own weight has nothing smaller to fall back to.
		return {
			loadable: false,
			targetWeight: 2.5,
			perSidePlates: [],
			perSideTotal: 0,
			achievedTotal: 20,
			nearestLower: null as unknown as undefined,
			nearestHigher: 20,
			shortfall: -8.75,
			smallestPlate: 1.25,
		};
	}
}

describe('PlateCalculatorSheet', () => {
	it('renders a null nearestLower/nearestHigher as "—" instead of crashing', async () => {
		render(
			<RepositoryProvider repository={new NullResolutionRepository()}>
				<PlateCalculatorSheet targetWeightKg={2.5} onClose={() => {}} />
			</RepositoryProvider>,
		);
		await act(async () => {});

		expect(screen.getByText('—')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Use 20' })).toBeInTheDocument();
	});
});
