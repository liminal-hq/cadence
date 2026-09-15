// P-34 Exercise definition editor — name, category, metric profile, note/URL, unit/increment/rest/graph defaults, favourite, and archive
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate } from '@tanstack/react-router';
import { AppBar } from '../../components/ui/AppBar/AppBar';
import { Banner } from '../../components/ui/Banner/Banner';
import { Button } from '../../components/ui/Button/Button';
import { Chip } from '../../components/ui/Chip/Chip';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import { SegmentedControl } from '../../components/ui/SegmentedControl/SegmentedControl';
import { Switch } from '../../components/ui/Switch/Switch';
import { TextField } from '../../components/ui/TextField/TextField';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { Category, Exercise, ExerciseValues, MetricProfile } from '../../domain/types';
import '../screens.css';
import './exercises.css';

interface ExerciseEditorScreenProps {
	exerciseId?: string;
	initialName?: string;
}

const WEIGHT_REPS_GRAPH_METRICS = [
	{ value: 'weight', label: 'Weight' },
	{ value: 'estimated-1rm', label: 'Est. 1RM' },
	{ value: 'volume', label: 'Volume' },
];

const DISTANCE_DURATION_GRAPH_METRICS = [
	{ value: 'distance', label: 'Distance' },
	{ value: 'pace', label: 'Pace' },
];

function valuesFromExercise(exercise: Exercise): ExerciseValues {
	const {
		name,
		category,
		metricProfile,
		note,
		url,
		weightIncrementKg,
		repsIncrement,
		distanceIncrementKm,
		durationIncrementSec,
		restDefaultMs,
		graphDefaultMetric,
	} = exercise;
	return {
		name,
		category,
		metricProfile,
		note,
		url,
		weightIncrementKg,
		repsIncrement,
		distanceIncrementKm,
		durationIncrementSec,
		restDefaultMs,
		graphDefaultMetric,
	};
}

const BLANK_VALUES: ExerciseValues = {
	name: '',
	category: '',
	metricProfile: 'weight-reps',
};

