// P-14 Exercise logging -- the "Preferred direction" fixed stepper-cluster pattern: a pinned
// cluster loads one set at a time, the list below is read-only, and a docked rest timer bar
// keeps rest visible without leaving the screen (SPEC.md section 7)
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useCallback, useEffect, useState } from 'react';
import { DetailAppBar } from '../components/DetailAppBar/DetailAppBar';
import { SetRow, type SetRowState } from '../components/SetRow/SetRow';
import { StepperCluster, type StepperField } from '../components/StepperCluster/StepperCluster';
import { RestTimerBar } from '../components/RestTimerBar/RestTimerBar';
import { RestTimerSheet } from '../components/RestTimerSheet/RestTimerSheet';
import { SetEditorSheet } from '../components/SetEditorSheet/SetEditorSheet';
import { SetNoteScreen } from '../components/SetNoteScreen/SetNoteScreen';
import { PlateCalculatorSheet } from '../components/PlateCalculatorSheet/PlateCalculatorSheet';
import { CoachMarkTooltip } from '../components/CoachMark/CoachMarkTooltip';
import { CoachMarkBadge } from '../components/CoachMark/CoachMarkBadge';
import { useCoachMarkTour } from '../components/CoachMark/useCoachMarkTour';
import { useLoggingRepository } from '../domain/RepositoryProvider';
import { formatClockTime, formatDurationSec, formatNumber } from '../domain/format';
import type { Exercise, SetEntry, WorkoutExercise } from '../domain/types';
import { SCENARIO_TO_WORKOUT_EXERCISE_ID, type Scenario } from '../domain/seedData';
import './screens.css';
import './ExerciseLoggingScreen.css';

interface ExerciseLoggingScreenProps {
	scenario: Scenario;
}

type Overlay =
	| { type: 'setEditor'; setId: string }
	| { type: 'setNote'; setId: string }
	| { type: 'plateCalculator'; setId: string }
	| { type: 'restTimer' };

// Five coach marks, first workout only, skippable at any step (Logging.dc.html's Priya
// canvas): ① tap a row to load it, ② the Log button, ③ where last time will appear,
// ④ rest auto-starts, ⑤ watch hand-off.
const COACH_MARK_STEPS = [
	{
		title: 'Tap a set to load it',
		body: 'It loads into the stepper below -- use −/+ to fill it in.',
	},
	{ title: 'Log when it’s done', body: 'Log finishes the set, starts rest and moves you on.' },
	{
		title: 'Last time lands here',
		body: 'Next time this shows your weight and reps -- and a trophy if you beat it.',
	},
	{
		title: 'Rest starts by itself',
		body: 'Rest starts after each set. Tap the bar to change or skip.',
	},
	{
		title: 'Got a Wear OS watch?',
		body: 'Install Cadence on it to log from your wrist -- even offline.',
	},
];

function setRowState(set: SetEntry, loadedSetId: string | null): SetRowState {
	if (set.status === 'completed') return 'completed';
	if (set.id === loadedSetId) return 'loaded';
	return 'planned';
}

