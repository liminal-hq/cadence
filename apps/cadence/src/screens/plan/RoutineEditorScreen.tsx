// P-32 Routine editor — pill-tab sections, accordion exercise rows, and a draft-then-Save model
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

// Superset grouping metadata (SPEC.md 8.4) is deliberately out of scope here: the backend already supports it (routine_supersets), but authoring UI for it is real, separate follow-up work.
// Set-template weight is always canonical kg, matching SetEditorSheet's own kg-only precedent — the lb-display variant is deferred app-wide until it's built there first.
// Rep ranges are deliberately out of scope here too — SetTemplateValues.reps is a single optional integer today; a real schema change is tracked as its own follow-up PR.
// A "Replace" action for a missing exercise is also out of scope — there's no update_exercise_id on a routine exercise today, so a dangling reference can only be removed, not swapped.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from '@tanstack/react-router';
import { AppBar } from '../../components/ui/AppBar/AppBar';
import { Banner } from '../../components/ui/Banner/Banner';
import { Button } from '../../components/ui/Button/Button';
import { classNames } from '../../components/ui/classNames';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import { IconButton } from '../../components/ui/IconButton/IconButton';
import { ReorderableList } from '../../components/ui/ReorderableList/ReorderableList';
import { SegmentedControl } from '../../components/ui/SegmentedControl/SegmentedControl';
import { Surface } from '../../components/ui/Surface/Surface';
import { TextField } from '../../components/ui/TextField/TextField';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { LoggingRepository } from '../../domain/repository';
import type {
	Exercise,
	MetricProfile,
	Routine,
	RoutineExercise,
	RoutineSection,
	SetTemplate,
	SetTemplateValues,
} from '../../domain/types';
import { SEED_LAST_PERFORMANCE } from '../../domain/types';
import { formatDurationSec, formatNumber } from '../../domain/format';
import '../screens.css';
import './plan.css';

interface RoutineEditorScreenProps {
	routineId: string;
}

