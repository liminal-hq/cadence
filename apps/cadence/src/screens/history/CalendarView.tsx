// P-41 Calendar — month navigation, a 7-column weekday header, and day cells classified by
// classifyCalendarDay.ts; this component only renders pre-computed dot data, it doesn't fetch
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { IconButton } from '../../components/ui/IconButton/IconButton';
import { classifyCalendarDay } from './classifyCalendarDay';
import { formatMonthYearLabel } from './historyDates';
import './CalendarView.css';

export interface CalendarDayDot {
	workoutId: string;
	categoryColour: string;
	hasCompletedSets: boolean;
}

interface CalendarViewProps {
	/** The first of the displayed month, as 'YYYY-MM-DD'. */
	monthStart: string;
	todayDate: string;
	selectedDate: string | null;
	dotsByDate: Record<string, CalendarDayDot[]>;
	onSelectDate: (date: string) => void;
	onMonthChange: (monthStart: string) => void;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toDateStr(year: number, month: number, day: number): string {
	return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function CalendarView({
	monthStart,
	todayDate,
	selectedDate,
	dotsByDate,
	onSelectDate,
	onMonthChange,
}: CalendarViewProps) {
	const [year, month] = monthStart.split('-').map(Number);
	const monthIndex = month - 1;
	const firstOfMonth = new Date(year, monthIndex, 1);
	const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
	const leadingBlanks = firstOfMonth.getDay();

	const cells: (string | null)[] = [
		...Array.from({ length: leadingBlanks }, () => null),
		...Array.from({ length: daysInMonth }, (_, i) => toDateStr(year, monthIndex, i + 1)),
	];

	function shiftMonth(delta: number) {
		const next = new Date(year, monthIndex + delta, 1);
		onMonthChange(toDateStr(next.getFullYear(), next.getMonth(), 1));
	}

	return (
		<div className="calendar-view">
			<div className="calendar-view__nav">
				<IconButton
					icon="chevron_left"
					label="Previous month"
					size="small"
					onClick={() => shiftMonth(-1)}
				/>
				<span className="calendar-view__month-label">{formatMonthYearLabel(monthStart)}</span>
				<IconButton
					icon="chevron_right"
					label="Next month"
					size="small"
					onClick={() => shiftMonth(1)}
				/>
			</div>

			<div className="calendar-view__weekdays">
				{WEEKDAY_LABELS.map((label, i) => (
					<span key={i} className="calendar-view__weekday">
						{label}
					</span>
				))}
			</div>

			<div className="calendar-view__grid">
				{cells.map((dateStr, i) => {
					if (!dateStr) return <div key={`blank-${i}`} className="calendar-view__cell-blank" />;

					const dots = dotsByDate[dateStr] ?? [];
					const state = classifyCalendarDay(dots);
					const isToday = dateStr === todayDate;
					const isSelected = dateStr === selectedDate;
					const dayNumber = Number(dateStr.slice(-2));

					return (
						<button
							key={dateStr}
							type="button"
							className={[
								'calendar-view__cell',
								isToday && 'calendar-view__cell--today',
								isSelected && 'calendar-view__cell--selected',
								state === 'planned-only' && 'calendar-view__cell--planned-only',
							]
								.filter(Boolean)
								.join(' ')}
							onClick={() => onSelectDate(dateStr)}
							aria-label={`${dateStr}${isToday ? ', today' : ''}${
								state === 'no-workout'
									? ', no workout'
									: state === 'planned-only'
										? ', planned workout'
										: state === 'multi-workout'
											? `, ${dots.length} workouts`
											: ', workout logged'
							}`}
						>
							<span className="calendar-view__day-number">{dayNumber}</span>
							{dots.length > 0 && (
								<span className="calendar-view__dots">
									{dots.slice(0, 4).map((dot, dotIndex) => (
										<span
											key={dotIndex}
											className={
												dot.hasCompletedSets
													? 'calendar-view__dot'
													: 'calendar-view__dot calendar-view__dot--hollow'
											}
											style={
												dot.hasCompletedSets
													? { background: dot.categoryColour }
													: { borderColor: dot.categoryColour }
											}
										/>
									))}
								</span>
							)}
						</button>
					);
				})}
			</div>

			<div className="calendar-view__legend">
				<span className="calendar-view__legend-item">
					<span className="calendar-view__dot" style={{ background: 'var(--cadence-primary)' }} />
					Completed
				</span>
				<span className="calendar-view__legend-item">
					<span
						className="calendar-view__dot calendar-view__dot--hollow"
						style={{ borderColor: 'var(--cadence-primary)' }}
					/>
					Planned only
				</span>
			</div>
		</div>
	);
}
