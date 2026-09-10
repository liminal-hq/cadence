// P-66 barbell add/edit screen — name, bar weight/unit, default toggle, and the per-side
// available-plate list, reached at /settings/plates/$barbellId with "new" as the create sentinel
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AppBar } from '../../components/ui/AppBar/AppBar';
import { SettingsRow } from './SettingsRow';
import { Chip } from '../../components/ui/Chip/Chip';
import { Switch } from '../../components/ui/Switch/Switch';
import { SegmentedControl } from '../../components/ui/SegmentedControl/SegmentedControl';
import { Button } from '../../components/ui/Button/Button';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import { useLoggingRepository } from '../../domain/RepositoryProvider';
import type { BarbellConfig, WeightUnit } from '../../domain/types';
import { formatNumber } from '../../domain/format';
import './settings.css';
import './BarbellEditorScreen.css';

interface BarbellEditorScreenProps {
	barbellId: string;
}

type Draft = Omit<BarbellConfig, 'id'>;

const BLANK_DRAFT: Draft = {
	name: '',
	barWeight: 20,
	displayUnit: 'kg',
	availablePlates: [],
	isDefault: false,
};

export function BarbellEditorScreen({ barbellId }: BarbellEditorScreenProps) {
	const isNew = barbellId === 'new';
	const navigate = useNavigate();
	const repository = useLoggingRepository();
	const [draft, setDraft] = useState<Draft | null>(isNew ? BLANK_DRAFT : null);
	const [plateInput, setPlateInput] = useState('');
	const [deleteOpen, setDeleteOpen] = useState(false);

	useEffect(() => {
		if (isNew) return;
		repository.listBarbellConfigs().then((list) => {
			const found = list.find((b) => b.id === barbellId);
			if (found) {
				const { id: _id, ...rest } = found;
				setDraft(rest);
			}
		});
	}, [repository, barbellId, isNew]);

	if (!draft) return null;

	function patch(next: Partial<Draft>) {
		setDraft((current) => (current ? { ...current, ...next } : current));
	}

	function addPlate() {
		const value = Number.parseFloat(plateInput);
		if (!Number.isFinite(value) || value <= 0) return;
		patch({ availablePlates: [...draft!.availablePlates, value].sort((a, b) => b - a) });
		setPlateInput('');
	}

	function removePlate(index: number) {
		patch({ availablePlates: draft!.availablePlates.filter((_, i) => i !== index) });
	}

	async function handleSave() {
		if (isNew) {
			await repository.addBarbellConfig(draft!);
		} else {
			await repository.updateBarbellConfig({ ...draft!, id: barbellId });
		}
		navigate({ to: '/settings/plates' });
	}

	async function handleDelete() {
		await repository.deleteBarbellConfig(barbellId);
		navigate({ to: '/settings/plates' });
	}

	return (
		<div className="settings-screen">
			<AppBar
				title={isNew ? 'Add a barbell' : draft.name || 'Edit barbell'}
				size="medium"
				back={{ to: '/settings/plates' }}
				trailingContent={
					<Button variant="text" disabled={!draft.name.trim()} onClick={handleSave}>
						Save
					</Button>
				}
			/>
			<div className="settings-screen__content">
				<section>
					<div className="settings-section__body settings-section__body--padded">
						<label className="barbell-editor__field">
							<span className="barbell-editor__label">Name</span>
							<input
								className="barbell-editor__input"
								value={draft.name}
								onChange={(event) => patch({ name: event.target.value })}
								autoFocus={isNew}
							/>
						</label>
						<label className="barbell-editor__field">
							<span className="barbell-editor__label">Bar weight</span>
							<input
								className="barbell-editor__input"
								type="number"
								min={0}
								step="0.5"
								value={draft.barWeight}
								onChange={(event) => patch({ barWeight: Number(event.target.value) })}
							/>
						</label>
						<SegmentedControl<WeightUnit>
							options={[
								{ value: 'kg', label: 'Kilograms' },
								{ value: 'lb', label: 'Pounds' },
							]}
							value={draft.displayUnit}
							onChange={(value) => patch({ displayUnit: value })}
						/>
					</div>
				</section>

				<section>
					<div className="settings-section__body">
						<SettingsRow
							icon="star"
							label="Use as default"
							trailing={
								<Switch
									checked={draft.isDefault ?? false}
									onChange={(checked) => patch({ isDefault: checked })}
									label="Use as default"
								/>
							}
						/>
					</div>
				</section>

				<section>
					<h2 className="settings-section__title">Available plates per side</h2>
					<div className="settings-section__body settings-section__body--padded">
						<div className="barbell-editor__plates">
							{draft.availablePlates.length === 0 && (
								<p className="barbell-editor__empty">No plates added yet</p>
							)}
							{draft.availablePlates.map((plate, index) => (
								<Chip
									key={`${plate}-${index}`}
									variant="input"
									label={`${formatNumber(plate)} ${draft.displayUnit}`}
									onRemove={() => removePlate(index)}
								/>
							))}
						</div>
						<div className="barbell-editor__add-plate">
							<input
								className="barbell-editor__input"
								type="number"
								min={0}
								step="0.5"
								placeholder="Plate weight"
								value={plateInput}
								onChange={(event) => setPlateInput(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === 'Enter') addPlate();
								}}
							/>
							<Button variant="tonal" onClick={addPlate}>
								Add
							</Button>
						</div>
					</div>
				</section>

				{!isNew && (
					<section>
						<div className="settings-section__body">
							<SettingsRow
								icon="delete_forever"
								label="Delete this barbell"
								tone="error"
								onClick={() => setDeleteOpen(true)}
							/>
						</div>
					</section>
				)}
			</div>

			<Dialog
				open={deleteOpen}
				onClose={() => setDeleteOpen(false)}
				headline="Delete this barbell?"
				role="dialog"
				actions={
					<>
						<Button variant="text" onClick={() => setDeleteOpen(false)}>
							Cancel
						</Button>
						<Button variant="filled" tone="error" onClick={handleDelete}>
							Delete
						</Button>
					</>
				}
			>
				<p className="barbell-editor__empty">This removes “{draft.name}” from your barbells.</p>
			</Dialog>
		</div>
	);
}
