// P-45 Graph's chart — hand-built SVG (no charting library, matching the state-layer work's
// precedent of building against the spec directly), a linear time axis so gaps between points
// are visually proportional to how long the gap actually was, not just "the next tick"
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { GraphPoint } from './computeGraphPoints';
import { formatNumber } from '../../domain/format';
import './LineChart.css';

interface LineChartProps {
	points: GraphPoint[];
	selectedSetId?: string;
	onSelectPoint: (point: GraphPoint) => void;
	/** A gap wider than this many days breaks the connecting line, rather than drawing a single
	 *  long segment across missing data (SPEC.md 8.7: "gaps shown as gaps"). */
	gapThresholdDays?: number;
}

const WIDTH = 320;
const HEIGHT = 160;
const PADDING = { top: 12, right: 12, bottom: 20, left: 36 };
const GRIDLINE_COUNT = 4;

function dateToTime(date: string): number {
	return new Date(`${date}T00:00:00`).getTime();
}

export function LineChart({
	points,
	selectedSetId,
	onSelectPoint,
	gapThresholdDays = 21,
}: LineChartProps) {
	const times = points.map((p) => dateToTime(p.date));
	const values = points.map((p) => p.value);
	const minTime = Math.min(...times);
	const maxTime = Math.max(...times);
	const timeRange = maxTime - minTime || 1;
	const minValue = Math.min(...values);
	const maxValue = Math.max(...values);
	const valueRange = maxValue - minValue || Math.max(1, maxValue * 0.1);
	const valuePad = valueRange * 0.15;

	const plotWidth = WIDTH - PADDING.left - PADDING.right;
	const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

	function xFor(time: number): number {
		return PADDING.left + ((time - minTime) / timeRange) * plotWidth;
	}
	function yFor(value: number): number {
		const paddedMin = minValue - valuePad;
		const paddedMax = maxValue + valuePad;
		const range = paddedMax - paddedMin || 1;
		return PADDING.top + plotHeight - ((value - paddedMin) / range) * plotHeight;
	}

	const coords = points.map((p) => ({ point: p, x: xFor(dateToTime(p.date)), y: yFor(p.value) }));

	// Break the path into segments wherever the gap between consecutive points exceeds the
	// threshold, so a long silence in training reads as a visible gap, not a smooth ramp.
	const segments: { x: number; y: number }[][] = [];
	let current: { x: number; y: number }[] = [];
	for (let i = 0; i < coords.length; i++) {
		if (i > 0) {
			const gapDays = (dateToTime(points[i].date) - dateToTime(points[i - 1].date)) / 86_400_000;
			if (gapDays > gapThresholdDays) {
				segments.push(current);
				current = [];
			}
		}
		current.push({ x: coords[i].x, y: coords[i].y });
	}
	segments.push(current);

	const gridlineValues = Array.from({ length: GRIDLINE_COUNT }, (_, i) => {
		const paddedMin = minValue - valuePad;
		const paddedMax = maxValue + valuePad;
		return paddedMin + ((paddedMax - paddedMin) * i) / (GRIDLINE_COUNT - 1);
	});

	const latest = coords[coords.length - 1];

	return (
		<svg
			className="line-chart"
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			role="img"
			aria-label="Trend chart — see the table below for exact values"
		>
			{gridlineValues.map((value) => (
				<g key={value}>
					<line
						className="line-chart__gridline"
						x1={PADDING.left}
						x2={WIDTH - PADDING.right}
						y1={yFor(value)}
						y2={yFor(value)}
					/>
					<text className="line-chart__axis-label" x={2} y={yFor(value) + 3}>
						{formatNumber(Math.round(value * 100) / 100)}
					</text>
				</g>
			))}

			{segments.map((segment, i) => (
				<polyline
					key={i}
					className="line-chart__line"
					points={segment.map((c) => `${c.x},${c.y}`).join(' ')}
					fill="none"
				/>
			))}

			{coords.map(({ point, x, y }) => {
				const isSelected = point.setId === selectedSetId;
				const isLatest = point === latest.point;
				return (
					<circle
						key={point.setId}
						className={
							isSelected || isLatest
								? 'line-chart__dot line-chart__dot--emphasis'
								: 'line-chart__dot'
						}
						cx={x}
						cy={y}
						r={isSelected || isLatest ? 5 : 3}
						onClick={() => onSelectPoint(point)}
					/>
				);
			})}
		</svg>
	);
}
