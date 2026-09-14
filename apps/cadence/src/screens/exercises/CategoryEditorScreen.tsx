// P-35 Category editor — create, rename, recolour, reorder, and archive exercise categories
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useCallback, useEffect, useState } from 'react';
import { AppBar } from '../../components/ui/AppBar/AppBar';
import { Banner } from '../../components/ui/Banner/Banner';
import { Button } from '../../components/ui/Button/Button';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import { IconButton } from '../../components/ui/IconButton/IconButton';
import { ReorderableList } from '../../components/ui/ReorderableList/ReorderableList';
import { Surface } from '../../components/ui/Surface/Surface';
import { Tag } from '../../components/ui/Tag/Tag';
import { TextField } from '../../components/ui/TextField/TextField';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { Category } from '../../domain/types';
import '../screens.css';
import './exercises.css';

function slugify(name: string): string {
	return (
		name
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'category'
	);
}

interface NewCategoryDraft {
	name: string;
	colourBackground: string;
	colourText: string;
	colourDot: string;
}

const BLANK_DRAFT: NewCategoryDraft = {
	name: '',
	colourBackground: '#e0e0e0',
	colourText: '#1a1a1a',
	colourDot: '#6b6b6b',
};

export function CategoryEditorScreen() {
	const repository = useLoggingRepository();
	const [categories, setCategories] = useState<Category[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [draft, setDraft] = useState<NewCategoryDraft | null>(null);
	const [categoryPendingDelete, setCategoryPendingDelete] = useState<Category | null>(null);

	const reload = useCallback(() => {
		repository.listCategories().then(setCategories);
	}, [repository]);

	useEffect(reload, [reload]);

	if (!categories) return null;

	async function guarded(action: () => Promise<unknown>) {
		try {
			setError(null);
			await action();
			reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	async function handleCreate() {
		if (!draft) return;
		await guarded(() =>
			repository.createCategory(
				slugify(draft.name),
				draft.name,
				draft.colourBackground,
				draft.colourText,
				draft.colourDot,
			),
		);
		setDraft(null);
	}

	return (
		<div className="screen-shell">
			<AppBar title="Categories" size="medium" back={{ to: '/settings' }} />
			<div className="screen-shell__content exercises-screen__content">
				{error && (
					<Banner icon="error" message={error} tone="attention" onDismiss={() => setError(null)} />
				)}

				<ReorderableList
					items={categories}
					getKey={(c) => c.id}
					onReorder={(next) => guarded(() => repository.reorderCategories(next.map((c) => c.id)))}
					renderItem={(category) => (
						<Surface tone="container-low" radius="m" className="category-row">
							<Tag
								label={category.archived ? `${category.name} (archived)` : category.name}
								background={category.colourBackground}
								colour={category.colourText}
							/>
							<TextField
								label="Name"
								value={category.name}
								onChange={(name) =>
									setCategories(categories.map((c) => (c.id === category.id ? { ...c, name } : c)))
								}
								onBlur={() => guarded(() => repository.renameCategory(category.id, category.name))}
							/>
							<TextField
								label="Background"
								value={category.colourBackground}
								onChange={(colourBackground) =>
									setCategories(
										categories.map((c) => (c.id === category.id ? { ...c, colourBackground } : c)),
									)
								}
								onBlur={() =>
									guarded(() =>
										repository.recolourCategory(
											category.id,
											category.colourBackground,
											category.colourText,
											category.colourDot,
										),
									)
								}
							/>
							<TextField
								label="Text"
								value={category.colourText}
								onChange={(colourText) =>
									setCategories(
										categories.map((c) => (c.id === category.id ? { ...c, colourText } : c)),
									)
								}
								onBlur={() =>
									guarded(() =>
										repository.recolourCategory(
											category.id,
											category.colourBackground,
											category.colourText,
											category.colourDot,
										),
									)
								}
							/>
							<TextField
								label="Dot"
								value={category.colourDot}
								onChange={(colourDot) =>
									setCategories(
										categories.map((c) => (c.id === category.id ? { ...c, colourDot } : c)),
									)
								}
								onBlur={() =>
									guarded(() =>
										repository.recolourCategory(
											category.id,
											category.colourBackground,
											category.colourText,
											category.colourDot,
										),
									)
								}
							/>
							<IconButton
								icon={category.archived ? 'unarchive' : 'archive'}
								label={category.archived ? 'Unarchive category' : 'Archive category'}
								onClick={() =>
									guarded(() => repository.setCategoryArchived(category.id, !category.archived))
								}
							/>
							<IconButton
								icon="delete"
								label="Delete category"
								onClick={() => setCategoryPendingDelete(category)}
							/>
						</Surface>
					)}
				/>

				{draft ? (
					<Surface tone="container-low" radius="m" className="category-row category-row--new">
						<TextField
							label="New category name"
							value={draft.name}
							onChange={(name) => setDraft({ ...draft, name })}
							autoFocus
						/>
						<TextField
							label="Background"
							value={draft.colourBackground}
							onChange={(colourBackground) => setDraft({ ...draft, colourBackground })}
						/>
						<TextField
							label="Text"
							value={draft.colourText}
							onChange={(colourText) => setDraft({ ...draft, colourText })}
						/>
						<TextField
							label="Dot"
							value={draft.colourDot}
							onChange={(colourDot) => setDraft({ ...draft, colourDot })}
						/>
						<Button variant="text" onClick={() => setDraft(null)}>
							Cancel
						</Button>
						<Button variant="filled" disabled={!draft.name.trim()} onClick={handleCreate}>
							Add category
						</Button>
					</Surface>
				) : (
					<Button variant="tonal" icon="add" onClick={() => setDraft(BLANK_DRAFT)}>
						Add category
					</Button>
				)}
			</div>

			<Dialog
				open={categoryPendingDelete != null}
				onClose={() => setCategoryPendingDelete(null)}
				headline="Delete this category?"
				role="dialog"
				actions={
					<>
						<Button variant="text" onClick={() => setCategoryPendingDelete(null)}>
							Cancel
						</Button>
						<Button
							variant="filled"
							tone="error"
							onClick={async () => {
								if (!categoryPendingDelete) return;
								await guarded(() => repository.deleteCategory(categoryPendingDelete.id));
								setCategoryPendingDelete(null);
							}}
						>
							Delete
						</Button>
					</>
				}
			>
				<p>
					This permanently removes "{categoryPendingDelete?.name}". Categories still referenced by
					an exercise can't be deleted — reassign those exercises first.
				</p>
			</Dialog>
		</div>
	);
}
