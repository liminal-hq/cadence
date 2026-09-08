# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cadence is a modern, local-first Android training journal inspired by FitNotes, with a Wear OS companion app for logging sets without pulling out a phone. It is planned to follow Threshold's engineering patterns — Tauri v2, React/TypeScript frontend, Rust-owned domain logic and SQLite, a native Kotlin/Compose Wear OS app — while using an entirely new, purpose-built UI. See `AGENTS.md` for the authoritative contributor conventions — most importantly: **Canadian English** spelling everywhere; **Conventional Commits** for commit messages but human-readable, prefix-free **PR titles**; the Apache-2.0 OR MIT licence/copyright header on new source files (once source files exist); and **no pushes unless explicitly asked**.

## Status

This repository is currently **specification-only**. There is no application code, build tooling, or repository scaffolding yet.

- `SPEC.md` — the product, UX, data model, and platform specification. This is the current source of truth.
- `SCREENS.md` — the companion screen-and-state inventory for UI planning, derived from `SPEC.md`.
- `FitNotes Android Application — Product, UX, Data Model & Compatibility Specification.md` — the reference analysis of the FitNotes app that `SPEC.md` was derived from. It documents FitNotes' own behaviour, not Cadence's; treat it as background material, not a source of Cadence requirements.

The next step in the project is handing the UI design work to Claude Design, working from `SCREENS.md`'s screen inventory and `SPEC.md`'s product principles and design constraints (§7 "Design constraints for early UI work"). Cadence's visual design is explicitly **not** based on Threshold's — see `SPEC.md` §"Document role and sources" for what may and may not be reused from Threshold.

## Layout (planned)

No code exists yet. `AGENTS.md`'s [Repository Layout](AGENTS.md#repository-layout) section describes the planned pnpm + Cargo workspace monorepo shape (`apps/cadence`, `apps/cadence-wear`, `packages/core`, `plugins/`), mirrored from Threshold. Create it when implementation actually begins — don't scaffold speculatively.

## Commands

Not yet applicable — no build tooling exists. Once scaffolding begins, expect a command set similar to Threshold's (`pnpm dev:android`, `pnpm test`, `pnpm -r run typecheck`, `cargo test --workspace`, `cargo clippy --workspace -- -D warnings`); update this section then.

## Conventions (from AGENTS.md)

- **PR titles**: human-readable, imperative, sentence case, ~70 chars, **no Conventional Commit prefix**. Descriptions use `## Summary` + `## Test plan` (checklists, concrete commands). Every PR gets a category label (`enhancement`, `bug`, `documentation`, …) plus scope labels (`android`, `wear`, `frontend`, `backend`, `rust`, `plugin`, `data-model`, `sync`). PRs open ready for review, not as drafts.
- **Commits**: Conventional Commits with markdown bodies (what/why, `test:` for test-only changes); write bodies to a file and `git commit -F` when they contain backticks.
- **Licence headers** on new source files, once they exist: one-line summary + `(c) Copyright 2026 Liminal HQ, Scott Morris` + `SPDX-License-Identifier: Apache-2.0 OR MIT`.
- **Docs sync**: user-facing behaviour or screen/state changes update `SPEC.md` and `SCREENS.md` respectively, in the same change.
- **No hard wrapping**: write each markdown paragraph or list item as a single line and let viewers soft-wrap; deliberate short lines, one-liners, and bullets stay as-is.
- **Git**: never push (especially force-push) unless explicitly asked; prefer the `gh` CLI for GitHub work.

Keep this file and `AGENTS.md` in sync: when a convention changes there, update the summary here in the same PR.
