// P-35 Category editor — create, rename, recolour, reorder, and archive exercise categories
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useCallback, useEffect, useState } from 'react';
import { AppBar } from '../../components/ui/AppBar/AppBar';
import { Banner } from '../../components/ui/Banner/Banner';
import { Button } from '../../components/ui/Button/Button';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { IconButton } from '../../components/ui/IconButton/IconButton';
import { ReorderableList } from '../../components/ui/ReorderableList/ReorderableList';
import { Surface } from '../../components/ui/Surface/Surface';
import { Tag } from '../../components/ui/Tag/Tag';
import { TextField } from '../../components/ui/TextField/TextField';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { Category } from '../../domain/types';
import { isLowContrast } from './colourContrast';
import '../screens.css';
import './exercises.css';

const LOW_CONTRAST_WARNING = 'This background and text colour are hard to read together.';

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
		repository.listCategories().then(setCategories, (err) => {
			setError(err instanceof Error ? err.message : String(err));
		});
	}, [repository]);

	useEffect(reload, [reload]);

	// A rejected initial load previously left this screen blank forever -- `categories` never
	// left `null`, so the render bailed out here on every re-render with no way to retry or even
	// see that anything had gone wrong.
	if (!categories) {
		if (error) {
			return (
				<div className="screen-shell">
					<AppBar title="Categories" size="medium" back={{ to: '/settings' }} />
					<div className="screen-shell__content exercises-screen__content">
						<EmptyState
							headline="Couldn't load categories"
							body={error}
							action={
								<Button
									variant="filled"
									onClick={() => {
										setError(null);
										reload();
									}}
								>
									Try again
								</Button>
							}
						/>
					</div>
				</div>
			);
		}
		return null;
	}

	async function guarded(action: () => Promise<unknown>): Promise<boolean> {
		try {
			setError(null);
			await action();
			reload();
			return true;
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			return false;
		}
	}

	// Merges only the fields `action` actually saved into that one row, rather than reload()'s full
	// re-fetch of every category — a blur-triggered save that lands while the user has already
	// tabbed into and started editing a sibling field on the same row must not overwrite that
	// in-progress edit.
	async function saveCategoryField(
		action: () => Promise<Category>,
		patch: (updated: Category) => Partial<Category>,
	) {
		try {
			setError(null);
			const updated = await action();
			setCategories(
				(current) =>
					current?.map((c) => (c.id === updated.id ? { ...c, ...patch(updated) } : c)) ?? current,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	function saveCategoryName(category: Category) {
		if (!category.name.trim()) {
			setError('Enter a category name.');
			reload();
			return;
		}
		saveCategoryField(
			() => repository.renameCategory(category.id, category.name),
			(updated) => ({ name: updated.name }),
		);
	}

	async function handleCreate() {
		if (!draft) return;
		// Only clear the draft on success -- a rejected create (e.g. a duplicate name) previously
		// discarded the user's name and colour choices anyway, forcing them to re-enter everything
		// on top of reading the error banner.
		const created = await guarded(() =>
			repository.createCategory(
				slugify(draft.name),
				draft.name,
				draft.colourBackground,
				draft.colourText,
				draft.colourDot,
			),
		);
		if (created) setDraft(null);
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
					getLabel={(c) => c.name}
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
								onBlur={() => saveCategoryName(category)}
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
									// Patches only this one field from the response, not all three -- this
									// request's payload is a snapshot of colourText/colourDot taken when this
									// field blurred, so echoing them back could stomp a same-row sibling field
									// the user has since started (but not yet finished) editing.
									saveCategoryField(
										() =>
											repository.recolourCategory(
												category.id,
												category.colourBackground,
												category.colourText,
												category.colourDot,
											),
										(updated) => ({ colourBackground: updated.colourBackground }),
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
									saveCategoryField(
										() =>
											repository.recolourCategory(
												category.id,
												category.colourBackground,
												category.colourText,
												category.colourDot,
											),
										(updated) => ({ colourText: updated.colourText }),
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
									saveCategoryField(
										() =>
											repository.recolourCategory(
												category.id,
												category.colourBackground,
												category.colourText,
												category.colourDot,
											),
										(updated) => ({ colourDot: updated.colourDot }),
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
							{isLowContrast(category.colourBackground, category.colourText) && (
								<span className="category-row__contrast-warning">{LOW_CONTRAST_WARNING}</span>
							)}
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
						{isLowContrast(draft.colourBackground, draft.colourText) && (
							<span className="category-row__contrast-warning">{LOW_CONTRAST_WARNING}</span>
						)}
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
