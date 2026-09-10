// Plate calculator, opened from the Set editor's "Plates" chip. Loadable-exactly and
// not-loadable-with-two-resolutions states share one component, driven by the repository's
// calculatePlates
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { BottomSheet } from '../BottomSheet/BottomSheet';
import { Button } from '../ui/Button/Button';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import { formatNumber, kgToLb, lbToKg } from '../../domain/format';
import type { BarbellConfig, PlateCalculationResult } from '../../domain/types';
import { plateStyle } from './plateColours';
import './PlateCalculatorSheet.css';

interface PlateCalculatorSheetProps {
	targetWeightKg: number;
	onClose: () => void;
	onUseTotal?: (weightKg: number) => void;
}

function BarSide({ barbell, plates }: { barbell: BarbellConfig; plates: number[] }) {
	return (
		<div className="plate-calculator-sheet__side">
			{plates.map((plate, i) => {
				const style = plateStyle(barbell.displayUnit, plate);
				return (
					<div key={i} className="plate-calculator-sheet__plate-column">
						<div
							className="plate-calculator-sheet__plate"
							style={{
								background: style.background,
								color: style.textColour,
								height: style.heightPx,
								width: style.widthPx,
							}}
						/>
						<span className="plate-calculator-sheet__plate-label">{formatNumber(plate)}</span>
					</div>
				);
			})}
		</div>
	);
}

export function PlateCalculatorSheet({
	targetWeightKg,
	onClose,
	onUseTotal,
}: PlateCalculatorSheetProps) {
	const repository = useLoggingRepository();
	const [barbells, setBarbells] = useState<BarbellConfig[]>([]);
	const [barbellIndex, setBarbellIndex] = useState(0);
	const [result, setResult] = useState<PlateCalculationResult | null>(null);

	useEffect(() => {
		repository.listBarbellConfigs().then(setBarbells);
	}, [repository]);

	const barbell = barbells[barbellIndex];
	const targetInUnit = barbell
		? barbell.displayUnit === 'kg'
			? targetWeightKg
			: kgToLb(targetWeightKg)
		: 0;

	useEffect(() => {
		if (!barbell) return;
		repository.calculatePlates(targetInUnit, barbell).then(setResult);
	}, [repository, barbell, targetInUnit]);

	if (!barbell || !result) return null;

	const toKg = (valueInUnit: number) =>
		barbell.displayUnit === 'kg' ? valueInUnit : lbToKg(valueInUnit);

	const useTotal = (totalInUnit: number) => {
		onUseTotal?.(toKg(totalInUnit));
		onClose();
	};

	const perSideTarget = (targetInUnit - barbell.barWeight) / 2;

	return (
		<BottomSheet onClose={onClose} ariaLabel="Plate calculator">
			<div className="plate-calculator-sheet">
				<div className="plate-calculator-sheet__header">
					<span className="plate-calculator-sheet__title">
						Plates for {formatNumber(targetInUnit)} {barbell.displayUnit}
					</span>
					<button
						type="button"
						className="plate-calculator-sheet__barbell"
						onClick={() => setBarbellIndex((i) => (i + 1) % barbells.length)}
					>
						{barbell.name} · {barbell.barWeight} {barbell.displayUnit}
						<span className="material-symbols-rounded">arrow_drop_down</span>
					</button>
				</div>

				<div className="plate-calculator-sheet__bar">
					<BarSide barbell={barbell} plates={result.perSidePlates} />
					<div className="plate-calculator-sheet__bar-segment" />
					<BarSide barbell={barbell} plates={[...result.perSidePlates].reverse()} />
				</div>

				{result.loadable ? (
					<div className="plate-calculator-sheet__headline">
						<span className="plate-calculator-sheet__headline-value">
							{result.perSidePlates.map(formatNumber).join(' · ')}
						</span>
						<span className="plate-calculator-sheet__headline-unit">
							{barbell.displayUnit} per side
						</span>
						<div className="plate-calculator-sheet__subline">
							{formatNumber(result.perSideTotal)} per side + {formatNumber(barbell.barWeight)}{' '}
							{barbell.displayUnit} bar
						</div>
					</div>
				) : (
					<div className="plate-calculator-sheet__headline">
						<span className="plate-calculator-sheet__headline-value">
							{formatNumber(result.perSideTotal)} {barbell.displayUnit} per side →{' '}
							{formatNumber(result.achievedTotal)}
						</span>
						<div className="plate-calculator-sheet__subline is-warning">
							Needs {formatNumber(perSideTarget)} per side — smallest plate is{' '}
							{formatNumber(result.smallestPlate ?? 0)}
						</div>
					</div>
				)}

				<div className="plate-calculator-sheet__stepper">
					<button
						type="button"
						className="plate-calculator-sheet__stepper-item"
						disabled={result.nearestLower === undefined}
						onClick={() => result.nearestLower !== undefined && useTotal(result.nearestLower)}
					>
						<span className="material-symbols-rounded">chevron_left</span>
						{result.nearestLower !== undefined ? formatNumber(result.nearestLower) : '—'}
					</button>
					<span
						className={`plate-calculator-sheet__current ${result.loadable ? 'is-loadable' : 'is-warning'}`}
					>
						{formatNumber(targetInUnit)}
						{result.loadable && <span className="material-symbols-rounded">check</span>}
					</span>
					<button
						type="button"
						className="plate-calculator-sheet__stepper-item"
						disabled={result.nearestHigher === undefined}
						onClick={() => result.nearestHigher !== undefined && useTotal(result.nearestHigher)}
					>
						{result.nearestHigher !== undefined ? formatNumber(result.nearestHigher) : '—'}
						<span className="material-symbols-rounded">chevron_right</span>
					</button>
				</div>

				{!result.loadable && (
					<>
						<div className="plate-calculator-sheet__resolutions">
							{result.nearestLower !== undefined && (
								<Button variant="tonal" onClick={() => useTotal(result.nearestLower!)}>
									Use {formatNumber(result.nearestLower)}
								</Button>
							)}
							{result.nearestHigher !== undefined && (
								<Button variant="tonal" onClick={() => useTotal(result.nearestHigher!)}>
									Use {formatNumber(result.nearestHigher)}
								</Button>
							)}
						</div>
						<p className="plate-calculator-sheet__escape-hatch">
							Or keep {formatNumber(targetInUnit)} — it's your call.
						</p>
					</>
				)}

				<p className="plate-calculator-sheet__disclosure">
					From your plate inventory. <strong>Change in Settings</strong>
				</p>

				<div className="plate-calculator-sheet__close">
					<Button variant="text" onClick={onClose}>
						Close
					</Button>
				</div>
			</div>
		</BottomSheet>
	);
}
