# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cadence is a modern, local-first Android training journal inspired by FitNotes, with a Wear OS companion app for logging sets without pulling out a phone. It is planned to follow Threshold's engineering patterns — Tauri v2, React/TypeScript frontend, Rust-owned domain logic and SQLite, a native Kotlin/Compose Wear OS app — while using an entirely new, purpose-built UI. See `AGENTS.md` for the authoritative contributor conventions — most importantly: **Canadian English** spelling everywhere; **Conventional Commits** for commit messages but human-readable, prefix-free **PR titles**; the Apache-2.0 OR MIT licence/copyright header on new source files (once source files exist); and **no pushes unless explicitly asked**.

## Status

Cadence has moved past specification-only. `apps/cadence` is scaffolded: Tauri v2 + React/TypeScript frontend (Bun-managed, not pnpm), a desktop-only title bar ported from Threshold, M3 design tokens lifted from the Claude Design handoff, and a shared app shell (top app bar + bottom navigation across the four primary destinations), with `@tanstack/react-router` now backing navigation. The Logging flow (P-14 Exercise logging, P-15 Set editor, P-16 Set note, P-17 Rest timer, the plate calculator, and Priya's 5-step coach mark tour) is merged, reached through a real "start a workout" flow: Today (P-10) creates a genuine workout, Workout detail (P-12) lists its exercises, and Add exercise (P-13) is a favourites/category/search picker over an 80-exercise starter library — the three demo scenarios that used to be Logging's only entry point are retired along with the seed data they depended on, so the app now starts with a genuinely empty history. Threshold's `RouteStage`/`ScreenStack` "peek" screen-transition architecture is also ported, though it's inert on desktop until an Android target exists to attach the native predictive-back plugin to. A shared M3 component library (`Button`, `IconButton`, `Chip`, `Tag`, `SegmentedControl`, `Tabs`, `Switch`, `Banner`, `Dialog`, `AppBar`, `EmptyState`, `Surface`) now lives under `apps/cadence/src/components/ui/`, and every Logging component has been refactored onto it. The Settings hub (P-60) is merged: all fourteen rows across SPEC.md §8.10's seven groups are wired to a real destination, with Units, Rest & workout timers (P-61, closing GitHub issue #2's buildable slice), Backup & data (P-62, including a functionally real delete-all-history flow), Wear OS watch (P-63), Plates & barbells (P-66, real CRUD), and Motion/haptics/sound (P-67) built in full; the remaining seven rows (1RM formula, Categories, Week start & graphs, Theme, Health Connect, Notifications, Diagnostics) are `ComingSoon` stubs pending their own specs. History (P-40–P-46) is merged: a new `Workout` domain entity backs the Calendar/List toggle (P-40/P-41), the workout history list with relative/month grouping and pagination (P-42), historical workout detail with a real "Copy to today" (P-43), and exercise detail's five-tab shell — History, a hand-built SVG Graph with a table alternative, Records (actual vs. Epley-estimated, tie-aware), and Stats (P-44–P-46); Goals stays a placeholder pending P-48. Plan/Progress remain wired-up placeholders.

The backend is real: `apps/cadence/src-tauri` owns a Rust domain layer (`src/domain/`) over an embedded, versioned-migration SQLite database (`src/db/`), covering exercises, workouts/workout-exercises/supersets, sets, the rest-timer state machine, barbells/plates, settings, and history summary/delete-all — plus tables for not-yet-built features (routines, goals, measurements, Health Connect staging, analysis favourites) ready for future feature PRs without a migration. A `Coordinator` owns transactions, cross-entity invariants, and event emission; `commands.rs` exposes the full surface as Tauri commands. `apps/cadence/src/domain/tauriRepository.ts` is the live `LoggingRepository` the app runs against; the async, in-memory `mockRepository` under `src/domain/` is retained for JS unit tests only. `apps/cadence/src/domain/generated/` holds ts-rs-generated TypeScript bindings mirrored from the Rust DTOs, drift-checked in CI. Two known gaps carried over from the mock (which never computed them dynamically either, only baked fixture values into its now-retired demo rows): `SetEntry.isRecord` and `WorkoutExercise.lastTimeReference` are always `false`/absent from the real backend — genuine personal-record and prior-performance computation is unbuilt, tracked as follow-up work. There's no Android/Wear OS build yet.

