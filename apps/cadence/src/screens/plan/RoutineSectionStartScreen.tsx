// P-20 Routine materialization review — pick, reorder, and preview a section's exercises before committing
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

// Reached from a routine section's "Start" action (Plan) or, in future work, from Today/Quick start. The actual creation is a single `materializeRoutineSection` call, so a cancelled review leaves no unwanted sets behind.

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AppBar } from '../../components/ui/AppBar/AppBar';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { ReorderableList } from '../../components/ui/ReorderableList/ReorderableList';
import { Surface } from '../../components/ui/Surface/Surface';
import { Switch } from '../../components/ui/Switch/Switch';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { LoggingRepository } from '../../domain/repository';
import type {
	Exercise,
	MetricProfile,
	RoutineExercise,
	RoutineSection,
	SetTemplate,
} from '../../domain/types';
import { SEED_LAST_PERFORMANCE } from '../../domain/types';
import { formatNumber, todayLocalDate } from '../../domain/format';
import { loadExerciseHistory } from '../history/loadExerciseHistory';
import '../screens.css';
import './plan.css';

interface RoutineSectionStartScreenProps {
	routineSectionId: string;
}

interface SeedPreview {
	weightKg?: number;
	reps?: number;
	distanceKm?: number;
	durationSec?: number;
}

interface ReviewExercise {
	routineExercise: RoutineExercise;
	exercise: Exercise;
	templates: SetTemplate[];
	included: boolean;
	seedPreview: SeedPreview | null;
}

interface ReviewState {
	routineSection: RoutineSection;
	exercises: ReviewExercise[];
}

/** Mirrors the backend's `most_recent_completed` lookup (the same source `materializeRoutineSection` itself resolves against) closely enough for an advisory preview — the most recently completed set for this exercise on or before `targetDate`, across every workout. */
async function resolveSeedPreview(
	repository: LoggingRepository,
	exerciseId: string,
	targetDate: string,
): Promise<SeedPreview | null> {
	const history = await loadExerciseHistory(repository, exerciseId);
	const onOrBefore = history.filter((entry) => entry.workout.date <= targetDate);
	if (onOrBefore.length === 0) return null;

	const completed = onOrBefore[0].sets
		.filter((set) => set.status === 'completed')
		.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
	if (completed.length === 0) return null;

	const { weightKg, reps, distanceKm, durationSec } = completed[0];
	return { weightKg, reps, distanceKm, durationSec };
}

async function loadReviewState(
	repository: LoggingRepository,
	routineSectionId: string,
	targetDate: string,
): Promise<ReviewState> {
	const routineSection = await repository.getRoutineSection(routineSectionId);
	const routineExercises = await repository.listRoutineExercises(routineSectionId);
	const exercises = await Promise.all(
		routineExercises.map(async (routineExercise) => {
			const [exercise, templates] = await Promise.all([
				repository.getExercise(routineExercise.exerciseId),
				repository.listSetTemplates(routineExercise.id),
			]);
			const seedsFromHistory = templates.some(
				(template) => template.populationRule === SEED_LAST_PERFORMANCE,
			);
			const seedPreview = seedsFromHistory
				? await resolveSeedPreview(repository, routineExercise.exerciseId, targetDate)
				: null;
			return { routineExercise, exercise, templates, included: true, seedPreview };
		}),
	);
	return { routineSection, exercises };
}

const MISSING_VALUE = '—';

function templateTargetLabel(
	template: SetTemplate,
	metricProfile: MetricProfile,
	seedPreview: SeedPreview | null,
): string {
	if (template.populationRule === SEED_LAST_PERFORMANCE) {
		if (!seedPreview) return 'Seeded from last performance — no history yet';
		return `Seeded from last performance: ${templateValuesLabel(seedPreview, metricProfile)}`;
	}
	return templateValuesLabel(template, metricProfile);
}

function templateValuesLabel(
	values: { weightKg?: number; reps?: number; distanceKm?: number; durationSec?: number },
	metricProfile: MetricProfile,
): string {
	if (metricProfile === 'weight-reps') {
		const weight = values.weightKg == null ? MISSING_VALUE : `${formatNumber(values.weightKg)} kg`;
		const reps = values.reps == null ? MISSING_VALUE : values.reps;
		return `${weight} × ${reps}`;
	}
	const distance =
		values.distanceKm == null ? MISSING_VALUE : `${formatNumber(values.distanceKm)} km`;
	const duration = values.durationSec == null ? MISSING_VALUE : `${values.durationSec}s`;
	return `${distance} · ${duration}`;
}

export function RoutineSectionStartScreen({ routineSectionId }: RoutineSectionStartScreenProps) {
	const repository = useLoggingRepository();
	const navigate = useNavigate();
	const [state, setState] = useState<ReviewState | null>(null);
	const [starting, setStarting] = useState(false);
	const targetDate = todayLocalDate();

	useEffect(() => {
		loadReviewState(repository, routineSectionId, targetDate).then(setState);
	}, [repository, routineSectionId, targetDate]);

	if (!state) return null;
	const { routineSection, exercises } = state;

	function setExercises(next: ReviewExercise[]) {
		setState((prev) => (prev ? { ...prev, exercises: next } : prev));
	}

	function toggleIncluded(routineExerciseId: string) {
		setExercises(
			exercises.map((item) =>
				item.routineExercise.id === routineExerciseId
					? { ...item, included: !item.included }
					: item,
			),
		);
	}

	async function handleStart() {
		setStarting(true);
		const selectedIds = exercises
			.filter((item) => item.included)
			.map((item) => item.routineExercise.id);
		const workout = await repository.materializeRoutineSection(
			routineSectionId,
			targetDate,
			selectedIds,
		);
		navigate({ to: '/workout/$workoutId', params: { workoutId: workout.id } });
	}

	return (
		<div className="screen-shell">
			<AppBar
				title={routineSection.name ?? 'Start section'}
				size="medium"
				back={{ to: `/plan/routine/${routineSection.routineId}` }}
			/>
			<div className="screen-shell__content routine-screen__content">
				{exercises.length === 0 ? (
					<EmptyState headline="Nothing to start" body="This section has no exercises yet." />
				) : (
					<ReorderableList
						items={exercises}
						getKey={(item) => item.routineExercise.id}
						onReorder={setExercises}
						renderItem={(item) => (
							<Surface
								tone="container-low"
								radius="m"
								className={`routine-review-row${item.included ? '' : ' routine-review-row--excluded'}`}
							>
								<Switch
									checked={item.included}
									onChange={() => toggleIncluded(item.routineExercise.id)}
									label={`Include ${item.exercise.name}`}
								/>
								<div className="routine-review-row__body">
									<span className="routine-review-row__name">{item.exercise.name}</span>
									{item.templates.length === 0 ? (
										<span className="routine-review-row__target">No set templates</span>
									) : (
										item.templates.map((template) => (
											<span key={template.id} className="routine-review-row__target">
												{templateTargetLabel(
													template,
													item.exercise.metricProfile,
													item.seedPreview,
												)}
											</span>
										))
									)}
								</div>
							</Surface>
						)}
					/>
				)}

				<Button variant="filled" onClick={handleStart} disabled={starting}>
					Start workout
				</Button>
			</div>
		</div>
	);
}