export function ExerciseLoggingScreen({ scenario }: ExerciseLoggingScreenProps) {
	const repository = useLoggingRepository();
	const [currentWorkoutExerciseId, setCurrentWorkoutExerciseId] = useState(
		SCENARIO_TO_WORKOUT_EXERCISE_ID[scenario],
	);
	const [workoutExercise, setWorkoutExercise] = useState<WorkoutExercise | null>(null);
	const [exercise, setExercise] = useState<Exercise | null>(null);
	const [siblings, setSiblings] = useState<WorkoutExercise[]>([]);
	const [siblingExerciseNames, setSiblingExerciseNames] = useState<Record<string, string>>({});
	const [sets, setSets] = useState<SetEntry[]>([]);
	const [loadedSetId, setLoadedSetId] = useState<string | null>(null);
	// Non-null exactly when loadedSetId is null and there's no next planned set to advance to --
	// the cluster's "draft" mode: values for a set that doesn't exist yet, created on Log rather
	// than sitting in the list beforehand as an unchecked, pre-filled row (which read as
	// confusing -- values that looked recorded but weren't).
	const [draftValues, setDraftValues] = useState<Partial<
		Pick<SetEntry, 'weightKg' | 'reps' | 'distanceKm' | 'durationSec'>
	> | null>(null);
	const [overlay, setOverlay] = useState<Overlay | null>(null);

	// Sam has a paired watch (SPEC's persona); Priya doesn't -- drives the rest timer
	// sheet's haptics-ownership copy and notifications-denied demo.
	const hasWatch = scenario !== 'priya-first-run';
	// The coach mark tour is Priya's first-workout-only onboarding moment (SPEC's persona) --
	// it doesn't run for Sam, who's already used the app.
	const coachMarks = useCoachMarkTour(scenario === 'priya-first-run');

	const loadWorkoutExercise = useCallback(
		async (workoutExerciseId: string) => {
			const we = await repository.getWorkoutExercise(workoutExerciseId);
			const [ex, workoutSets, workoutSiblings] = await Promise.all([
				repository.getExercise(we.exerciseId),
				repository.listSets(we.id),
				repository.listWorkoutExercisesByWorkout(we.workoutId),
			]);
			setWorkoutExercise(we);
			setExercise(ex);
			setSiblings(workoutSiblings);
			setSets(workoutSets);

			const siblingExercises = await Promise.all(
				workoutSiblings.map((s) => repository.getExercise(s.exerciseId)),
			);
			setSiblingExerciseNames(
				Object.fromEntries(workoutSiblings.map((s, i) => [s.id, siblingExercises[i].name])),
			);

			const firstPlanned = workoutSets.find((s) => s.status === 'planned');
			if (firstPlanned) {
				setLoadedSetId(firstPlanned.id);
				setDraftValues(null);
			} else {
				const last = workoutSets[workoutSets.length - 1];
				setLoadedSetId(null);
				setDraftValues(
					last
						? {
								weightKg: last.weightKg,
								reps: last.reps,
								distanceKm: last.distanceKm,
								durationSec: last.durationSec,
							}
						: {},
				);
			}
		},
		[repository],
	);

	useEffect(() => {
		setCurrentWorkoutExerciseId(SCENARIO_TO_WORKOUT_EXERCISE_ID[scenario]);
	}, [scenario]);

	useEffect(() => {
		loadWorkoutExercise(currentWorkoutExerciseId);
	}, [currentWorkoutExerciseId, loadWorkoutExercise]);

	if (!workoutExercise || !exercise) return null;

	const loadedSet = sets.find((s) => s.id === loadedSetId) ?? null;
	const loadedIndex = sets.findIndex((s) => s.id === loadedSetId);
	const isDraftMode = loadedSetId === null && draftValues !== null;
	const editorSet =
		overlay && overlay.type !== 'restTimer'
			? (sets.find((s) => s.id === overlay.setId) ?? null)
			: null;

	const persistSet = async (updated: SetEntry) => {
		setSets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
		await repository.saveSet(updated);
	};

	const setDraftField = <K extends keyof NonNullable<typeof draftValues>>(key: K, value: number) =>
		setDraftValues((prev) => ({ ...prev, [key]: value }));

	const primaryField: StepperField =
		exercise.metricProfile === 'weight-reps'
			? {
					label: 'kg',
					value: isDraftMode ? draftValues?.weightKg : loadedSet?.weightKg,
					increment: exercise.weightIncrementKg ?? 2.5,
					formatValue: formatNumber,
					onChange: (value) =>
						isDraftMode
							? setDraftField('weightKg', value)
							: loadedSet && persistSet({ ...loadedSet, weightKg: value }),
				}
			: {
					label: 'km',
					value: isDraftMode ? draftValues?.distanceKm : loadedSet?.distanceKm,
					increment: exercise.distanceIncrementKm ?? 0.1,
					formatValue: (v) => v.toFixed(1),
					onChange: (value) =>
						isDraftMode
							? setDraftField('distanceKm', value)
							: loadedSet && persistSet({ ...loadedSet, distanceKm: value }),
				};

	const secondaryField: StepperField =
		exercise.metricProfile === 'weight-reps'
			? {
					label: 'reps',
					value: isDraftMode ? draftValues?.reps : loadedSet?.reps,
					increment: exercise.repsIncrement ?? 1,
					formatValue: formatNumber,
					onChange: (value) =>
						isDraftMode
							? setDraftField('reps', value)
							: loadedSet && persistSet({ ...loadedSet, reps: value }),
				}
			: {
					label: 'min:sec',
					value: isDraftMode ? draftValues?.durationSec : loadedSet?.durationSec,
					increment: exercise.durationIncrementSec ?? 10,
					formatValue: formatDurationSec,
					onChange: (value) =>
						isDraftMode
							? setDraftField('durationSec', value)
							: loadedSet && persistSet({ ...loadedSet, durationSec: value }),
				};

	// Re-visiting an already-completed set via the cluster's prev/next stepper is editing, not
	// logging -- its fields already save live on every +/- press (see persistSet below), so the
	// button returns to logging mode rather than completing-and-advancing again.
	const isEditingCompletedSet = !isDraftMode && loadedSet?.status === 'completed';

	const enterDraftMode = (seed: SetEntry) => {
		setLoadedSetId(null);
		setDraftValues({
			weightKg: seed.weightKg,
			reps: seed.reps,
			distanceKm: seed.distanceKm,
			durationSec: seed.durationSec,
		});
	};

	const handleLog = async () => {
		if (isDraftMode) {
			if (!draftValues) return;
			const created = await repository.logNewSet(workoutExercise.id, draftValues);
			setSets((prev) => [...prev, created]);
			// Stay in draft mode with the same values -- repeating the same weight/reps for a
			// straight set is then just another tap of Log, no re-entry needed.
			const label =
				exercise.metricProfile === 'weight-reps'
					? `${exercise.name} set ${created.order} · ${formatNumber(created.weightKg ?? 0)} × ${created.reps ?? 0}`
					: `${exercise.name} set ${created.order}`;
			await repository.startRestTimer(120_000, {
				forSetId: created.id,
				nextSetLabel: label,
				ownerDevice: hasWatch ? 'watch' : 'phone',
			});
			return;
		}

		if (!loadedSet) return;

		if (loadedSet.status === 'completed') {
			// "Save": edits already persisted live on every +/- press -- just return to logging.
			enterDraftMode(loadedSet);
			return;
		}

		const completed = await repository.completeSet(loadedSet.id);
		setSets((prev) => prev.map((s) => (s.id === completed.id ? completed : s)));

		const nextPlanned = sets.find((s, i) => i > loadedIndex && s.status === 'planned');
		if (nextPlanned) {
			setLoadedSetId(nextPlanned.id);
		} else {
			enterDraftMode(completed);
		}

		const upcoming = nextPlanned ?? completed;
		const label =
			exercise.metricProfile === 'weight-reps'
				? `${exercise.name} set ${upcoming.order + (nextPlanned ? 0 : 1)} · ${formatNumber(upcoming.weightKg ?? 0)} × ${upcoming.reps ?? 0}`
				: `${exercise.name} set ${upcoming.order + (nextPlanned ? 0 : 1)}`;
		await repository.startRestTimer(120_000, {
			forSetId: completed.id,
			nextSetLabel: label,
			ownerDevice: hasWatch ? 'watch' : 'phone',
		});
	};

	const handleAddSet = async () => {
		const created = await repository.addSet(workoutExercise.id);
		setSets((prev) => [...prev, created]);
		setLoadedSetId(created.id);
		setDraftValues(null);
	};

	const handleDeleteSet = (setId: string) => {
		const remaining = sets.filter((s) => s.id !== setId);
		setSets(remaining);
		if (loadedSetId === setId) {
			const firstPlanned = remaining.find((s) => s.status === 'planned');
			if (firstPlanned) {
				setLoadedSetId(firstPlanned.id);
				setDraftValues(null);
			} else {
				const last = remaining[remaining.length - 1];
				setLoadedSetId(null);
				setDraftValues(
					last
						? {
								weightKg: last.weightKg,
								reps: last.reps,
								distanceKm: last.distanceKm,
								durationSec: last.durationSec,
							}
						: {},
				);
			}
		}
	};

	const siblingIndex = siblings.findIndex((s) => s.id === workoutExercise.id);
	const previousExercise = siblingIndex > 0 ? siblings[siblingIndex - 1] : undefined;
	const nextExercise =
		siblingIndex >= 0 && siblingIndex < siblings.length - 1
			? siblings[siblingIndex + 1]
			: undefined;
	const supersetPartner = workoutExercise.supersetGroupId
		? siblings.find(
				(s) => s.supersetGroupId === workoutExercise.supersetGroupId && s.id !== workoutExercise.id,
			)
		: undefined;

	return (
		<div className="exercise-logging">
			<DetailAppBar
				title={exercise.name}
				category={exercise.category}
				subtitle={workoutExercise.workoutLabel}
			/>

			<div className="exercise-logging__content">
				{workoutExercise.offlineSince && (
					<div className="exercise-logging__offline-banner">
						<span className="material-symbols-rounded">watch_off</span>
						<span>
							<strong>Watch offline since {formatClockTime(workoutExercise.offlineSince)}.</strong>{' '}
							Sets logged there merge here when it reconnects.
						</span>
					</div>
				)}

				{supersetPartner && (
					<div className="exercise-logging__superset-next">
						<div>
							<span className="exercise-logging__superset-next-label">Superset · next up</span>
							<div className="exercise-logging__superset-next-name">
								{siblingExerciseNames[supersetPartner.id] ?? supersetPartner.workoutLabel}
							</div>
						</div>
						<button type="button" onClick={() => setCurrentWorkoutExerciseId(supersetPartner.id)}>
							Switch
							<span className="material-symbols-rounded">arrow_forward</span>
						</button>
					</div>
				)}

				{!supersetPartner && (previousExercise || nextExercise) ? (
					<div className="exercise-logging__exercise-nav">
						<button
							type="button"
							disabled={!previousExercise}
							onClick={() => previousExercise && setCurrentWorkoutExerciseId(previousExercise.id)}
						>
							<span className="material-symbols-rounded">chevron_left</span>
							Previous exercise
						</button>
						<button
							type="button"
							disabled={!nextExercise}
							onClick={() => nextExercise && setCurrentWorkoutExerciseId(nextExercise.id)}
						>
							Next exercise
							<span className="material-symbols-rounded">chevron_right</span>
						</button>
					</div>
				) : null}

				{workoutExercise.technicalNote ? (
					<div className="exercise-logging__note">
						<span className="material-symbols-rounded">sticky_note_2</span>
						<span>{workoutExercise.technicalNote}</span>
					</div>
				) : (
					<div className="exercise-logging__note exercise-logging__note--empty">
						<span className="material-symbols-rounded">sticky_note_2</span>
						<span>Add a technique note for this exercise</span>
					</div>
				)}

				{workoutExercise.lastTimeReference ? (
					<div className="exercise-logging__last-time">
						<div className="exercise-logging__last-time-header">
							<strong>Last time</strong> · {workoutExercise.lastTimeReference.dateLabel}
							<span className="exercise-logging__last-time-best">
								{workoutExercise.lastTimeReference.bestLabel}
							</span>
						</div>
						<div className="exercise-logging__last-time-chips">
							{workoutExercise.lastTimeReference.sets.map((s, i) => (
								<span key={i} className="exercise-logging__last-time-chip">
									<span className="material-symbols-rounded is-filled">check_circle</span>
									{s.valueLabel}
								</span>
							))}
							{workoutExercise.lastTimeReference.quote && (
								<span className="exercise-logging__last-time-quote">
									&ldquo;{workoutExercise.lastTimeReference.quote}&rdquo;
								</span>
							)}
						</div>
					</div>
				) : (
					<div
						className={`exercise-logging__no-history coach-mark-anchor${coachMarks.active && coachMarks.step === 2 ? ' coach-mark-highlight' : ''}`}
					>
						<span className="screen-empty-state__headline">No history yet</span>
						<p className="screen-empty-state__body">Today's sets become next time's reference.</p>
						{coachMarks.active && coachMarks.step < 2 && <CoachMarkBadge step={3} />}
					</div>
				)}
				{coachMarks.active && coachMarks.step === 2 && (
					<CoachMarkTooltip
						{...COACH_MARK_STEPS[2]}
						step={2}
						totalSteps={COACH_MARK_STEPS.length}
						tailPlacement="top"
						isLastStep={coachMarks.isLastStep}
						onNext={coachMarks.next}
						onSkip={coachMarks.skip}
					/>
				)}

				{(loadedSet || isDraftMode) && (
					<div className="coach-mark-anchor">
						<StepperCluster
							setPositionLabel={
								isDraftMode
									? `Set ${sets.length + 1} of ${sets.length + 1}`
									: `Set ${loadedIndex + 1} of ${sets.length}`
							}
							canPrev={isDraftMode ? sets.length > 0 : loadedIndex > 0}
							canNext={!isDraftMode}
							onPrev={() => {
								if (isDraftMode) {
									if (sets.length > 0) setLoadedSetId(sets[sets.length - 1].id);
									return;
								}
								if (loadedIndex > 0) setLoadedSetId(sets[loadedIndex - 1].id);
							}}
							onNext={() => {
								if (isDraftMode) return;
								if (loadedIndex < sets.length - 1) {
									setLoadedSetId(sets[loadedIndex + 1].id);
								} else if (loadedSet) {
									enterDraftMode(loadedSet);
								}
							}}
							primary={primaryField}
							secondary={secondaryField}
							onLog={handleLog}
							logLabel={
								isDraftMode
									? `Log set ${sets.length + 1}`
									: isEditingCompletedSet
										? `Save set ${loadedSet!.order}`
										: `Log set ${loadedSet!.order}`
							}
							logDisabled={
								isDraftMode
									? exercise.metricProfile === 'weight-reps'
										? draftValues?.weightKg === undefined || draftValues?.reps === undefined
										: draftValues?.distanceKm === undefined ||
											draftValues?.durationSec === undefined
									: exercise.metricProfile === 'weight-reps'
										? loadedSet!.weightKg === undefined || loadedSet!.reps === undefined
										: loadedSet!.distanceKm === undefined || loadedSet!.durationSec === undefined
							}
						/>
						{coachMarks.active && coachMarks.step < 1 && <CoachMarkBadge step={2} />}
					</div>
				)}
				{coachMarks.active && coachMarks.step === 1 && (
					<CoachMarkTooltip
						{...COACH_MARK_STEPS[1]}
						step={1}
						totalSteps={COACH_MARK_STEPS.length}
						tailPlacement="top"
						isLastStep={coachMarks.isLastStep}
						onNext={coachMarks.next}
						onSkip={coachMarks.skip}
					/>
				)}

				<div className="exercise-logging__set-list">
					<div className="exercise-logging__set-list-header">
						<span>Set</span>
						<span>{exercise.metricProfile === 'weight-reps' ? 'kg' : 'km'}</span>
						<span>{exercise.metricProfile === 'weight-reps' ? 'Reps' : 'min:sec'}</span>
						<span />
					</div>
					{sets.map((set) => (
						<SetRow
							key={set.id}
							order={set.order}
							state={setRowState(set, loadedSetId)}
							primaryValueLabel={
								exercise.metricProfile === 'weight-reps'
									? set.weightKg !== undefined
										? formatNumber(set.weightKg)
										: '—'
									: set.distanceKm !== undefined
										? set.distanceKm.toFixed(1)
										: '—'
							}
							secondaryValueLabel={
								exercise.metricProfile === 'weight-reps'
									? set.reps !== undefined
										? formatNumber(set.reps)
										: '—'
									: set.durationSec !== undefined
										? formatDurationSec(set.durationSec)
										: '—'
							}
							isRecord={set.isRecord}
							pendingSync={set.pendingSync}
							hasNote={Boolean(set.note)}
							onClick={() => setLoadedSetId(set.id)}
							onOpenEditor={() => setOverlay({ type: 'setEditor', setId: set.id })}
						/>
					))}
				</div>
				{coachMarks.active && coachMarks.step === 0 && (
					<CoachMarkTooltip
						{...COACH_MARK_STEPS[0]}
						step={0}
						totalSteps={COACH_MARK_STEPS.length}
						tailPlacement="top"
						isLastStep={coachMarks.isLastStep}
						onNext={coachMarks.next}
						onSkip={coachMarks.skip}
					/>
				)}

				<button type="button" className="exercise-logging__add-set" onClick={handleAddSet}>
					<span className="material-symbols-rounded">add</span>
					Add set
				</button>

				{!hasWatch && (
					<div
						className={`exercise-logging__watch-upsell coach-mark-anchor${coachMarks.active && coachMarks.step === 4 ? ' coach-mark-highlight' : ''}`}
					>
						<span className="material-symbols-rounded">watch</span>
						<span>Got a Wear OS watch? Log from your wrist</span>
						{coachMarks.active && coachMarks.step < 4 && <CoachMarkBadge step={5} />}
					</div>
				)}
				{coachMarks.active && coachMarks.step === 4 && (
					<CoachMarkTooltip
						{...COACH_MARK_STEPS[4]}
						step={4}
						totalSteps={COACH_MARK_STEPS.length}
						tailPlacement="top"
						isLastStep={coachMarks.isLastStep}
						onNext={coachMarks.next}
						onSkip={coachMarks.skip}
					/>
				)}
			</div>

			<div
				className={`exercise-logging__rest-timer coach-mark-anchor${coachMarks.active && coachMarks.step === 3 ? ' coach-mark-highlight' : ''}`}
			>
				{coachMarks.active && coachMarks.step === 3 && (
					<CoachMarkTooltip
						{...COACH_MARK_STEPS[3]}
						step={3}
						totalSteps={COACH_MARK_STEPS.length}
						tailPlacement="bottom"
						isLastStep={coachMarks.isLastStep}
						onNext={coachMarks.next}
						onSkip={coachMarks.skip}
					/>
				)}
				{coachMarks.active && coachMarks.step < 3 && <CoachMarkBadge step={4} />}
				<RestTimerBar onOpen={() => setOverlay({ type: 'restTimer' })} />
			</div>

			{overlay?.type === 'setEditor' && editorSet && (
				<SetEditorSheet
					set={editorSet}
					exercise={exercise}
					workoutLabel={workoutExercise.workoutLabel}
					onClose={() => setOverlay(null)}
					onSave={persistSet}
					onDelete={() => handleDeleteSet(editorSet.id)}
					onOpenNote={() => setOverlay({ type: 'setNote', setId: editorSet.id })}
					onOpenPlateCalculator={() => setOverlay({ type: 'plateCalculator', setId: editorSet.id })}
				/>
			)}

			{overlay?.type === 'setNote' && editorSet && (
				<SetNoteScreen
					setSummary={`${exercise.name} · ${workoutExercise.workoutLabel}`}
					initialNote={editorSet.note ?? ''}
					onSave={(note) => persistSet({ ...editorSet, note })}
					onRemove={() => persistSet({ ...editorSet, note: undefined })}
					onClose={() => setOverlay({ type: 'setEditor', setId: editorSet.id })}
				/>
			)}

			{overlay?.type === 'plateCalculator' && editorSet && (
				<PlateCalculatorSheet
					targetWeightKg={editorSet.weightKg ?? 0}
					onUseTotal={(weightKg) => persistSet({ ...editorSet, weightKg })}
					onClose={() => setOverlay({ type: 'setEditor', setId: editorSet.id })}
				/>
			)}

			{overlay?.type === 'restTimer' && (
				<RestTimerSheet
					hasWatch={hasWatch}
					notificationsDenied={!hasWatch}
					onClose={() => setOverlay(null)}
				/>
			)}
		</div>
	);
}
