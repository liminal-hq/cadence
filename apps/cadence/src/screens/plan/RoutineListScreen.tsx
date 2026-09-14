// P-30 Plan / routine list — the Plan tab's root content (bare, no own AppBar: TabsLayout's
// shared AppShell supplies the title/top bar, same shape as TodayScreen/HistoryHubScreen)
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Chip } from '../../components/ui/Chip/Chip';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Button } from '../../components/ui/Button/Button';
import { Surface } from '../../components/ui/Surface/Surface';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { Routine } from '../../domain/types';
import './plan.css';

export function RoutineListScreen() {
	const navigate = useNavigate();
	const repository = useLoggingRepository();
	const [routines, setRoutines] = useState<Routine[]>([]);
	const [query, setQuery] = useState('');
	const [showArchived, setShowArchived] = useState(false);
	const [creating, setCreating] = useState(false);

	function reload() {
		repository.listRoutines().then(setRoutines);
	}

	useEffect(reload, [repository]);

	const filtered = routines
		.filter((r) => showArchived || !r.archived)
		.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()))
		.sort((a, b) => a.sortOrder - b.sortOrder);

	async function handleCreate() {
		setCreating(true);
		const created = await repository.createRoutine('New routine');
		setCreating(false);
		navigate({ to: '/plan/routine/$routineId/edit', params: { routineId: created.id } });
	}

	return (
		<div className="routine-list">
			<div className="routine-list__toolbar">
				<input
					className="routine-list__search"
					placeholder="Search routines"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
				<Chip
					variant="filter"
					label="Archived"
					selected={showArchived}
					onClick={() => setShowArchived((current) => !current)}
				/>
			</div>

			{filtered.length === 0 ? (
				<EmptyState
					headline={routines.length === 0 ? 'No routines yet' : 'No matching routines'}
					body={
						routines.length === 0
							? 'Create a routine to reuse a training plan without rebuilding it from scratch each time.'
							: 'Try a different search or turn off the archived filter.'
					}
					action={
						routines.length === 0 ? (
							<Button variant="filled" icon="add" disabled={creating} onClick={handleCreate}>
								Create routine
							</Button>
						) : undefined
					}
				/>
			) : (
				<>
					<div className="routine-list__items">
						{filtered.map((routine) => (
							<Surface
								key={routine.id}
								tone="container-low"
								radius="m"
								className="routine-list__row"
							>
								<button
									type="button"
									className="routine-list__row-button"
									onClick={() =>
										navigate({ to: '/plan/routine/$routineId', params: { routineId: routine.id } })
									}
								>
									<span className="routine-list__row-name">{routine.name}</span>
									{routine.archived && <span className="routine-list__row-tag">Archived</span>}
								</button>
							</Surface>
						))}
					</div>
					<Button variant="tonal" icon="add" disabled={creating} onClick={handleCreate}>
						Create routine
					</Button>
				</>
			)}
		</div>
	);
}