- `SPEC.md` — the product, UX, data model, and platform specification. This is the current source of truth.
- `SCREENS.md` — the companion screen-and-state inventory for UI planning, derived from `SPEC.md`.
- `FitNotes Android Application — Product, UX, Data Model & Compatibility Specification.md` — the reference analysis of the FitNotes app that `SPEC.md` was derived from. It documents FitNotes' own behaviour, not Cadence's; treat it as background material, not a source of Cadence requirements.

The UI design work itself is done: a Claude Design handoff (Foundations canvas + seven per-journey canvases covering the full `SCREENS.md` inventory) is the source of truth for tokens and remaining screens, which get built one at a time from here. Cadence's visual design is explicitly **not** based on Threshold's — see `SPEC.md` §"Document role and sources" for what may and may not be reused from Threshold.

## Layout

`AGENTS.md`'s [Repository Layout](AGENTS.md#repository-layout) section is authoritative. `apps/cadence` is scaffolded; `apps/cadence-wear`, `packages/core`, and `plugins/` remain planned — don't scaffold those speculatively, only when there's a concrete need.

## Commands

- `bun install` — install workspace dependencies.
- `bun run --filter @liminal-hq/cadence tauri dev` (or `cd apps/cadence && bun run tauri dev`) — launch the desktop app.
- `cd apps/cadence && bun run tauri:dev` — the same, but merging `src-tauri/tauri.conf.dev.json`'s `withGlobalTauri: true`, required for the Tauri MCP tooling's webview JS execution (`webview_execute_js`, `webview_screenshot`, etc.) to work at all; plain `tauri dev` leaves `window.__TAURI__` unexposed and every such call times out.
- `bun run build` — typecheck and build the frontend.
- `bun run test:js` — run the frontend test suite (`bun run test:js:ci` for the junit-reporting CI variant).
- `bun run format` / `bun run format:check` — Prettier.
- `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings`, `cargo nextest run --workspace --config-file nextest.toml --profile ci` — Rust checks (via the `ghcr.io/liminal-hq/tauri-dev-desktop:latest` image per `AGENTS.md`'s Local Tooling note if `cargo` isn't on the host).

## Conventions (from AGENTS.md)

- **PR titles**: human-readable, imperative, sentence case, ~70 chars, **no Conventional Commit prefix**. Descriptions use `## Summary` + `## Test plan` (checklists, concrete commands). Every PR gets a category label (`enhancement`, `bug`, `documentation`, …) plus scope labels (`android`, `wear-os`, `frontend`, `backend`, `rust`, `plugin`, `data-model`, `sync`). PRs open ready for review, not as drafts.
- **Commits**: Conventional Commits with markdown bodies (what/why, `test:` for test-only changes); backtick every code-level reference (identifiers, paths, CSS, package names, tags — not UI strings, which use quotes); write bodies to a file and `git commit -F` when they contain backticks.
- **Licence headers** on new source files, once they exist: one-line summary + `(c) Copyright 2026 Liminal HQ, Scott Morris` + `SPDX-License-Identifier: Apache-2.0 OR MIT`.
- **Docs sync**: user-facing behaviour or screen/state changes update `SPEC.md` and `SCREENS.md` respectively, in the same change.
- **No hard wrapping**: write each markdown paragraph or list item as a single line and let viewers soft-wrap; deliberate short lines, one-liners, and bullets stay as-is. Commit message bodies are the exception — hard-wrap those.
- **Em dashes**: use a real `—`, never `--` as a substitute — same scope as the no-hard-wrap rule (docs, PR/issue text, commit messages, code comments); doesn't apply to an actual double-hyphen like a CLI flag.
- **No barrel files**: import directly from the file that defines the thing, not from an `index.ts` that only re-exports sibling files.
- **Git**: never push (especially force-push) unless explicitly asked; prefer the `gh` CLI for GitHub work.

Keep this file and `AGENTS.md` in sync: when a convention changes there, update the summary here in the same PR.
