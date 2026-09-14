// P-34 Exercise definition editor — name, category, metric profile, note/URL, unit/increment/
// rest/graph defaults, favourite, and archive
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
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
	const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [deletePendingConfirm, setDeletePendingConfirm] = useState(false);

	useEffect(() => {
		repository.listCategories().then((all) => {
			setCategories(all);
			setValues((current) =>
				current.category ? current : { ...current, category: all[0]?.id ?? '' },
			);
		});
	}, [repository]);

	useEffect(() => {
		if (!exerciseId) return;
		repository.getExercise(exerciseId).then((exercise) => {
			setExisting(exercise);
			setValues(valuesFromExercise(exercise));
		});
		repository.listWorkoutExercisesByExercise(exerciseId).then((occurrences) => {
			setHasHistory(occurrences.length > 0);
		});
	}, [repository, exerciseId]);

	const graphMetricOptions =
		values.metricProfile === 'weight-reps'
			? WEIGHT_REPS_GRAPH_METRICS
			: DISTANCE_DURATION_GRAPH_METRICS;
	const selectedCategory = categories.find((c) => c.id === values.category);

	function handleMetricProfileChange(metricProfile: MetricProfile) {
		setValues({ ...values, metricProfile, graphDefaultMetric: undefined });
	}

	async function handleSave() {
		try {
			setError(null);
			const saved = existing
				? await repository.updateExercise(existing.id, values)
				: await repository.createExercise(values);
			navigate({ to: '/exercise-library/$exerciseId/edit', params: { exerciseId: saved.id } });
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
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
						disabled={!values.name.trim() || !values.category}
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
							{ value: 'weight-reps', label: 'Weight & reps' },
							{ value: 'distance-duration', label: 'Distance & duration' },
						]}
					/>
					{existing && hasHistory && values.metricProfile !== existing.metricProfile && (
						<Banner
							icon="info"
							tone="attention"
							message="This exercise has logged history. Changing its metric profile won't convert past sets — they'll keep their original values, just displayed under the new profile."
						/>
					)}
				</div>

				<Switch
					checked={existing?.favourite ?? false}
					onChange={(favourite) =>
						existing && repository.updateExerciseFavourite(existing.id, favourite).then(setExisting)
					}
					label="Favourite"
				/>

				<TextField
					label="Note"
					value={values.note ?? ''}
					onChange={(note) => setValues({ ...values, note })}
					multiline
				/>
				<TextField
					label="URL"
					value={values.url ?? ''}
					onChange={(url) => setValues({ ...values, url })}
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
						{categories.map((category) => (
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
		</div>
	);
}
