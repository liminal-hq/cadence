// P-32 Routine editor — name/notes, sections, exercise ordering, and the set-template editor.
// Superset grouping metadata (SPEC.md 8.4) is deliberately out of scope here: the backend already
// supports it (routine_supersets), but authoring UI for it is real, separate follow-up work.
// Set-template weight is always canonical kg, matching SetEditorSheet's own kg-only precedent —
// the lb-display variant is deferred app-wide until it's built there first.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AppBar } from '../../components/ui/AppBar/AppBar';
import { Button } from '../../components/ui/Button/Button';
import { IconButton } from '../../components/ui/IconButton/IconButton';
import { TextField } from '../../components/ui/TextField/TextField';
import { ReorderableList } from '../../components/ui/ReorderableList/ReorderableList';
import { Surface } from '../../components/ui/Surface/Surface';
import { Chip } from '../../components/ui/Chip/Chip';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { LoggingRepository } from '../../domain/repository';
import type {
	Exercise,
	MetricProfile,
	Routine,
	RoutineExercise,
	RoutineSection,
	SetTemplate,
} from '../../domain/types';
import { SEED_LAST_PERFORMANCE } from '../../domain/types';
import { formatNumber } from '../../domain/format';
import '../screens.css';
import './plan.css';

interface RoutineEditorScreenProps {
	routineId: string;
}

interface EditorExercise {
	routineExercise: RoutineExercise;
	exercise: Exercise;
	templates: SetTemplate[];
}

interface EditorSection {
	section: RoutineSection;
	exercises: EditorExercise[];
}

interface EditorState {
	routine: Routine;
	sections: EditorSection[];
}

async function loadEditorState(
	repository: LoggingRepository,
	routineId: string,
): Promise<EditorState> {
	const routine = await repository.getRoutine(routineId);
	const sections = await repository.listRoutineSections(routineId);
	const sectionStates = await Promise.all(
		sections.map(async (section) => {
			const routineExercises = await repository.listRoutineExercises(section.id);
			const exercises = await Promise.all(
				routineExercises.map(async (routineExercise) => {
					const [exercise, templates] = await Promise.all([
						repository.getExercise(routineExercise.exerciseId),
						repository.listSetTemplates(routineExercise.id),
					]);
					return { routineExercise, exercise, templates };
				}),
			);
			return { section, exercises };
		}),
	);
	return { routine, sections: sectionStates };
}

const MISSING_VALUE = '—';

function templateLabel(template: SetTemplate, metricProfile: MetricProfile): string {
	if (template.populationRule === SEED_LAST_PERFORMANCE) return 'Seeded from last performance';
	if (metricProfile === 'weight-reps') {
		const weight =
			template.weightKg == null ? MISSING_VALUE : `${formatNumber(template.weightKg)} kg`;
		const reps = template.reps == null ? MISSING_VALUE : template.reps;
		return `${weight} × ${reps}`;
	}
	const distance =
		template.distanceKm == null ? MISSING_VALUE : `${formatNumber(template.distanceKm)} km`;
	const duration = template.durationSec == null ? MISSING_VALUE : `${template.durationSec}s`;
	return `${distance} · ${duration}`;
}

interface ExercisePickerProps {
	onClose: () => void;
	onSelect: (exerciseId: string) => void;
}

function ExercisePicker({ onClose, onSelect }: ExercisePickerProps) {
	const repository = useLoggingRepository();
	const [exercises, setExercises] = useState<Exercise[]>([]);
	const [query, setQuery] = useState('');

	useEffect(() => {
		repository.listExercises().then(setExercises);
	}, [repository]);

	const filtered = exercises.filter((exercise) =>
		exercise.name.toLowerCase().includes(query.trim().toLowerCase()),
	);

	return (
		<Dialog open onClose={onClose} headline="Add exercise" role="dialog">
			<TextField label="Search" value={query} onChange={setQuery} placeholder="Exercise name" />
			<div className="routine-picker-list">
				{filtered.map((exercise) => (
					<button
						key={exercise.id}
						type="button"
						className="routine-picker-list__row"
						onClick={() => onSelect(exercise.id)}
					>
						{exercise.name}
					</button>
				))}
			</div>
		</Dialog>
	);
}

