// P-31 Routine detail — explains what a routine will create and provides direct start actions
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AppBar } from '../../components/ui/AppBar/AppBar';
import { Button } from '../../components/ui/Button/Button';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Surface } from '../../components/ui/Surface/Surface';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { LoggingRepository } from '../../domain/repository';
import type { Routine, RoutineSection } from '../../domain/types';
import '../screens.css';
import './plan.css';

interface RoutineDetailScreenProps {
	routineId: string;
}

interface SectionExercise {
	routineExerciseId: string;
	exerciseName: string;
	templateCount: number;
}

interface SectionDetail {
	section: RoutineSection;
	exercises: SectionExercise[];
}

interface RoutineDetail {
	routine: Routine;
	sections: SectionDetail[];
}

async function loadRoutineDetail(
	repository: LoggingRepository,
	routineId: string,
): Promise<RoutineDetail> {
	const routine = await repository.getRoutine(routineId);
	const sections = await repository.listRoutineSections(routineId);
	const sectionDetails = await Promise.all(
		sections.map(async (section) => {
			const routineExercises = await repository.listRoutineExercises(section.id);
			const exercises = await Promise.all(
				routineExercises.map(async (re) => {
					const [exercise, templates] = await Promise.all([
						repository.getExercise(re.exerciseId),
						repository.listSetTemplates(re.id),
					]);
					return {
						routineExerciseId: re.id,
						exerciseName: exercise.name,
						templateCount: templates.length,
					};
				}),
			);
			return { section, exercises };
		}),
	);
	return { routine, sections: sectionDetails };
}

export function RoutineDetailScreen({ routineId }: RoutineDetailScreenProps) {
	const repository = useLoggingRepository();
	const navigate = useNavigate();
	const [detail, setDetail] = useState<RoutineDetail | null>(null);

	const reload = useCallback(() => {
		loadRoutineDetail(repository, routineId).then(setDetail);
	}, [repository, routineId]);

	useEffect(reload, [reload]);

	if (!detail) return null;
	const { routine, sections } = detail;

	async function toggleArchived() {
		await repository.setRoutineArchived(routineId, !routine.archived);
		reload();
	}

	return (
		<div className="screen-shell">
			<AppBar
				title={routine.name}
				size="medium"
				back={{ to: '/plan' }}
				trailingContent={
					<Button
						variant="text"
						onClick={() => navigate({ to: '/plan/routine/$routineId/edit', params: { routineId } })}
					>
						Edit
					</Button>
				}
			/>
			<div className="screen-shell__content routine-screen__content">
				{routine.note && <p className="routine-screen__note">{routine.note}</p>}

				{sections.length === 0 ? (
					<EmptyState
						headline="No sections yet"
						body="Add a section with exercises in the editor before starting this routine."
						action={
							<Button
								variant="filled"
								onClick={() =>
									navigate({ to: '/plan/routine/$routineId/edit', params: { routineId } })
								}
							>
								Edit routine
							</Button>
						}
					/>
				) : (
					sections.map(({ section, exercises }) => (
						<Surface
							key={section.id}
							tone="container-low"
							radius="m"
							className="routine-section-card"
						>
							<div className="routine-section-card__header">
								<h2 className="routine-section-card__title">{section.name ?? 'Section'}</h2>
								<Button
									variant="tonal"
									disabled={exercises.length === 0}
									onClick={() =>
										navigate({
											to: '/plan/routine-section/$routineSectionId/start',
											params: { routineSectionId: section.id },
										})
									}
								>
									Start
								</Button>
							</div>
							{exercises.length === 0 ? (
								<p className="routine-screen__note">No exercises in this section yet.</p>
							) : (
								exercises.map((exercise) => (
									<div key={exercise.routineExerciseId} className="routine-section-card__exercise">
										<span className="routine-section-card__exercise-name">
											{exercise.exerciseName}
										</span>
										<span className="routine-section-card__exercise-templates">
											{exercise.templateCount} set{exercise.templateCount === 1 ? '' : 's'}
										</span>
									</div>
								))
							)}
						</Surface>
					))
				)}

				<Button variant="text" tone="error" onClick={toggleArchived}>
					{routine.archived ? 'Unarchive routine' : 'Archive routine'}
				</Button>
			</div>
		</div>
	);
}
