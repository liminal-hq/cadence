// Renders the current route plus, mid-gesture, a "peek" of the previous screen underneath it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from '@tanstack/react-router';
import { ScreenStack } from './ScreenStack';
import './RouteStage.css';

interface PredictiveBackState {
	active: boolean;
	progress: number;
}

// The actual gesture source (Android's predictive-back API) isn't wired up yet -- there's no
// Android build target to attach the native plugin to (see the Logging-flow plan's "Screen
// transitions" section). This stub keeps RouteStage structurally ready for that controller
// without any rendering-logic changes once it exists.
function usePredictiveBackState(): PredictiveBackState {
	return { active: false, progress: 0 };
}

interface RouteStageProps {
	children: ReactNode;
}

const SETTLE_MS = 220;

export function RouteStage({ children }: RouteStageProps) {
	const location = useLocation();
	const stackRef = useRef(new ScreenStack());
	const pbState = usePredictiveBackState();
	const [isDragging, setIsDragging] = useState(false);
	const [isSettling, setIsSettling] = useState(false);
	const [displayProgress, setDisplayProgress] = useState(0);

	useEffect(() => {
		stackRef.current.setCurrent(location.pathname, children);
	}, [location.pathname, children]);

	useEffect(() => {
		if (pbState.active) {
			setIsDragging(true);
			setDisplayProgress(pbState.progress);
			return;
		}

		if (!isDragging) return;

		setIsDragging(false);
		setIsSettling(true);
		const committed = pbState.progress >= 1;
		const frame = requestAnimationFrame(() => setDisplayProgress(committed ? 1 : 0));
		const timeout = setTimeout(() => setIsSettling(false), SETTLE_MS);
		return () => {
			cancelAnimationFrame(frame);
			clearTimeout(timeout);
		};
	}, [pbState.active, pbState.progress, isDragging]);

	const previous = stackRef.current.getPrevious();
	const shouldRenderUnderlay = (isDragging || isSettling) && previous !== null;
	const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 400;

	const topStyle = shouldRenderUnderlay
		? { transform: `translateX(${displayProgress * windowWidth}px)`, opacity: 1 - displayProgress }
		: undefined;
	const underlayStyle = shouldRenderUnderlay
		? { transform: `scale(${0.95 + 0.05 * displayProgress})` }
		: undefined;

	return (
		<div className="route-stage">
			{shouldRenderUnderlay && previous && (
				<div
					className={`route-stage__underlay ${isDragging ? 'is-dragging' : ''}`}
					style={underlayStyle}
				>
					{previous.node}
					<div className="route-stage__underlay-scrim" style={{ opacity: 1 - displayProgress }} />
				</div>
			)}
			<div className={`route-stage__top ${isDragging ? 'is-dragging' : ''}`} style={topStyle}>
				{children}
			</div>
		</div>
	);
}