interface AddTemplateFormProps {
	metricProfile: MetricProfile;
	onAdd: (values: {
		weightKg?: number;
		reps?: number;
		distanceKm?: number;
		durationSec?: number;
		populationRule?: string;
	}) => void;
}

function AddTemplateForm({ metricProfile, onAdd }: AddTemplateFormProps) {
	const [seeded, setSeeded] = useState(false);
	const [weightKg, setWeightKg] = useState('');
	const [reps, setReps] = useState('');
	const [distanceKm, setDistanceKm] = useState('');
	const [durationSec, setDurationSec] = useState('');

	function handleAdd() {
		if (seeded) {
			onAdd({ populationRule: SEED_LAST_PERFORMANCE });
			return;
		}
		if (metricProfile === 'weight-reps') {
			onAdd({
				weightKg: weightKg ? Number(weightKg) : undefined,
				reps: reps ? Number(reps) : undefined,
			});
		} else {
			onAdd({
				distanceKm: distanceKm ? Number(distanceKm) : undefined,
				durationSec: durationSec ? Number(durationSec) : undefined,
			});
		}
		setWeightKg('');
		setReps('');
		setDistanceKm('');
		setDurationSec('');
	}

	return (
		<div className="routine-editor__template-add">
			<Chip
				variant="filter"
				label="Seed from last performance"
				selected={seeded}
				onClick={() => setSeeded((current) => !current)}
			/>
			{!seeded && metricProfile === 'weight-reps' && (
				<>
					<TextField label="kg" type="number" value={weightKg} onChange={setWeightKg} />
					<TextField label="Reps" type="number" value={reps} onChange={setReps} />
				</>
			)}
			{!seeded && metricProfile === 'distance-duration' && (
				<>
					<TextField label="km" type="number" value={distanceKm} onChange={setDistanceKm} />
					<TextField label="Seconds" type="number" value={durationSec} onChange={setDurationSec} />
				</>
			)}
			<Button variant="tonal" onClick={handleAdd}>
				Add set
			</Button>
		</div>
	);
}