interface EditorExercise {
	routineExercise: RoutineExercise;
	/** `null` when the referenced exercise no longer exists in the library — rendered as a "missing exercise" row with only a Remove action, rather than blanking the whole screen. */
	exercise: Exercise | null;
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

export async function loadEditorState(
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
					try {
						const [exercise, templates] = await Promise.all([
							repository.getExercise(routineExercise.exerciseId),
							repository.listSetTemplates(routineExercise.id),
						]);
						return { routineExercise, exercise, templates };
					} catch {
						return { routineExercise, exercise: null, templates: [] };
					}
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

function exerciseSummaryLabel(exercise: Exercise, templates: SetTemplate[]): string {
	if (templates.length === 0) return 'No set templates yet';
	return templates.map((template) => templateLabel(template, exercise.metricProfile)).join(' · ');
}

type PopulationMode = 'last-time' | 'fixed' | 'blank';

function isBlankTemplate(template: SetTemplate): boolean {
	return (
		template.populationRule !== SEED_LAST_PERFORMANCE &&
		template.weightKg == null &&
		template.reps == null &&
		template.distanceKm == null &&
		template.durationSec == null
	);
}

/** Which of the three "values come from" states a set most recently added to this exercise used — a pure UI default, not persisted, since it just steers what "+ Add set" does next. */
export function defaultPopulationMode(templates: SetTemplate[]): PopulationMode {
	const last = templates[templates.length - 1];
	if (!last) return 'fixed';
	if (last.populationRule === SEED_LAST_PERFORMANCE) return 'last-time';
	return isBlankTemplate(last) ? 'blank' : 'fixed';
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

	const filtered = exercises.filter(
		(exercise) =>
			!exercise.archived && exercise.name.toLowerCase().includes(query.trim().toLowerCase()),
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

/** A non-negative, finite target value — `integer` also rejects a fractional entry, since reps and whole seconds can't be materialized as a fraction. `ok: true, value: undefined` means the field was left empty (no target given); `ok: false` means it was filled in with something invalid, which the caller must reject rather than silently persist as blank. */
function parseTarget(
	raw: string,
	{ integer }: { integer: boolean } = { integer: false },
): { ok: true; value: number | undefined } | { ok: false } {
	if (raw.trim() === '') return { ok: true, value: undefined };
	const value = Number(raw);
	if (!Number.isFinite(value) || value < 0) return { ok: false };
	if (integer && !Number.isInteger(value)) return { ok: false };
	return { ok: true, value };
}

interface AddTemplateFormProps {
	metricProfile: MetricProfile;
	mode: PopulationMode;
	onAdd: (values: SetTemplateValues) => void;
}

function AddTemplateForm({ metricProfile, mode, onAdd }: AddTemplateFormProps) {
	const [weightKg, setWeightKg] = useState('');
	const [reps, setReps] = useState('');
	const [distanceKm, setDistanceKm] = useState('');
	const [durationSec, setDurationSec] = useState('');
	const [error, setError] = useState<string | null>(null);

	function handleAdd() {
		if (mode === 'last-time') {
			onAdd({ populationRule: SEED_LAST_PERFORMANCE });
			return;
		}
		if (mode === 'blank') {
			onAdd({});
			return;
		}
		if (metricProfile === 'weight-reps') {
			const weight = parseTarget(weightKg);
			const repsResult = parseTarget(reps, { integer: true });
			if (!weight.ok || !repsResult.ok) {
				setError('Enter a non-negative number (whole number for reps).');
				return;
			}
			onAdd({ weightKg: weight.value, reps: repsResult.value });
		} else {
			const distance = parseTarget(distanceKm);
			const duration = parseTarget(durationSec, { integer: true });
			if (!distance.ok || !duration.ok) {
				setError('Enter a non-negative number (whole number for seconds).');
				return;
			}
			onAdd({ distanceKm: distance.value, durationSec: duration.value });
		}
		setError(null);
		setWeightKg('');
		setReps('');
		setDistanceKm('');
		setDurationSec('');
	}

	return (
		<div className="routine-editor__template-add">
			{mode === 'fixed' && metricProfile === 'weight-reps' && (
				<>
					<TextField label="kg" type="number" value={weightKg} onChange={setWeightKg} />
					<TextField label="Reps" type="number" value={reps} onChange={setReps} />
				</>
			)}
			{mode === 'fixed' && metricProfile === 'distance-duration' && (
				<>
					<TextField label="km" type="number" value={distanceKm} onChange={setDistanceKm} />
					<TextField label="Seconds" type="number" value={durationSec} onChange={setDurationSec} />
				</>
			)}
			<Button variant="tonal" icon="add" onClick={handleAdd}>
				Add set
			</Button>
			{error && <p className="routine-editor__template-error">{error}</p>}
		</div>
	);
}

interface Draft {
	routineName: string;
	routineNote: string;
	/** Section id → draft name. Only ever read for sections that still exist. */
	sectionNames: Record<string, string>;
	/** Routine-exercise id → draft rest override (`undefined` clears it). */
	rest: Record<string, number | undefined>;
}

function draftFromState(state: EditorState): Draft {
	const sectionNames: Record<string, string> = {};
	const rest: Record<string, number | undefined> = {};
	for (const editorSection of state.sections) {
		sectionNames[editorSection.section.id] = editorSection.section.name ?? '';
		for (const item of editorSection.exercises) {
			rest[item.routineExercise.id] = item.routineExercise.restMs;
		}
	}
	return {
		routineName: state.routine.name,
		routineNote: state.routine.note ?? '',
		sectionNames,
		rest,
	};
}

/** Adds `fresh`'s entries for any section/exercise `existing` doesn't know about yet (created by a structural op — add section, add exercise — which persist immediately and then reload), while keeping `existing`'s own values for everything it already has, so a reload never discards an in-progress, not-yet-saved edit. */
function mergeDraft(fresh: Draft, existing: Draft): Draft {
	return {
		routineName: existing.routineName,
		routineNote: existing.routineNote,
		sectionNames: { ...fresh.sectionNames, ...existing.sectionNames },
		rest: { ...fresh.rest, ...existing.rest },
	};
}

export function RoutineEditorScreen({ routineId }: RoutineEditorScreenProps) {
	const repository = useLoggingRepository();
	const [state, setState] = useState<EditorState | null>(null);
	const [draft, setDraft] = useState<Draft | null>(null);
	const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
	const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
	const [populationModeByExercise, setPopulationModeByExercise] = useState<
		Record<string, PopulationMode>
	>({});
	const [restEditingId, setRestEditingId] = useState<string | null>(null);
	const [pickerForSectionId, setPickerForSectionId] = useState<string | null>(null);
	const [sectionPendingDelete, setSectionPendingDelete] = useState<EditorSection | null>(null);
	const [exercisePendingDelete, setExercisePendingDelete] = useState<EditorExercise | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	// A brand-new draft's baseline is the just-loaded values — a ref, not state, so the router's dirty blocker (see ExerciseEditorScreen's own note on this exact pattern) can read the latest baseline even from a stale render's closure.
	const baselineRef = useRef<Draft | null>(null);
	const skipNextBlockRef = useRef(false);

	const reload = useCallback(() => {
		loadEditorState(repository, routineId).then((loaded) => {
			setState(loaded);
			const fresh = draftFromState(loaded);
			setDraft((current) => (current ? mergeDraft(fresh, current) : fresh));
			baselineRef.current = baselineRef.current ? mergeDraft(fresh, baselineRef.current) : fresh;
		});
	}, [repository, routineId]);

	useEffect(reload, [reload]);

	useEffect(() => {
		if (!state) return;
		setActiveSectionId((current) => {
			if (current && state.sections.some((s) => s.section.id === current)) return current;
			return state.sections[0]?.section.id ?? null;
		});
	}, [state]);

	const isDirty = Boolean(
		draft && baselineRef.current && JSON.stringify(draft) !== JSON.stringify(baselineRef.current),
	);

	// Blocks every navigation path away from a dirty draft, not just the app bar's back button — predictive back and hardware/browser back both go through the router's history, same as this.
	const blocker = useBlocker({
		shouldBlockFn: () => {
			if (skipNextBlockRef.current) {
				skipNextBlockRef.current = false;
				return false;
			}
			return isDirty;
		},
		withResolver: true,
	});

	if (!state || !draft) return null;
	const { routine, sections } = state;
	const activeSection = sections.find((s) => s.section.id === activeSectionId) ?? null;

	async function handleAddSection() {
		const created = await repository.addRoutineSection(routineId, undefined);
		setActiveSectionId(created.id);
		reload();
	}

	async function handleReorderSections(next: EditorSection[]) {
		setState({ routine, sections: next });
		await repository.reorderRoutineSections(
			routineId,
			next.map((s) => s.section.id),
		);
		reload();
	}

	async function handleReorderExercises(sectionId: string, next: EditorExercise[]) {
		setState({
			routine,
			sections: sections.map((s) => (s.section.id === sectionId ? { ...s, exercises: next } : s)),
		});
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

	async function handleDeleteExercise(editorExercise: EditorExercise) {
		if (editorExercise.templates.length > 0) {
			setExercisePendingDelete(editorExercise);
			return;
		}
		await repository.deleteRoutineExercise(editorExercise.routineExercise.id);
		reload();
	}

	async function handleSave() {
		if (saving || !draft) return;
		const currentDraft = draft;
		setSaving(true);
		setSaveError(null);
		try {
			const tasks: Promise<unknown>[] = [];
			if (currentDraft.routineName !== routine.name) {
				tasks.push(repository.renameRoutine(routineId, currentDraft.routineName));
			}
			const draftNote =
				currentDraft.routineNote.trim() === '' ? undefined : currentDraft.routineNote;
			if (draftNote !== (routine.note ?? undefined)) {
				tasks.push(repository.updateRoutineNote(routineId, draftNote));
			}
			for (const editorSection of sections) {
				const draftName = currentDraft.sectionNames[editorSection.section.id];
				if (draftName !== undefined && draftName !== (editorSection.section.name ?? '')) {
					tasks.push(
						repository.renameRoutineSection(editorSection.section.id, draftName || undefined),
					);
				}
				for (const item of editorSection.exercises) {
					const draftRest = currentDraft.rest[item.routineExercise.id];
					if (draftRest !== item.routineExercise.restMs) {
						tasks.push(repository.updateRoutineExerciseRest(item.routineExercise.id, draftRest));
					}
				}
			}
			await Promise.all(tasks);
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : String(err));
			return;
		} finally {
			setSaving(false);
		}
		baselineRef.current = currentDraft;
		reload();
	}

	return (
		<div className="screen-shell">
			<AppBar
				title="Edit routine"
				size="medium"
				back={{ to: `/plan/routine/${routineId}` }}
				trailingContent={
					<Button variant="text" onClick={handleSave} disabled={!isDirty || saving}>
						Save
					</Button>
				}
			/>
			<div className="screen-shell__content routine-screen__content">
				{isDirty && <p className="routine-editor__unsaved">Unsaved changes</p>}
				{saveError && (
					<Banner
						icon="error"
						tone="attention"
						message={saveError}
						onDismiss={() => setSaveError(null)}
					/>
				)}

				<TextField
					label="Name"
					value={draft.routineName}
					onChange={(routineName) => setDraft({ ...draft, routineName })}
				/>
				<TextField
					label="Note"
					value={draft.routineNote}
					onChange={(routineNote) => setDraft({ ...draft, routineNote })}
					multiline
				/>

				<div className="routine-editor__tabs">
					<ReorderableList
						items={sections}
						getKey={(item) => item.section.id}
						getLabel={(item) => item.section.name || 'Section'}
						onReorder={handleReorderSections}
						orientation="horizontal"
						showHandle={false}
						renderItem={(item) => (
							<button
								type="button"
								className={classNames(
									'routine-editor__tab',
									item.section.id === activeSectionId && 'routine-editor__tab--active',
								)}
								onClick={() => setActiveSectionId(item.section.id)}
							>
								{item.section.name || 'Section'}
							</button>
						)}
					/>
					<button
						type="button"
						className="routine-editor__tab routine-editor__tab--add"
						onClick={handleAddSection}
					>
						<span className="material-symbols-rounded" aria-hidden="true">
							add
						</span>
						Section
					</button>
				</div>

				{activeSection && (
					<Surface tone="container-low" radius="m" className="routine-section-card">
						<div className="routine-section-card__header">
							<TextField
								label="Section name"
								value={draft.sectionNames[activeSection.section.id] ?? ''}
								onChange={(name) =>
									setDraft({
										...draft,
										sectionNames: { ...draft.sectionNames, [activeSection.section.id]: name },
									})
								}
							/>
							<IconButton
								icon="delete"
								label="Delete section"
								onClick={() => handleDeleteSection(activeSection)}
							/>
						</div>

						<ReorderableList
							items={activeSection.exercises}
							getKey={(item) => item.routineExercise.id}
							getLabel={(item) => item.exercise?.name ?? 'Missing exercise'}
							onReorder={(next) => handleReorderExercises(activeSection.section.id, next)}
							renderItem={(item, index) => {
								if (!item.exercise) {
									return (
										<div className="routine-editor__row routine-editor__row--missing">
											<span className="routine-editor__row-order">{index + 1}</span>
											<div className="routine-editor__row-body">
												<span className="routine-editor__row-name">Missing exercise</span>
												<span className="routine-editor__row-error">
													Deleted from library · remove it from this section
												</span>
											</div>
											<Button
												variant="text"
												tone="error"
												onClick={() => handleDeleteExercise(item)}
											>
												Remove
											</Button>
										</div>
									);
								}

								const exercise = item.exercise;
								const expanded = expandedExerciseId === item.routineExercise.id;
								const mode =
									populationModeByExercise[item.routineExercise.id] ??
									defaultPopulationMode(item.templates);
								const restMs = draft.rest[item.routineExercise.id];

								if (!expanded) {
									return (
										<button
											type="button"
											className="routine-editor__row"
											onClick={() => setExpandedExerciseId(item.routineExercise.id)}
										>
											<span className="routine-editor__row-order">{index + 1}</span>
											<div className="routine-editor__row-body">
												<span className="routine-editor__row-name">{exercise.name}</span>
												<span className="routine-editor__row-summary">
													{exerciseSummaryLabel(exercise, item.templates)}
												</span>
											</div>
										</button>
									);
								}

								return (
									<div className="routine-editor__row routine-editor__row--expanded">
										<div className="routine-editor__row-header">
											<span className="routine-editor__row-order">{index + 1}</span>
											<span className="routine-editor__row-name">{exercise.name}</span>
											<IconButton
												icon="expand_less"
												label="Collapse"
												size="small"
												onClick={() => setExpandedExerciseId(null)}
											/>
										</div>

										<div className="routine-editor__population">
											<span className="routine-editor__population-label">Values come from</span>
											<SegmentedControl
												value={mode}
												onChange={(next) =>
													setPopulationModeByExercise({
														...populationModeByExercise,
														[item.routineExercise.id]: next,
													})
												}
												options={[
													{ value: 'last-time', label: 'Last time' },
													{ value: 'fixed', label: 'Fixed' },
													{ value: 'blank', label: 'Blank' },
												]}
											/>
										</div>

										{item.templates.length > 0 && (
											<div className="routine-editor__templates">
												{item.templates.map((template, templateIndex) => (
													<div key={template.id} className="routine-editor__template-row">
														<span className="routine-editor__template-index">
															{templateIndex + 1}
														</span>
														<span>{templateLabel(template, exercise.metricProfile)}</span>
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
											</div>
										)}

										<div className="routine-editor__row-footer">
											<AddTemplateForm
												metricProfile={exercise.metricProfile}
												mode={mode}
												onAdd={async (values) => {
													await repository.addSetTemplate(item.routineExercise.id, values);
													reload();
												}}
											/>
											{item.templates.length > 0 && (
												<button
													type="button"
													className="routine-editor__duplicate-last"
													onClick={async () => {
														const last = item.templates[item.templates.length - 1];
														await repository.addSetTemplate(item.routineExercise.id, {
															weightKg: last.weightKg,
															reps: last.reps,
															distanceKm: last.distanceKm,
															durationSec: last.durationSec,
															populationRule: last.populationRule,
														});
														reload();
													}}
												>
													Duplicate last set
												</button>
											)}
										</div>

										<div className="routine-editor__rest-row">
											{restEditingId === item.routineExercise.id ? (
												<>
													<TextField
														label="Rest override (seconds)"
														type="number"
														value={restMs != null ? String(Math.round(restMs / 1000)) : ''}
														onChange={(raw) =>
															setDraft({
																...draft,
																rest: {
																	...draft.rest,
																	[item.routineExercise.id]:
																		raw.trim() === '' ? undefined : Math.round(Number(raw) * 1000),
																},
															})
														}
													/>
													<Button variant="text" onClick={() => setRestEditingId(null)}>
														Done
													</Button>
												</>
											) : (
												<span className="routine-editor__rest-label">
													{restMs != null
														? `Rest ${formatDurationSec(restMs / 1000)}`
														: 'No rest override'}{' '}
													·{' '}
													<button
														type="button"
														className="routine-editor__rest-change"
														onClick={() => setRestEditingId(item.routineExercise.id)}
													>
														change
													</button>
												</span>
											)}
										</div>

										<IconButton
											icon="delete"
											label="Remove exercise"
											onClick={() => handleDeleteExercise(item)}
										/>
									</div>
								);
							}}
						/>

						<Button
							variant="text"
							icon="add"
							onClick={() => setPickerForSectionId(activeSection.section.id)}
						>
							Add exercise
						</Button>
					</Surface>
				)}
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
					Removes {sectionPendingDelete?.exercises.length ?? 0} exercise
					{sectionPendingDelete?.exercises.length === 1 ? '' : 's'} and their set templates. Logged
					workouts are <b>not</b> changed.
				</p>
			</Dialog>

			<Dialog
				open={exercisePendingDelete != null}
				onClose={() => setExercisePendingDelete(null)}
				headline="Remove this exercise?"
				role="dialog"
				actions={
					<>
						<Button variant="text" onClick={() => setExercisePendingDelete(null)}>
							Cancel
						</Button>
						<Button
							variant="filled"
							tone="error"
							onClick={async () => {
								if (!exercisePendingDelete) return;
								await repository.deleteRoutineExercise(exercisePendingDelete.routineExercise.id);
								setExercisePendingDelete(null);
								reload();
							}}
						>
							Remove
						</Button>
					</>
				}
			>
				<p>
					This removes {exercisePendingDelete?.exercise?.name ?? 'this exercise'} and its{' '}
					{exercisePendingDelete?.templates.length ?? 0} set
					{exercisePendingDelete?.templates.length === 1 ? '' : 's'} from this section.
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
				<p>Your unsaved changes to this routine will be lost.</p>
			</Dialog>
		</div>
	);
}
