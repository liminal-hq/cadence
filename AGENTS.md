# AGENTS.md

## Table of Contents

- [Project Status](#project-status)
- [Localization and Spelling](#localization-and-spelling)
- [Markdown Formatting](#markdown-formatting)
- [Commit Messages](#commit-messages)
- [Play Console Release Notes](#play-console-release-notes)
- [Pull Request Titles](#pull-request-titles)
- [Pull Request Content](#pull-request-content)
- [Pull Request Labels](#pull-request-labels)
- [Git Workflow](#git-workflow)
- [Local Tooling](#local-tooling)
- [Documentation](#documentation)
- [Repository Layout](#repository-layout)
- [Licence and Copyright](#licence-and-copyright)
- [Tauri v2](#tauri-v2)

## Project Status

Cadence has moved past the specification phase: `apps/cadence` is scaffolded (Tauri v2 + React/TypeScript, Bun-managed) with a desktop title bar, the M3 design tokens from the Claude Design handoff, and a shared app shell (top app bar + bottom navigation) wired up across all four primary destinations. `@tanstack/react-router` now backs navigation (a `/today|/history|/plan|/progress` tab layout plus a sibling `/log/$scenario` route), and the P-14 Exercise logging flow is built out in full against a mock `LoggingRepository` (an async, in-memory implementation seeded with reference fixture data, structured so a real Rust/Tauri-backed implementation is a drop-in swap later): the "Preferred direction" fixed stepper-cluster pattern, the Set editor/Set note/expanded rest timer sheets, the plate calculator, all three demo scenarios (Sam's default set, the superset/offline-watch pair, Priya's first workout), and Priya's 5-step coach mark tour. Threshold's `RouteStage`/`ScreenStack` "peek" screen-transition architecture is ported too, though it's inert on desktop by construction until there's an Android target to attach the native predictive-back plugin to. History/Plan/Progress remain placeholders. `apps/cadence-wear`, `packages/core`, and `plugins/` remain planned; the [Repository Layout](#repository-layout) and [Tauri v2](#tauri-v2) sections below still describe those as the _planned_ shape, carried over from Threshold's engineering patterns per `SPEC.md`. Update this file further (removing the remaining "planned" qualifiers) as each part is actually scaffolded.

## Localization and Spelling

**REQUIREMENT:** All UI strings, code variables, comments, commit messages, pull request descriptions, and documentation MUST use **Canadian English** spelling.

Examples:

- `colour` instead of `color`
- `centre` instead of `center`
- `neighbour` instead of `neighbor`
- `behaviour` instead of `behavior`
- `cancelled` instead of `canceled`
- `programme` instead of `program` (when referring to a training programme; keep `program` for software/code contexts)
- `licence` (noun) vs `license` (verb) — though in UI context usually "Licence"

## Markdown Formatting

**REQUIREMENT:** Do not hard-wrap markdown prose. Write each paragraph or bullet as a single unwrapped line in the source, no matter how long — let the renderer (GitHub, a browser, an editor's soft-wrap) reflow it for display. This applies everywhere: PR descriptions, docs under `docs/`, README files, `SPEC.md`, `SCREENS.md`, code comments written in Markdown. Commit message bodies are the one exception — hard-wrap those (see [Commit Messages](#commit-messages)); `git log`/`git show` in a terminal don't reflow long lines the way GitHub's PR view does.

- Manual line breaks mid-paragraph don't survive Markdown rendering as intended (they either collapse into the same line anyway or break formatting), and they create noisy diffs when a later edit only changes one word but reflows the whole wrapped block.
- This does not apply to genuinely separate list items, headings, or intentional line breaks (e.g. two-space trailing breaks, blank lines between paragraphs) — only to breaking up one continuous sentence/paragraph across multiple lines.

**Em dashes:** use a real em dash (`—`) in prose, never `--` as a substitute. Same scope as the hard-wrap rule above — PR/issue descriptions, docs, README files, `SPEC.md`, `SCREENS.md`, commit messages, and code comments. Doesn't apply to an actual double-hyphen that means something else in context (a CLI flag like `--check`, a numeric range, etc.) — only to `--` standing in for the punctuation mark.

## Commit Messages

**Format:** Use Conventional Commits format (e.g., `feat: ...`, `fix: ...`, `docs: ...`, `test: ...`).

- Use `test:` for test-related changes, including fixes to tests themselves (do not use `fix:` unless it fixes application code).

**Body Requirements:**

- Explain what and why (not how)
- Use markdown: **bold**, _italics_, `code`, bullet lists
- **Backtick every code-level reference** — component/function/class/variable names, file and directory paths, CSS selectors/properties/values, npm and crate package names, route paths, HTML tag names, config keys, and CLI flags (e.g. `RestTimerBar`, `apps/cadence/src/domain`, `:hover`, `overflow-x: hidden`, `@tanstack/react-router`, `/log/$scenario`, `<button>`, `--flag`). This applies inline in prose, not just in fenced code blocks. Plain-English descriptions and user-facing UI strings (button labels, screen names, dialog copy) use quotes instead, not backticks — they aren't code.
- **NO markdown headings** - use **bold labels** for sections (not always required)
- Hard-wrap paragraphs (~72-100 chars), unlike other markdown in this repo — see [Markdown Formatting](#markdown-formatting)

**Specific Updates**: Each commit message should reflect the specific changes made in that commit. Do not just recap the entire project history or scope. Focus on the now.

**Shell Interpolation Safety:**

- Do not pass markdown-heavy commit bodies directly via `git commit -m "..."` when they include backticks, `$()`, or shell-sensitive characters.
- Prefer writing the message to a file with a single-quoted heredoc and commit with `git commit -F <file>` to prevent shell expansion.
- If using `-m`, escape shell-sensitive characters explicitly before running the command.
- After committing, verify the stored message with `git log -1 --pretty=fuller` and amend immediately if interpolation altered content.

## Play Console Release Notes

When drafting release notes for Google Play Console (once Cadence has a phone and Wear OS release to describe):

- **REQUIREMENT:** When updating release notes for any version, also update `RELEASE_NOTES.md` in the same change.
- Always use locale blocks in this exact format:

```text
<en-CA>
Enter or paste your release notes for en-CA here
</en-CA>
```

- Keep each locale block at **500 Unicode characters or fewer**.
- For this repository, provide **separate sections** for:
  - Cadence phone app release notes
  - Cadence Wear OS companion app release notes
- Use compact, user-facing language suitable for Play Console.
- Prefer concise headings and bullets (for example: "What's New", "Fixes", "Improvements").
- Include emoji-led mini headings (for example: `⌚`, `📈`, `🐛`, `🛠️`) to match the established Liminal HQ Play Console style.
- Use the `•` bullet character inside locale blocks (not markdown `-`) to match accepted Play Console formatting.
- Keep spelling in Canadian English.

## Pull Request Titles

**REQUIREMENT:** PR titles MUST be human-readable summaries of the PR change.

- Start with a capital letter, write in the imperative mood, and keep to roughly one 70-character line.
- Do not use Conventional Commit prefixes in PR titles (for example, no `feat:`, `fix:`, `chore:`).
- Describe the outcome or behaviour change, not internal process language.
- Ignore internal planning document notes in PR titles and descriptions unless they directly map to repository changes.
- Keep title style consistent across every open PR in the same stack.
- If one title in a stack is updated, update the rest of the open stack titles to match style and scope.
- Do not rename merged PRs unless explicitly requested.
- Keep linked issues and merge order aligned after any title changes in a stack.

## Pull Request Content

**Requirement:** PR titles and descriptions must not mention internal workflow artefacts.

- Do not mention deferred-review documents, internal queue labels, or internal-only planning notes in outward PR content.
- Keep internal triage mechanics in local runbooks, internal labels, and agent workflows only.
- Use user-facing, outcome-focused language in PR titles and descriptions.
- Only include internal process details in PR content when explicitly requested by the user.
- Open pull requests ready for review by default. Only create a draft PR when the user explicitly asks for a draft or when there is a clearly communicated blocker that makes draft status necessary.

**PR Description Format:**

- Prefer a compact markdown structure with `## Summary` and `## Test plan`.
- Under `## Summary`, use `###` sub-sections when they help group the change cleanly. Good defaults include `### User-facing changes`, `### Packaging`, `### Wear OS`, `### Documentation`, or similar outcome-oriented labels.
- Under each summary section, use flat bullets with bold lead-ins for scanability.
- Keep the summary focused on outcomes and behaviour changes, not commit history or implementation chronology.
- Under `## Test plan`, use checklist bullets (`- [x]` / `- [ ]`) and include the concrete commands, validations, or remaining gaps.
- If something could not be verified, state that plainly at the end of `## Test plan` or immediately below it.

## Pull Request Labels

**Requirement:** Add labels to every PR when it is created or updated.

- Add at least one primary category label to every PR: `enhancement`, `bug`, `documentation`, `testing`, `ci`, `build`, or `chore`.
- Add shared operational labels where they help clarify handling: `infrastructure`, `internal`, `release`, `blocked`, `epic`, or `skip-changelog`.
- Add product and subsystem scope labels where helpful. Expected Cadence scope labels once implementation begins: `android`, `wear-os`, `frontend`, `backend`, `rust`, `plugin`, `data-model`, `sync`.
- Prefer the broader Liminal HQ label style over Conventional Commit terms for PR labelling. Use GitHub label categories like `enhancement` and `bug` instead of labels such as `feat` or `fix`.
- Use `skip-changelog` only when a change should be excluded from generated release notes.
- Keep labels accurate as scope changes during review.

## Git Workflow

**Requirement:** Do not push changes (especially force pushes) to the repository unless explicitly requested by the user.

- **Fix branch naming:** When creating a branch for a fix, use `fix/issue-<number>-<short-description>` (for example, `fix/issue-19-wear-sync-conflict`).
- **GitHub tooling:** Prefer the `gh` CLI for repository, pull request, label, review, and GitHub Actions work. Only use connector-style GitHub tooling when the user explicitly asks for it or when `gh` cannot complete the task cleanly.

## Local Tooling

- **Rust fallback:** If Rust tooling such as `cargo` is not available on the host, prefer using the locally available `ghcr.io/liminal-hq/tauri-dev-desktop:latest` image to run Rust and Tauri commands against the checked-out workspace, once this repository has Rust code to build.

## Documentation

- **Updates:** When user-facing behaviour, screens, or platform requirements change, update `SPEC.md`; when the screen/state inventory changes, update `SCREENS.md` in the same change. Once a `README.md` exists, keep it in sync too.
- **No hard wrapping:** see [Markdown Formatting](#markdown-formatting) above.

## Repository Layout

Mirrors Threshold's Cargo workspace monorepo shape, per `SPEC.md`'s stated intent to reuse Threshold's engineering patterns — except the JS side is **Bun workspaces**, not pnpm (a deliberate departure from both Spindle and Threshold, made when `apps/cadence` was first scaffolded, before there was any installed state to migrate):

- `apps/cadence` — the Tauri app: React/TypeScript frontend in `src/`, Rust backend in `src-tauri/`. Scaffolded: desktop title bar (ported from Threshold's `TitleBar`/`ContextMenu`), M3 design tokens, shared app shell, and the Today screen (the other three primary destinations are still placeholders).
- `apps/cadence-wear` — **Planned.** Native Kotlin/Compose Wear OS app (own Gradle project). Not scaffolded yet.
- `packages/core` — **Planned.** Shared TypeScript types only; domain and scheduling logic stays in Rust, matching Threshold's `packages/core` pattern. Not scaffolded yet — there's no shared type to justify it.
- `plugins/` — **Planned.** Custom Tauri plugins (e.g. wear-sync) once native integrations are needed, following Threshold's `/docs/plugins/plugin-manifest-pattern.md` conventions (Android permissions injected via `build.rs`, never hand-edited manifests). Not scaffolded yet.
- `docs/` — design and architecture documentation

## Licence and Copyright

**REQUIREMENT:** All source code files (Rust, Kotlin, TypeScript, etc.) MUST include a licence and copyright header as the first content in the file, once source files exist.

**Header format:**

For Rust (`.rs`) and Kotlin (`.kt`) files:

```
// Brief one-line summary of what this file does.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
```

For TypeScript/JavaScript (`.ts`, `.tsx`, `.js`) files:

```
// Brief one-line summary of what this file does.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
```

**Rules:**

- The first line is a concise summary of the file's purpose (one sentence, no period)
- Place the header before any `package`, `use`, `import`, or `mod` statement
- Leave one blank line between the header and the first code line
- Do not add headers to generated files, configuration files (`.toml`, `.json`, `.yml`), or documentation (`.md`)
- When visiting an existing file that lacks a header, add one as part of the current change
- Use `SPDX-License-Identifier` for machine-readable licence identification

The dual licence is provided as `LICENSE-MIT` and `LICENSE-APACHE` in the repository root.

## Tauri v2

Cadence uses **Tauri v2**; native mobile support (Android and Wear OS) is not built yet. These are the house patterns and pitfalls carried over from Threshold and Spindle:

### Platform Detection

Use `@tauri-apps/plugin-os` for reliable platform detection across all targets.

- The `platform()` function is **synchronous** and determined at compile time.
- Returns: `'linux' | 'macos' | 'ios' | 'freebsd' | 'dragonfly' | 'netbsd' | 'openbsd' | 'solaris' | 'android' | 'windows'`.
- Use this for conditional UI rendering.

### Tauri APIs

- Prefer Tauri plugins over web APIs when available (e.g., `@tauri-apps/plugin-fs` over browser File API).
- Most Tauri v2 APIs are async — use `async/await`.
- Check plugin documentation for platform-specific limitations.

### Common v1 Pitfalls (Agent Guide)

Because many online resources refer to Tauri v1, older patterns may inadvertently be suggested.

**Configuration (`tauri.conf.json`) differences:** `tauri` → `app` (top-level rename); `build.distDir` → `frontendDist`; `build.devPath` → `devUrl` (URLs only, not paths); `tauri.allowlist` → **removed**, replaced by the capabilities system; `tauri.bundle` → moved to top-level.

**JavaScript API changes:** `@tauri-apps/api` now only exports `core`, `path`, `event`, `window`; everything else moved to `@tauri-apps/plugin-*` (`fs`, `dialog`, `shell`, `os`, etc.).

**Permissions & capabilities (critical):** v1's `allowlist` is replaced by the **capabilities** ACL system. Capability files live in `src-tauri/capabilities/`. Installing a plugin is **not** enough — permissions must be explicitly granted per plugin (e.g. `fs:allow-read-text-file`).

**Rust changes:** many `tauri::api` modules moved to separate plugins; use `std::fs` or `tauri_plugin_fs` instead of `tauri::api::file`; menu and tray APIs moved to separate crates.
