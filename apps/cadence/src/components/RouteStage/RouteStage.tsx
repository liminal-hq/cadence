// Renders the current route plus, mid-gesture, a "peek" of the previous screen underneath it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useRouter } from '@tanstack/react-router';
import { predictiveBackController, type PredictiveBackState } from '../../predictiveBackController';
import { buildUnderlayNode } from './buildUnderlayNode';
import { ScreenStack } from './ScreenStack';
import './RouteStage.css';

interface RouteStageProps {
	children: ReactNode;
}

const SETTLE_MS = 220;
// Safety net for the "wait for the real navigation to land" finalize effect below -- in the
// (unexpected) case router.history.back() never actually changes location.pathname, don't leave
// the underlay stuck visible forever.
const FINALIZE_FALLBACK_MS = 1000;

export function RouteStage({ children }: RouteStageProps) {
	const location = useLocation();
	const router = useRouter();
	const stackRef = useRef(new ScreenStack());
	const [pbState, setPbState] = useState<PredictiveBackState>({ active: false, progress: 0 });
	const [isDragging, setIsDragging] = useState(false);
	const [showUnderlay, setShowUnderlay] = useState(false);
	const [displayProgress, setDisplayProgress] = useState(0);
	const progressRef = useRef(0);
	progressRef.current = pbState.progress;
	// Set right before router.history.back() on commit; cleared once the finalize effect below
	// actually runs. See that effect for why this hand-off exists.
	const pendingCommitRef = useRef(false);
	const finalizeFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		void predictiveBackController.init();
	}, []);

	useEffect(() => {
		stackRef.current.setCurrent(location.pathname, buildUnderlayNode(router, location.pathname));
	}, [location.pathname, router]);

	useEffect(() => predictiveBackController.subscribe(setPbState), []);

	// Tell native whether there's anywhere in-app for a back gesture to go. Checks the
	// ScreenStack rather than window.history.length: the latter never goes back down when
	// navigating back to an earlier screen, so it stays truthy forever after the first
	// navigation. The stack tracks real navigation depth, collapsing back down on a
	// return-to-earlier-screen, so it's null exactly when there's genuinely nowhere left to go.
	useEffect(() => {
		void predictiveBackController.setCanGoBack(stackRef.current.getPrevious() !== null);
	}, [location.pathname]);

	// Finalizes a committed gesture once the navigation actually lands. router.history.back()
	// is asynchronous -- hiding the underlay and resetting the top layer's transform in the same
	// tick as calling it would do so while the outgoing screen is still rendered, visibly
	// animating it snapping back into view before the real destination lands. Waiting for
	// location.pathname to actually change first means the reset happens once the destination is
	// already showing, so there's nothing to visibly animate between the underlay and real
	// content -- both already show the same thing in the same place.
	useEffect(() => {
		if (!pendingCommitRef.current) return;
		pendingCommitRef.current = false;
		if (finalizeFallbackRef.current) {
			clearTimeout(finalizeFallbackRef.current);
			finalizeFallbackRef.current = null;
		}
		setIsDragging(true);
		setShowUnderlay(false);
	}, [location.pathname]);

	useEffect(() => {
		if (pbState.active) {
			setIsDragging(true);
			setShowUnderlay(true);
			setDisplayProgress(pbState.progress);
			return;
		}

		if (!showUnderlay) return;

		// Enabling the transition and moving displayProgress to its final value in the very same
		// tick wouldn't actually animate: a CSS transition only fires if the property change
		// occurs after a render where the transition was already active, not simultaneously with
		// un-suppressing it. So this commits one frame with is-dragging removed but the position
		// unchanged, then moves to the target on the next frame, giving the browser a valid
		// "before" state to animate from.
		const committed = progressRef.current >= 1;
		setIsDragging(false);
		const frame = requestAnimationFrame(() => setDisplayProgress(committed ? 1 : 0));
		const timeout = setTimeout(() => {
			if (committed) {
				// Only navigate once the top layer has visibly finished sliding away, matching
				// how native Android's own predictive-back completes the motion regardless of
				// exact release point. The actual hide/reset is deferred to the
				// location.pathname effect above.
				pendingCommitRef.current = true;
				router.history.back();
				finalizeFallbackRef.current = setTimeout(() => {
					if (pendingCommitRef.current) {
						pendingCommitRef.current = false;
						setIsDragging(true);
						setShowUnderlay(false);
					}
				}, FINALIZE_FALLBACK_MS);
			} else {
				setShowUnderlay(false);
			}
		}, SETTLE_MS);

		// Cancel pending work if a brand-new event arrives before this one's rAF/timeout fires.
		// This also cancels a still-pending finalizeFallbackRef and resets pendingCommitRef:
		// without that, a brand-new gesture starting while a previous commit's navigation is
		// still in flight would leave that orphaned timer free to fire mid-new-gesture, forcibly
		// hiding the underlay regardless of the new gesture's actual live state.
		return () => {
			cancelAnimationFrame(frame);
			clearTimeout(timeout);
			if (finalizeFallbackRef.current) {
				clearTimeout(finalizeFallbackRef.current);
				finalizeFallbackRef.current = null;
			}
			pendingCommitRef.current = false;
		};
	}, [pbState, router, showUnderlay]);

	const previous = stackRef.current.getPrevious();
	const shouldRenderUnderlay = showUnderlay && previous !== null;
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