export function RoutineEditorScreen({ routineId }: RoutineEditorScreenProps) {
	const repository = useLoggingRepository();
	const navigate = useNavigate();
	const [state, setState] = useState<EditorState | null>(null);
	const [pickerForSectionId, setPickerForSectionId] = useState<string | null>(null);
	const [sectionPendingDelete, setSectionPendingDelete] = useState<EditorSection | null>(null);

	const reload = useCallback(() => {
		loadEditorState(repository, routineId).then(setState);
	}, [repository, routineId]);

	useEffect(reload, [reload]);

	if (!state) return null;
	const { routine, sections } = state;

	async function handleAddSection() {
		await repository.addRoutineSection(routineId, undefined);
		reload();
	}

	async function handleReorderSections(next: EditorSection[]) {
		await repository.reorderRoutineSections(
			routineId,
			next.map((s) => s.section.id),
		);
		reload();
	}

	async function handleReorderExercises(sectionId: string, next: EditorExercise[]) {
		await repository.reorderRoutineExercises(
			sectionId,
			next.map((e) => e.routineExercise.id),
		);
		reload();
	}

	async function handleDeleteSection(editorSection: EditorSection) {
		if (editorSection.exercises.length > 0) {
			setSectionPendingDelete(editorSection);
			return;
		}
		await repository.deleteRoutineSection(editorSection.section.id);
		reload();
	}

	return (
		<div className="screen-shell">
			<AppBar title="Edit routine" size="medium" back={{ to: `/plan/routine/${routineId}` }} />
			<div className="screen-shell__content routine-screen__content">
				<TextField
					label="Name"
					value={routine.name}
					onChange={(name) => setState({ ...state, routine: { ...routine, name } })}
					onKeyDown={(event) => {
						if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
					}}
				/>
				<TextField
					label="Note"
					value={routine.note ?? ''}
					onChange={(note) => setState({ ...state, routine: { ...routine, note } })}
					multiline
				/>
				<Button
					variant="text"
					onClick={async () => {
						await repository.renameRoutine(routineId, routine.name);
						await repository.updateRoutineNote(routineId, routine.note || undefined);
					}}
				>
					Save name and note
				</Button>

				<ReorderableList
					items={sections}
					getKey={(item) => item.section.id}
					onReorder={handleReorderSections}
					renderItem={({ section, exercises }) => (
						<Surface tone="container-low" radius="m" className="routine-section-card">
							<div className="routine-section-card__header">
								<TextField
									label="Section name"
									value={section.name ?? ''}
									onChange={(name) => {
										setState({
											...state,
											sections: sections.map((s) =>
												s.section.id === section.id ? { ...s, section: { ...s.section, name } } : s,
											),
										});
									}}
									onKeyDown={(event) => {
										if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
									}}
									onBlur={() =>
										repository.renameRoutineSection(section.id, section.name || undefined)
									}
								/>
								<IconButton
									icon="delete"
									label="Delete section"
									onClick={() => handleDeleteSection({ section, exercises })}
								/>
							</div>

							<ReorderableList
								items={exercises}
								getKey={(item) => item.routineExercise.id}
								onReorder={(next) => handleReorderExercises(section.id, next)}
								renderItem={(item) => (
									<div className="routine-editor__row">
										<div className="routine-editor__row-fields">
											<span>{item.exercise.name}</span>
											{item.templates.map((template) => (
												<div key={template.id} className="routine-editor__template-row">
													<span>{templateLabel(template, item.exercise.metricProfile)}</span>
													<IconButton
														icon="close"
														label="Remove set"
														size="small"
														onClick={async () => {
															await repository.deleteSetTemplate(template.id);
															reload();
														}}
													/>
												</div>
											))}
											<AddTemplateForm
												metricProfile={item.exercise.metricProfile}
												onAdd={async (values) => {
													await repository.addSetTemplate(item.routineExercise.id, values);
													reload();
												}}
											/>
										</div>
										<IconButton
											icon="delete"
											label="Remove exercise"
											onClick={async () => {
												await repository.deleteRoutineExercise(item.routineExercise.id);
												reload();
											}}
										/>
									</div>
								)}
							/>

							<Button variant="text" icon="add" onClick={() => setPickerForSectionId(section.id)}>
								Add exercise
							</Button>
						</Surface>
					)}
				/>

				<Button variant="tonal" icon="add" onClick={handleAddSection}>
					Add section
				</Button>

				<Button
					variant="text"
					onClick={() => navigate({ to: '/plan/routine/$routineId', params: { routineId } })}
				>
					Done
				</Button>
			</div>

			{pickerForSectionId && (
				<ExercisePicker
					onClose={() => setPickerForSectionId(null)}
					onSelect={async (exerciseId) => {
						await repository.addRoutineExercise(pickerForSectionId, exerciseId);
						setPickerForSectionId(null);
						reload();
					}}
				/>
			)}

			<Dialog
				open={sectionPendingDelete != null}
				onClose={() => setSectionPendingDelete(null)}
				headline="Delete this section?"
				role="dialog"
				actions={
					<>
						<Button variant="text" onClick={() => setSectionPendingDelete(null)}>
							Cancel
						</Button>
						<Button
							variant="filled"
							tone="error"
							onClick={async () => {
								if (!sectionPendingDelete) return;
								await repository.deleteRoutineSection(sectionPendingDelete.section.id);
								setSectionPendingDelete(null);
								reload();
							}}
						>
							Delete
						</Button>
					</>
				}
			>
				<p>
					This removes {sectionPendingDelete?.exercises.length ?? 0} exercise
					{sectionPendingDelete?.exercises.length === 1 ? '' : 's'} and all of their set templates
					from this routine.
				</p>
			</Dialog>
		</div>
	);
}
