// P-40 History hub + P-41 Calendar — Calendar/List share one toolbar, one category filter, and
// one Health Connect banner; List (P-42) is broken out into its own component below. History is
// one of the four tab destinations, so its title/settings action come from TabsLayout's shared
// AppShell — this component is bare content, the same shape as TodayScreen/PlanScreen.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { IconButton } from '../../components/ui/IconButton/IconButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl/SegmentedControl';
import { Chip } from '../../components/ui/Chip/Chip';
import { Banner } from '../../components/ui/Banner/Banner';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { CalendarView, type CalendarDayDot } from './CalendarView';
import { WorkoutHistoryRow } from './WorkoutHistoryRow';
import { WorkoutHistoryList } from './WorkoutHistoryList';
import { loadWorkoutSummary, type WorkoutSummary } from './loadWorkoutSummary';
import { formatCalendarDateLabel, monthEndOf, monthStartOf } from './historyDates';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import { TODAY_DATE } from '../../domain/seedData';
import { CATEGORY_COLOURS, DEFAULT_CATEGORY_COLOUR } from '../../data/categoryColours';
import './history.css';

type HistoryView = 'calendar' | 'list';

export function HistoryHubScreen() {
	const navigate = useNavigate();
	const repository = useLoggingRepository();
	const [view, setView] = useState<HistoryView>('calendar');
	const [monthStart, setMonthStart] = useState(() => monthStartOf(TODAY_DATE));
	const [selectedDate, setSelectedDate] = useState<string | null>(TODAY_DATE);
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const [filterPickerOpen, setFilterPickerOpen] = useState(false);
	const [dotsByDate, setDotsByDate] = useState<Record<string, CalendarDayDot[]>>({});
	const [selectedDayWorkouts, setSelectedDayWorkouts] = useState<WorkoutSummary[]>([]);
	const [bannerDismissed, setBannerDismissed] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');

	useEffect(() => {
		let cancelled = false;
		async function load() {
			const workouts = await repository.listWorkoutsInRange(monthStart, monthEndOf(monthStart));
			const summaries = await Promise.all(
				workouts.map((w) => loadWorkoutSummary(repository, w.id)),
			);
			if (cancelled) return;

			const byDate: Record<string, CalendarDayDot[]> = {};
			for (const summary of summaries) {
				if (categoryFilter && summary.primaryCategory !== categoryFilter) continue;
				const colour =
					CATEGORY_COLOURS[summary.primaryCategory ?? '']?.dot ?? DEFAULT_CATEGORY_COLOUR.dot;
				(byDate[summary.workout.date] ??= []).push({
					workoutId: summary.workout.id,
					categoryColour: colour,
					hasCompletedSets: summary.hasCompletedSets,
				});
			}
			setDotsByDate(byDate);
		}
		load();
		return () => {
			cancelled = true;
		};
	}, [repository, monthStart, categoryFilter]);

	useEffect(() => {
		if (!selectedDate) {
			setSelectedDayWorkouts([]);
			return;
		}
		let cancelled = false;
		async function load() {
			const workouts = await repository.listWorkoutsInRange(selectedDate!, selectedDate!);
			const summaries = await Promise.all(
				workouts.map((w) => loadWorkoutSummary(repository, w.id)),
			);
			const filtered = categoryFilter
				? summaries.filter((s) => s.primaryCategory === categoryFilter)
				: summaries;
			if (!cancelled) setSelectedDayWorkouts(filtered);
		}
		load();
		return () => {
			cancelled = true;
		};
	}, [repository, selectedDate, categoryFilter]);

	const categories = Object.keys(CATEGORY_COLOURS);

	return (
		<div className="history-hub">
			<div className="history-hub__toolbar">
				<SegmentedControl
					options={[
						{ value: 'calendar', label: 'Calendar', icon: 'calendar_month' },
						{ value: 'list', label: 'List', icon: 'view_list' },
					]}
					value={view}
					onChange={(value) => setView(value as HistoryView)}
				/>
				<div className="history-hub__toolbar-end">
					{categoryFilter ? (
						<Chip variant="input" label={categoryFilter} onRemove={() => setCategoryFilter(null)} />
					) : (
						<Chip
							variant="assist"
							icon="filter_list"
							label="Filter"
							onClick={() => setFilterPickerOpen(true)}
						/>
					)}
					<IconButton
						icon="search"
						label="Search"
						variant={searchOpen ? 'tonal' : 'standard'}
						size="small"
						onClick={() => setSearchOpen((open) => !open)}
					/>
				</div>
			</div>

			{searchOpen && (
				<div className="history-hub__search">
					<input
						className="history-hub__search-input"
						placeholder="Search workouts and exercises"
						value={searchQuery}
						onChange={(event) => {
							setSearchQuery(event.target.value);
							setView('list');
						}}
						autoFocus
					/>
				</div>
			)}

			{!bannerDismissed && (
				<div className="history-hub__banner">
					<Banner
						icon="favorite"
						message="2 workouts from other apps are in Health Connect and not in Cadence."
						tone="primary"
						action={{ label: 'Review', onClick: () => {} }}
						onDismiss={() => setBannerDismissed(true)}
					/>
				</div>
			)}

			{view === 'calendar' ? (
				<>
					<CalendarView
						monthStart={monthStart}
						todayDate={TODAY_DATE}
						selectedDate={selectedDate}
						dotsByDate={dotsByDate}
						onSelectDate={setSelectedDate}
						onMonthChange={setMonthStart}
					/>
					<div className="history-hub__day-expansion">
						{selectedDate && (
							<h2 className="history-hub__section-title">
								{formatCalendarDateLabel(selectedDate)}
							</h2>
						)}
						{selectedDate && selectedDayWorkouts.length === 0 && (
							<EmptyState headline="No workouts" body="Nothing logged or planned for this day." />
						)}
						{selectedDayWorkouts.map((summary) => (
							<WorkoutHistoryRow
								key={summary.workout.id}
								workout={summary.workout}
								exercises={summary.exercises}
								dateLabel={formatCalendarDateLabel(summary.workout.date)}
								onClick={() =>
									navigate({
										to: '/history/workout/$workoutId',
										params: { workoutId: summary.workout.id },
									})
								}
							/>
						))}
					</div>
				</>
			) : (
				<WorkoutHistoryList
					categoryFilter={categoryFilter}
					searchQuery={searchQuery}
					onOpenWorkout={(workoutId) =>
						navigate({ to: '/history/workout/$workoutId', params: { workoutId } })
					}
				/>
			)}

			<Dialog
				open={filterPickerOpen}
				onClose={() => setFilterPickerOpen(false)}
				headline="Filter by category"
				role="dialog"
			>
				<div className="history-hub__category-picker">
					{categories.map((category) => (
						<Chip
							key={category}
							variant="filter"
							label={category}
							selected={categoryFilter === category}
							onClick={() => {
								setCategoryFilter(category);
								setFilterPickerOpen(false);
							}}
						/>
					))}
				</div>
			</Dialog>
		</div>
	);
}