export function ExerciseEditorScreen({ exerciseId, initialName }: ExerciseEditorScreenProps) {
	const repository = useLoggingRepository();
	const navigate = useNavigate();
	const [categories, setCategories] = useState<Category[]>([]);
	const [existing, setExisting] = useState<Exercise | null>(null);
	const [values, setValues] = useState<ExerciseValues>({
		...BLANK_VALUES,
		name: initialName ?? '',
	});
	const [hasHistory, setHasHistory] = useState(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);
	const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [deletePendingConfirm, setDeletePendingConfirm] = useState(false);
	const [draftFavourite, setDraftFavourite] = useState(false);
	// Stays false forever on a failed lookup, not just while pending — Save must never be allowed
	// to treat an existing exercise it couldn't confirm as a brand-new one.
	const [existingLoaded, setExistingLoaded] = useState(!exerciseId);
	const baselineRef = useRef<{ values: ExerciseValues; favourite: boolean } | null>(null);

	useEffect(() => {
		repository.listCategories().then((all) => {
			setCategories(all);
			setValues((current) => {
				if (current.category) return current;
				const next = { ...current, category: all.find((c) => !c.archived)?.id ?? '' };
				if (!exerciseId) baselineRef.current = { values: next, favourite: false };
				return next;
			});
		});
	}, [repository, exerciseId]);

	useEffect(() => {
		if (!exerciseId) return;
		repository
			.getExercise(exerciseId)
			.then((exercise) => {
				setExisting(exercise);
				const loaded = valuesFromExercise(exercise);
				setValues(loaded);
				baselineRef.current = { values: loaded, favourite: exercise.favourite ?? false };
				setExistingLoaded(true);
			})
			.catch((err) => setError(err instanceof Error ? err.message : String(err)));
		repository.listWorkoutExercisesByExercise(exerciseId).then((occurrences) => {
			setHasHistory(occurrences.length > 0);
			setHistoryLoaded(true);
		});
	}, [repository, exerciseId]);

	const currentFavourite = existing ? (existing.favourite ?? false) : draftFavourite;
	const isDirty = Boolean(
		baselineRef.current &&
		(JSON.stringify(values) !== JSON.stringify(baselineRef.current.values) ||
			currentFavourite !== baselineRef.current.favourite),
	);

	// Blocks every navigation path away from a dirty draft, not just the app bar's back button —
	// predictive back and hardware/browser back both go through the router's history, same as this.
	const blocker = useBlocker({ shouldBlockFn: () => isDirty, withResolver: true });

	const graphMetricOptions =
		values.metricProfile === 'weight-reps'
			? WEIGHT_REPS_GRAPH_METRICS
			: DISTANCE_DURATION_GRAPH_METRICS;
	const selectedCategory = categories.find((c) => c.id === values.category);
	const availableCategories = categories.filter((c) => !c.archived || c.id === values.category);
	// Locked (pessimistically) until the history check resolves, so a fast typist can't change the profile in the window before we know whether this exercise actually has logged history.
	const metricProfileLocked = Boolean(existing && (!historyLoaded || hasHistory));

	function handleMetricProfileChange(metricProfile: MetricProfile) {
		if (metricProfileLocked) return;
		setValues({ ...values, metricProfile, graphDefaultMetric: undefined });
	}

	async function handleSave() {
		let saved: Exercise;
		const wasExisting = existing;
		try {
			setError(null);
			saved = existing
				? await repository.updateExercise(existing.id, values)
				: await repository.createExercise(values);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			return;
		}
		// The exercise itself is already persisted at this point — everything below reflects that,
		// even if the favourite follow-up call below fails, so a transient error there can't strand
		// the UI on a blank "New exercise" form pointing at an exercise that already exists.
		setExisting(saved);
		const savedValues = valuesFromExercise(saved);
		// The backend can normalize values on save (trimming, rounding an increment to its
		// canonical unit) — sync the controlled form to that normalized result too, not just the
		// dirty-check baseline, so a successful save doesn't leave the form still reporting
		// unsaved changes.
		setValues(savedValues);
		baselineRef.current = { values: savedValues, favourite: saved.favourite ?? false };
		if (!wasExisting) {
			navigate({ to: '/exercise-library/$exerciseId/edit', params: { exerciseId: saved.id } });
		}
		if (!wasExisting && draftFavourite) {
			try {
				const withFavourite = await repository.updateExerciseFavourite(saved.id, true);
				setExisting(withFavourite);
				baselineRef.current.favourite = withFavourite.favourite ?? false;
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		}
	}

	async function handleArchiveToggle() {
		if (!existing) return;
		try {
			setError(null);
			const updated = await repository.setExerciseArchived(existing.id, !existing.archived);
			setExisting(updated);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	async function handleDelete() {
		if (!existing) return;
		try {
			setError(null);
			await repository.deleteExercise(existing.id);
			navigate({ to: '/exercise-library' });
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	return (
		<div className="screen-shell">
			<AppBar
				title={existing ? existing.name : 'New exercise'}
				size="medium"
				back={{ to: '/exercise-library' }}
				trailingContent={
					<Button
						variant="text"
						disabled={!values.name.trim() || !values.category || !existingLoaded}
						onClick={handleSave}
					>
						Save
					</Button>
				}
			/>
			<div className="screen-shell__content exercise-editor__content">
				{error && (
					<Banner icon="error" message={error} tone="attention" onDismiss={() => setError(null)} />
				)}

				<TextField
					label="Name"
					value={values.name}
					onChange={(name) => setValues({ ...values, name })}
				/>

				<div className="exercise-editor__field-group">
					<span>Category</span>
					<Chip
						variant="assist"
						label={selectedCategory?.name ?? 'Choose a category'}
						onClick={() => setCategoryPickerOpen(true)}
					/>
				</div>

				<div className="exercise-editor__field-group">
					<span>Metric profile</span>
					<SegmentedControl
						value={values.metricProfile}
						onChange={handleMetricProfileChange}
						options={[
							{
								value: 'weight-reps',
								label: 'Weight & reps',
								disabled: metricProfileLocked && values.metricProfile !== 'weight-reps',
							},
							{
								value: 'distance-duration',
								label: 'Distance & duration',
								disabled: metricProfileLocked && values.metricProfile !== 'distance-duration',
							},
						]}
					/>
					{metricProfileLocked && (
						<Banner
							icon="info"
							tone="attention"
							message="This exercise has logged history, so its metric profile can't change — create a new exercise instead if you need the other profile."
						/>
					)}
				</div>

				<Switch
					checked={currentFavourite}
					onChange={(favourite) =>
						existing
							? repository.updateExerciseFavourite(existing.id, favourite).then((updated) => {
									setExisting(updated);
									if (baselineRef.current) baselineRef.current.favourite = favourite;
								})
							: setDraftFavourite(favourite)
					}
					label="Favourite"
				/>

				<TextField
					label="Note"
					value={values.note ?? ''}
					onChange={(note) => setValues({ ...values, note: note.trim() === '' ? undefined : note })}
					multiline
				/>
				<TextField
					label="URL"
					value={values.url ?? ''}
					onChange={(url) => setValues({ ...values, url: url.trim() === '' ? undefined : url })}
				/>
				<TextField
					label="Default rest (seconds)"
					type="number"
					value={
						values.restDefaultMs != null ? String(Math.round(values.restDefaultMs / 1000)) : ''
					}
					onChange={(raw) =>
						setValues({
							...values,
							restDefaultMs: raw.trim() === '' ? undefined : Math.round(Number(raw) * 1000),
						})
					}
				/>

				{values.metricProfile === 'weight-reps' ? (
					<>
						<TextField
							label="Weight increment (kg, default 2.5)"
							type="number"
							step={0.5}
							value={values.weightIncrementKg != null ? String(values.weightIncrementKg) : ''}
							onChange={(raw) =>
								setValues({
									...values,
									weightIncrementKg: raw.trim() === '' ? undefined : Number(raw),
								})
							}
						/>
						<TextField
							label="Reps increment (default 1)"
							type="number"
							step={1}
							value={values.repsIncrement != null ? String(values.repsIncrement) : ''}
							onChange={(raw) =>
								setValues({
									...values,
									repsIncrement: raw.trim() === '' ? undefined : Number(raw),
								})
							}
						/>
					</>
				) : (
					<>
						<TextField
							label="Distance increment (km, default 0.1)"
							type="number"
							step={0.1}
							value={values.distanceIncrementKm != null ? String(values.distanceIncrementKm) : ''}
							onChange={(raw) =>
								setValues({
									...values,
									distanceIncrementKm: raw.trim() === '' ? undefined : Number(raw),
								})
							}
						/>
						<TextField
							label="Duration increment (seconds, default 10)"
							type="number"
							step={5}
							value={values.durationIncrementSec != null ? String(values.durationIncrementSec) : ''}
							onChange={(raw) =>
								setValues({
									...values,
									durationIncrementSec: raw.trim() === '' ? undefined : Number(raw),
								})
							}
						/>
					</>
				)}

				<div className="exercise-editor__field-group">
					<span>Default graph metric</span>
					<div className="exercise-editor__chip-row">
						{graphMetricOptions.map((option) => (
							<Chip
								key={option.value}
								variant="filter"
								label={option.label}
								selected={values.graphDefaultMetric === option.value}
								onClick={() =>
									setValues({
										...values,
										graphDefaultMetric:
											values.graphDefaultMetric === option.value ? undefined : option.value,
									})
								}
							/>
						))}
					</div>
				</div>

				{existing && (
					<>
						<Button variant="text" tone="error" onClick={handleArchiveToggle}>
							{existing.archived ? 'Unarchive exercise' : 'Archive exercise'}
						</Button>
						<Button variant="text" tone="error" onClick={() => setDeletePendingConfirm(true)}>
							Delete exercise
						</Button>
					</>
				)}
			</div>

			{categoryPickerOpen && (
				<Dialog
					open
					onClose={() => setCategoryPickerOpen(false)}
					headline="Choose a category"
					role="dialog"
				>
					<div className="routine-picker-list">
						{availableCategories.map((category) => (
							<button
								key={category.id}
								type="button"
								className="routine-picker-list__row"
								onClick={() => {
									setValues({ ...values, category: category.id });
									setCategoryPickerOpen(false);
								}}
							>
								{category.name}
							</button>
						))}
					</div>
				</Dialog>
			)}

			<Dialog
				open={deletePendingConfirm}
				onClose={() => setDeletePendingConfirm(false)}
				headline="Delete this exercise?"
				role="dialog"
				actions={
					<>
						<Button variant="text" onClick={() => setDeletePendingConfirm(false)}>
							Cancel
						</Button>
						<Button
							variant="filled"
							tone="error"
							onClick={async () => {
								await handleDelete();
								setDeletePendingConfirm(false);
							}}
						>
							Delete
						</Button>
					</>
				}
			>
				<p>
					This permanently removes "{existing?.name}". Exercises still referenced by a workout,
					routine, or goal can't be deleted — archive it instead.
				</p>
			</Dialog>

			<Dialog
				open={blocker.status === 'blocked'}
				onClose={() => blocker.reset?.()}
				headline="Discard changes?"
				role="dialog"
				actions={
					<>
						<Button variant="text" onClick={() => blocker.reset?.()}>
							Cancel
						</Button>
						<Button variant="filled" tone="error" onClick={() => blocker.proceed?.()}>
							Discard
						</Button>
					</>
				}
			>
				<p>Your unsaved changes to this exercise will be lost.</p>
			</Dialog>
		</div>
	);
}
