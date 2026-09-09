// The inverse-surface coach mark tooltip: directional tail, step counter, Skip tour/Next --
// the final step swaps to a Done-only footer with no counter (Logging.dc.html's coach mark 5)
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import './CoachMarkTooltip.css';

interface CoachMarkTooltipProps {
	title: string;
	body: string;
	step: number;
	totalSteps: number;
	tailPlacement: 'top' | 'bottom';
	isLastStep: boolean;
	onNext: () => void;
	onSkip: () => void;
}

export function CoachMarkTooltip({
	title,
	body,
	step,
	totalSteps,
	tailPlacement,
	isLastStep,
	onNext,
	onSkip,
}: CoachMarkTooltipProps) {
	return (
		<div
			className={`coach-mark-tooltip coach-mark-tooltip--tail-${tailPlacement}`}
			role="dialog"
			aria-label={title}
		>
			<span className="coach-mark-tooltip__tail" aria-hidden="true" />
			<div className="coach-mark-tooltip__title">{title}</div>
			<div className="coach-mark-tooltip__body">{body}</div>
			<div className="coach-mark-tooltip__footer">
				{isLastStep ? (
					<span />
				) : (
					<span className="coach-mark-tooltip__counter">
						{step + 1} of {totalSteps}
					</span>
				)}
				<span className="coach-mark-tooltip__actions">
					{!isLastStep && (
						<button type="button" className="coach-mark-tooltip__text-button" onClick={onSkip}>
							Skip tour
						</button>
					)}
					<button type="button" className="coach-mark-tooltip__text-button" onClick={onNext}>
						{isLastStep ? 'Done' : 'Next'}
					</button>
				</span>
			</div>
		</div>
	);
}
