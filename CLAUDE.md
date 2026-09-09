# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cadence is a modern, local-first Android training journal inspired by FitNotes, with a Wear OS companion app for logging sets without pulling out a phone. It is planned to follow Threshold's engineering patterns — Tauri v2, React/TypeScript frontend, Rust-owned domain logic and SQLite, a native Kotlin/Compose Wear OS app — while using an entirely new, purpose-built UI. See `AGENTS.md` for the authoritative contributor conventions — most importantly: **Canadian English** spelling everywhere; **Conventional Commits** for commit messages but human-readable, prefix-free **PR titles**; the Apache-2.0 OR MIT licence/copyright header on new source files (once source files exist); and **no pushes unless explicitly asked**.

## Status

Cadence has moved past specification-only. `apps/cadence` is scaffolded: Tauri v2 + React/TypeScript frontend (Bun-managed, not pnpm), a desktop-only title bar ported from Threshold, M3 design tokens lifted from the Claude Design handoff, and a shared app shell (top app bar + bottom navigation across the four primary destinations). Only Today has a real screen so far; History/Plan/Progress are wired-up placeholders. There's no Rust domain logic/SQLite yet and no Android/Wear OS build.

- `SPEC.md` — the product, UX, data model, and platform specification. This is the current source of truth.
- `SCREENS.md` — the companion screen-and-state inventory for UI planning, derived from `SPEC.md`.
- `FitNotes Android Application — Product, UX, Data Model & Compatibility Specification.md` — the reference analysis of the FitNotes app that `SPEC.md` was derived from. It documents FitNotes' own behaviour, not Cadence's; treat it as background material, not a source of Cadence requirements.

The UI design work itself is done: a Claude Design handoff (Foundations canvas + seven per-journey canvases covering the full `SCREENS.md` inventory) is the source of truth for tokens and remaining screens, which get built one at a time from here. Cadence's visual design is explicitly **not** based on Threshold's — see `SPEC.md` §"Document role and sources" for what may and may not be reused from Threshold.

## Layout

`AGENTS.md`'s [Repository Layout](AGENTS.md#repository-layout) section is authoritative. `apps/cadence` is scaffolded; `apps/cadence-wear`, `packages/core`, and `plugins/` remain planned — don't scaffold those speculatively, only when there's a concrete need.

## Commands

- `bun install` — install workspace dependencies.
- `bun run --filter @liminal-hq/cadence tauri dev` (or `cd apps/cadence && bun run tauri dev`) — launch the desktop app.
- `bun run build` — typecheck and build the frontend.
- `bun run test:js` — run the frontend test suite (`bun run test:js:ci` for the junit-reporting CI variant).
- `bun run format` / `bun run format:check` — Prettier.
- `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings`, `cargo nextest run --workspace --config-file nextest.toml --profile ci` — Rust checks (via the `ghcr.io/liminal-hq/tauri-dev-desktop:latest` image per `AGENTS.md`'s Local Tooling note if `cargo` isn't on the host).

## Conventions (from AGENTS.md)

- **PR titles**: human-readable, imperative, sentence case, ~70 chars, **no Conventional Commit prefix**. Descriptions use `## Summary` + `## Test plan` (checklists, concrete commands). Every PR gets a category label (`enhancement`, `bug`, `documentation`, …) plus scope labels (`android`, `wear-os`, `frontend`, `backend`, `rust`, `plugin`, `data-model`, `sync`). PRs open ready for review, not as drafts.
- **Commits**: Conventional Commits with markdown bodies (what/why, `test:` for test-only changes); write bodies to a file and `git commit -F` when they contain backticks.
- **Licence headers** on new source files, once they exist: one-line summary + `(c) Copyright 2026 Liminal HQ, Scott Morris` + `SPDX-License-Identifier: Apache-2.0 OR MIT`.
- **Docs sync**: user-facing behaviour or screen/state changes update `SPEC.md` and `SCREENS.md` respectively, in the same change.
- **No hard wrapping**: write each markdown paragraph or list item as a single line and let viewers soft-wrap; deliberate short lines, one-liners, and bullets stay as-is.
- **Git**: never push (especially force-push) unless explicitly asked; prefer the `gh` CLI for GitHub work.

Keep this file and `AGENTS.md` in sync: when a convention changes there, update the summary here in the same PR.
