// Date-label helpers shared by the Calendar/List views and workout rows — kept pure and taking
// "today" as an explicit parameter rather than reading the clock, so they're deterministic to test
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/** Local-midnight parse for a 'YYYY-MM-DD' date, so day-difference math isn't thrown off by the
 *  runtime's timezone the way `new Date('2026-09-09')` (parsed as UTC) can be. */
function toLocalDate(dateStr: string): Date {
	return new Date(`${dateStr}T00:00:00`);
}

/** `dateStr` minus `fromStr`, in whole days — positive when `dateStr` is in the past. */
export function daysBefore(fromStr: string, dateStr: string): number {
	const msPerDay = 24 * 60 * 60 * 1000;
	return Math.round((toLocalDate(fromStr).getTime() - toLocalDate(dateStr).getTime()) / msPerDay);
}

/** `dateStr` shifted by `delta` days (negative moves into the past), as 'YYYY-MM-DD'. */
export function addDays(dateStr: string, delta: number): string {
	const shifted = toLocalDate(dateStr);
	shifted.setDate(shifted.getDate() + delta);
	const year = shifted.getFullYear();
	const month = String(shifted.getMonth() + 1).padStart(2, '0');
	const day = String(shifted.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

const WEEKDAY_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
	weekday: 'short',
	day: 'numeric',
	month: 'short',
});

export function formatCalendarDateLabel(dateStr: string): string {
	return WEEKDAY_DATE_FORMAT.format(toLocalDate(dateStr));
}

export function formatRowDateLabel(dateStr: string, todayStr: string): string {
	const diff = daysBefore(todayStr, dateStr);
	if (diff === 0) return 'Today';
	if (diff === 1) return 'Yesterday';
	return formatCalendarDateLabel(dateStr);
}

const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric' });

export function formatMonthYearLabel(dateStr: string): string {
	return MONTH_YEAR_FORMAT.format(toLocalDate(dateStr));
}

/** "This week" / "Last week" (rolling 7-day windows from today) or a "Month Year" bucket
 *  otherwise — P-42's list grouping headers. */
export function formatHistoryGroupLabel(dateStr: string, todayStr: string): string {
	const diff = daysBefore(todayStr, dateStr);
	if (diff >= 0 && diff < 7) return 'This week';
	if (diff >= 7 && diff < 14) return 'Last week';
	return formatMonthYearLabel(dateStr);
}

/** The first of the month containing `dateStr`, as 'YYYY-MM-DD'. */
export function monthStartOf(dateStr: string): string {
	return `${dateStr.slice(0, 7)}-01`;
}

/** The last calendar date of the month containing `dateStr`, as 'YYYY-MM-DD'. */
export function monthEndOf(dateStr: string): string {
	const [year, month] = dateStr.split('-').map(Number);
	const lastDay = new Date(year, month, 0).getDate();
	return `${dateStr.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
}
