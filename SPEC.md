# Cadence
## Initial Product, UX, Data Model & Platform Specification

**Status:** Initial design specification  
**Product:** Cadence — a modern, local-first Android training journal with a Wear OS companion  
**Reference:** FitNotes feature and compatibility analysis (2026-09-08)  
**Audience:** Product, design, Android, Wear OS, and data-engineering collaborators

---

### Document role and sources

This is the product and platform source of truth for Cadence's initial design. [SCREENS.md](SCREENS.md) translates it into a screen-and-state inventory for UI planning. The FitNotes analysis beside this document is the behavioural and interoperability source; it is not a visual template.

Threshold provides proven implementation patterns for a Liminal HQ Android product: a Tauri v2 application with a React/TypeScript UI, Rust-owned domain logic and SQLite, narrowly scoped native plugins, event-driven native integration, a separate Kotlin/Compose Wear OS application, Wear Data Layer communication, and native home-screen widgets. Cadence should reuse and improve those engineering patterns where they fit. It must not reuse Threshold's layouts, navigation, components, motion language, visual hierarchy, colour system, or alarm-oriented interaction model. Cadence's product identity and UI will be designed from first principles around training.

Normative words such as **must**, **should**, and **may** describe required, recommended, and optional behaviour. Release labels describe sequencing rather than importance.

## 1. Product intent

Cadence helps people record strength and conditioning training quickly, understand their progress, and keep durable ownership of their data. It takes FitNotes' useful premise—a training notebook rather than a prescriptive fitness platform—and updates the experience for modern Android and Wear OS.

Cadence is for people who already know, or are deciding, what to train. It must work equally well for an unplanned single exercise, a repeated prior workout, and a structured programme.

The central promise is:

> Record a set in seconds, see the information that helps with the next set, and leave the phone in your pocket when the watch is enough.

Cadence is not primarily a social network, coaching marketplace, calorie counter, GPS tracker, or AI programme generator. Those may be considered later only when they strengthen the core training log.

## 2. Product principles

1. **Local-first and private by default.** No account or network connection is required to log, review, export, or back up training data.
2. **The set is the essential fact.** A set records what happened; workouts, history, records, and analytics are useful views built from those facts.
3. **Fast entry beats ceremony.** Starting a workout should never be required before recording a set. Planning is optional.
4. **History is part of logging.** Previous performance, rest context, exercise notes, and planned targets must be immediately available while training.
5. **Phone and watch are peers in one workout.** The watch is not a read-only notification surface. It must allow practical set entry and timing without the phone.
6. **Structured when wanted, flexible when needed.** Routines, planned sets, supersets, and goals enhance ad-hoc logging rather than creating a separate kind of workout record.
7. **Data must outlast the app.** Human-readable export, complete backup, transparent migration, and FitNotes import are product features.
8. **Show only the next useful decision.** High-frequency surfaces remain focused; depth is discoverable through a clear, modern information architecture.
9. **Earn interruption.** Haptics, notifications, wake-ups, and foreground services are reserved for active workout needs and remain user-configurable.
10. **Design for interruption and resumption.** A workout may cross app backgrounding, display sleep, a device disconnect, or a device restart without losing the user's place.
11. **One product, purpose-built surfaces.** Phone and watch share a domain and state, but each interface is composed for its screen, input methods, and expected session length.

## 3. Success criteria

Cadence's initial design should make these outcomes possible:

- A user can record a typical strength set in three or fewer intentional actions after opening an exercise.
- A user can start, continue, and finish a simple workout entirely from their Wear OS watch when the phone is nearby or temporarily unavailable.
- The current exercise shows the most relevant prior performance without navigating away from logging.
- A routine can be materialized into editable workout sets, then adapted during the workout without breaking historical accuracy.
- A user can recover all core data from an offline backup and can import FitNotes history without losing meaningful notes, dates, sets, or routines.
- The product remains useful to a beginner with a few favourite exercises and to an experienced lifter with templates, supersets, PR tracking, and analysis needs.
- A set logged from either device is durable before the UI reports success, appears exactly once after reconciliation, and remains traceable to the originating workout.
- A returning user can resume the correct exercise, draft values, rest countdown, and next action after the app or display is interrupted.

## 4. Scope and release framing

The specification captures the full product direction so that early UI decisions do not close off important workflows. It deliberately separates the first shippable product from later capability.

| Scope | Meaning |
|---|---|
| **Initial release** | Required for the first coherent Cadence experience and the first Wear OS companion. |
| **Planned expansion** | Designed for now, but may follow after initial release. |
| **Future exploration** | Valuable possibilities that require product validation, platform maturity, or user consent. |

### Initial release

- Local workout and set logging on Android
- Explicit workout sessions plus quick ad-hoc entry
- Categories, exercises, favourites, exercise notes, and configurable exercise metrics
- Previous-performance reference, set editing, completion, rest timer, and workout timer
- Routines with planned sets; supersets/circuits
- Workout history, calendar/list history, exercise history, basic graphs, PRs, and basic statistics
- Complete local backup and spreadsheet export; FitNotes import
- Wear OS: current workout, set entry/editing, completion, rest countdown, and phone/watch state synchronization
- Onboarding that keeps account creation optional, establishes units and timer defaults, and offers import without blocking first use
- Active-workout notification with safe resume and rest-timer controls
- Accessibility support for TalkBack, scalable type, non-colour state cues, large targets, reduced motion, and configurable haptics/sound

### Planned expansion

- Richer analysis, goals, body measurements, calculators, widgets, advanced calendar filtering, workout sharing, and polished backup destinations
- More routine progression behaviours, saved graph configurations, plate/barbell management, and accessibility refinements
- Watch tile and complications, additional watch quick starts, and phone home-screen active-workout widgets
- Opt-in, one-way export of completed Cadence workouts to Health Connect, so a simple session logged in Cadence is visible to other health/fitness apps (see §9.7)
- A reviewed import flow for bringing externally-tracked exercise sessions — for example a specialized class-based workout recorded by another app — into Cadence history through Health Connect, without conflating them with manually logged data (see §9.7)

### Future exploration

- Live, watch-native health sensor context (heart rate, recovery) during a Cadence-tracked workout (see §9.8)
- Optional account-based encrypted sync and multi-device reconciliation
- Coaching/programme features, only if they preserve user control and logging speed

## 5. Core vocabulary

| Term | Meaning |
|---|---|
| **Workout** | A user-visible training session, usually on a single calendar day. Cadence stores it explicitly, while still allowing immediate set entry to create one implicitly. |
| **Exercise** | A reusable activity definition such as Bench Press, Plank, or Running. |
| **Set** | One independently editable performance or planned performance for an exercise. It can include weight, reps, distance, duration, and a comment. |
| **Planned set** | A persisted set created by a routine or copied workout that has not yet been marked complete. |
| **Completed set** | A set the user has marked as performed. Completion is separate from whether the set exists. |
| **Routine** | A reusable template containing one or more sections and their exercises/set templates. |
| **Routine section** | A named segment of a routine, for example Push, Pull, Legs, or Workout A. |
| **Superset** | An ordered, workout-specific group of exercises to alternate through. It also covers tri-sets and circuits. |
| **Exercise metric profile** | The metric fields an exercise supports: weight, reps, distance, duration, or a valid combination. |
| **Measurement** | A tracked body or custom metric, for example bodyweight, waist, body-fat percentage, or calories. |
| **Device session** | The short-lived synchronization context linking the phone and watch to the same active workout. It is not a separate workout record. |
| **External exercise session** | A workout or measurement recorded by another app and stored in Health Connect, not originated in Cadence. It never becomes a Cadence record automatically; the user reviews and imports it explicitly (see §9.7), and its provenance is retained. |

## 6. Conceptual model

Cadence preserves FitNotes' simple fact model while addressing its limitations around same-day sessions and companion-device coordination.

```text
Category
  └── Exercise
       ├── Set
       ├── Exercise note / configuration
       └── Goal

Workout
  ├── WorkoutExercise (display order)
  ├── Set
  ├── Workout note
  ├── Workout time
  └── Superset

Routine
  └── Routine Section
       └── Routine Exercise
            └── Set Template

Measurement Definition
  └── Measurement Record
```

### Why Cadence has an explicit workout entity

FitNotes infers a workout from all sets on one date. Cadence must retain the convenience of that approach, but uses a `Workout` record with a stable ID because it enables:

- multiple separate sessions on one day;
- reliable phone/watch synchronization and conflict resolution;
- stable workout ordering, sharing, and metadata;
- clear lifecycle for an active workout without making "finish" mandatory;
- future cross-device or backup merging.

When a user records a set with no active workout, Cadence creates a lightweight workout automatically for the selected date. Users may later merge or separate same-day workouts. A workout may remain open, be explicitly completed, or simply become historical; none of these states blocks editing.

## 7. Information architecture

Cadence replaces FitNotes' hub-and-drawer accumulation with a small number of stable destinations. Navigation should be Material 3-aware, accessible, and adaptive for compact and larger Android screens.

```text
Today
  └── Active / selected workout
       └── Exercise detail and set logging

History
  ├── Calendar
  ├── Workout list
  └── Exercise detail

Plan
  ├── Routines
  ├── Routine editor
  └── Exercise library

Progress
  ├── Exercise trends, records, statistics, goals
  ├── Training analysis
  └── Body measurements

Profile / Settings
  ├── Units, timer, appearance, data
  ├── Import, export, backup, restore
  └── Connected devices and Health Connect permissions
```

### Primary Android destinations

| Destination | Primary question answered | Essential content |
|---|---|---|
| **Today** | What am I doing now? | Active/selected workout, next action, rest timer, quick-add, recent/favourite exercises. |
| **History** | What have I done? | Calendar and chronological workouts; filters for exercise/category. |
| **Plan** | What could I do? | Routines, routine sections, exercise library, favourites. |
| **Progress** | How am I progressing? | Exercise insights, PRs, statistics, goals, aggregate analysis, measurements. |

On phones, these destinations should use bottom navigation where appropriate. On large screens, use an adaptive navigation rail or drawer. The active workout must always be reachable in one action from any primary destination.

### Design constraints for early UI work

- Never hide core workout actions behind long-press-only interactions.
- Keep the current exercise, next set, rest time, and prior-performance reference visible together on the logging surface.
- Make planned versus completed sets visually distinct without implying that planned data is less editable.
- Use a single consistent exercise-detail pattern across logging, history, and progress.
- Make destructive changes explicit, reversible where practical, and clear about historical impact.
- Preserve a direct path from analytic findings to the source set or workout.

## 8. Android product requirements

### 8.0 First run and recovery

First run must make the core promise clear without requiring registration. The user chooses unit defaults, can set a default rest duration, and may import FitNotes data or continue into an empty journal. Appearance, notifications, watch setup, health permissions, and detailed preferences remain skippable and revisitable.

Returning users bypass onboarding. After process death, reboot, update, or restore, Cadence opens to the most useful safe state: an active workout if one remains active, otherwise Today. An interrupted draft is recoverable, but an unsaved draft must never be mistaken for a completed set.

### 8.1 Today and workout lifecycle

Today is the operational home of Cadence. It opens to the active workout when one exists; otherwise it shows the current date, a clear quick-start action, favourites/recent exercises, and routine entry points.

Users can:

- create a workout for today or another date;
- add an exercise from favourites, recents, search, category, or a routine;
- record a set without manually creating a workout first;
- rename a workout, add a note, and record start/end time;
- copy all or part of a previous workout;
- move, merge, duplicate, reorder, or delete workout content;
- leave a workout open and return later;
- optionally mark a workout complete without preventing later edits.

The workout list presents exercises in deliberate order. An exercise can be removed from a workout without deleting its definition or history.

Workout-level operations include selection of some or all exercises/sets, copy to another date or new workout, move to another date/workout, reorder, share, and delete. Bulk operations must preview scope. Moving a set across workouts updates all workout context atomically and preserves the exercise and original audit timestamps.

A workout may be `draft`, `active`, `completed`, or `abandoned`. These states communicate intent and drive resume behaviour; they do not lock history. Only one workout is active across a paired phone/watch device group by default. Starting another asks whether to finish, pause, or switch from the current workout.

### 8.2 Exercise library

Exercises belong to editable categories and can be favourited. Search must support partial matching and expose both name and category context.

Each exercise definition includes:

- name and category;
- metric profile;
- optional instruction/technique notes and URL;
- favourite state;
- default weight increment and unit preference;
- default rest duration;
- default progress metric;
- optional equipment/barbell association (planned expansion).

Categories include name, colour, order, and archived state. Cadence ships a useful editable starter library, but built-in exercises and categories are not privileged immutable records. Users can create, rename, move, archive, merge, and safely delete unreferenced definitions. Referenced exercises are archived by default so history stays intelligible.

Exercise selection supports favourites, recent use, routines, category browsing, and search in the same reusable picker. Selection can be single or multi-select depending on entry point. Creating an exercise from a no-results query carries the query into the name field.

Changing a metric profile that would make historical values ambiguous must explain the effect and offer a safer alternative: create a new exercise or preserve compatible fields. Historical data must never be silently discarded.

### 8.3 Set logging

The exercise logging screen is the highest-frequency surface. It includes:

- exercise identity and current workout context;
- the exercise note, when present;
- metric inputs appropriate to the exercise profile;
- a list of planned and logged sets in order;
- completion control and fast repeat/duplicate action;
- previous workout reference;
- rest-timer status;
- quick access to set note/edit/delete and exercise history.

Supported initial metric profiles are Weight + Reps, Distance + Duration, Reps Only, Duration Only, and Weight Only. The data model must support other valid combinations so they can be enabled later without migration.

Set behaviour:

- Saving creates an independent set; identical repeated sets are not compressed.
- A set may be added as completed immediately, or saved planned/incomplete for later completion.
- Any set may be edited, reordered, duplicated, commented on, completed/uncompleted, or deleted.
- The user can choose whether a new set is prefilled from the last comparable set, the prior workout, or a routine template.
- Unit display follows user and exercise preferences; canonical storage remains unit-safe and conversion-aware.
- Cadence must retain the exact user-entered values and enough metadata to reproduce the displayed unit context.

Set entry must handle decimal weights, zero-weight/bodyweight work, optional assisted or added load, zero-repetition duration/distance work, and explicit missing values without using magic numbers. Validation happens before persistence and explains the invalid field without clearing other inputs. Warm-up, normal, drop, failure, and other set labels are planned metadata; their absence cannot block initial logging.

Completing a set records a completion instant and may start the rest timer. Undoing completion removes that semantic completion while preserving the set and its values. Editing a completed set updates the fact in place and refreshes derived records; Cadence does not create a hidden duplicate.

The previous-performance reference shows the nearest comparable prior workout, including each set's values and completion state. Users can move further backward without leaving the logging context. Planned or future-dated sets do not count as prior performance.

### 8.4 Routines and plans

Routines are templates, not a second kind of workout history.

```text
Routine template → reviewed materialization → ordinary editable workout sets
```

A routine may have named sections, ordered exercises, optional notes, and set templates. A set template can contain explicit target values or a rule to seed values from the most recent comparable performance.

Logging a routine section lets the user review, alter, deselect, or add exercises before it becomes a workout. Materialized sets retain an optional source-template ID for traceability, but edits to a completed workout never retroactively mutate its routine.

Routine management includes create, rename, duplicate, reorder, archive/delete, section management, exercise ordering, set-template editing, and starting from any section. Template values may be fixed, blank, copied from the last comparable set, or copied from the corresponding set in the last workout. If no history exists, the template's fallback values or blanks are used and clearly identified.

### 8.5 Supersets and workout flow

Users can group workout exercises into a named, coloured superset/circuit. A group has ordered members and per-group behaviour:

- jump to the next exercise after a set or completion;
- start rest only after a full round, after each set, or never automatically;
- preserve member ordering independently from the ordinary workout list;
- be edited without changing historical data in other workouts.

The workout flow should show a clear next action: next set in the current exercise, next exercise in a superset, rest countdown, or completion summary. This is a guidance layer, not a rigid programme engine.

### 8.6 Timers and workout tools

**Initial release:** configurable rest timer with start, pause/resume, reset, add/subtract time, vibration/sound, automatic start, per-exercise defaults, and reliable foreground behaviour. The workout timer records elapsed and paused time separately, survives backgrounding, and may be corrected from workout details.

The timer is represented by a target instant plus state, not by persisted UI ticks. Starting a new rest interval replaces or explicitly extends the current interval according to preference. Completion can surface through the active app, a notification, and the watch, with a single logical timer and deduplicated feedback. Notification actions include pause/resume, add time, and dismiss when platform constraints permit.

**Planned expansion:** 1RM estimator with selectable documented formula, percentage/set calculator, and plate calculator with configurable barbells and plates. Calculators should insert a result into a draft set when invoked from logging and otherwise remain stateless utilities unless the user saves equipment configuration.

### 8.7 History and progress

History is a first-class product destination, not an archive.

- Calendar month view shows workout dates and category summaries.
- Chronological list view supports date, category, and exercise filters.
- Workout detail remains editable from historical contexts.
- Exercise detail provides logged history, graph, records, statistics, and goals through consistent tabs or sections.
- Selecting a graph point or analytic value reveals the originating workout and set.

Initial progress metrics should include volume, total sets, total reps, maximum weight, estimated 1RM, maximum distance, total distance, duration, pace, and speed when their input metrics support them. Definitions and units must be stated in the UI.

Personal records distinguish actual performance from formula-derived estimates. Record recalculation is deterministic and user-triggerable. The formula and its limitations should be documented.

Calendar day summaries must distinguish multiple workouts on one day and dates with only planned work. The list and calendar use the same filter model: date range, exercise, category, routine source, completion state, and text search where useful. Filters remain visible, explain empty results, and can be cleared in one action.

Exercise history shows the original unit context, note indicators, workout title, and enough set detail to compare sessions. Graphs support metric, date range, aggregation, and optional trendline choices. Missing data is omitted rather than coerced to zero. Every aggregate defines whether it includes incomplete/planned sets; the default is completed sets only.

Training analysis provides category/exercise breakdowns over a selected period, including frequency, sets, reps, volume, duration, and distance as applicable. Analysis favourites let users pin recurring breakdowns without changing their underlying workout data.

### 8.8 Goals and body measurements

Goals attach to an exercise and may target a metric combination, title, start date, and target date. Initial UI may ship a focused goal flow after logging/history is stable.

Body tracking uses generic measurement definitions rather than a bodyweight-only silo. A definition has name, unit, optional goal, enabled state, and order. Records store date, optional time, value, and note. Measurements support history and graph views.

Built-in measurement suggestions include bodyweight, body-fat percentage, and common circumferences, but all definitions remain editable. A goal and a record are different entities; reaching a goal must not rewrite the record. Health-derived measurements, if later enabled, retain provenance and can be excluded from manually entered trends.

### 8.9 Sharing, widgets, and system integration

**Initial release:** an ongoing active-workout notification exposes resume and timer status without containing notes or detailed health data. Notification permission denial does not block logging; Cadence explains any effect on background timer visibility.

**Planned expansion:** formatted workout sharing, a home-screen widget for active-workout and rest-timer status, shortcuts for quick start/logging, and richer notification actions. Sharing begins with a preview where the user selects workout title, date, sets, notes, records, and units. Widgets and shortcuts read a small native cache populated from core events; they never own workout state and must not require the webview to be alive.

### 8.10 Settings

Settings are grouped by user intent rather than internal subsystem:

- **Training:** unit defaults, previous-value prefill, set completion, rest timer, workout timer, auto-advance, superset flow, and record formula;
- **Exercises and equipment:** categories, exercise defaults, barbells, and plates;
- **History and progress:** default ranges, graph metrics, week start, calendar summaries, and analysis favourites;
- **Appearance and accessibility:** theme, dynamic colour preference, text/number presentation, motion, haptics, and sound;
- **Devices and integrations:** paired watch status, wearable data controls, Health Connect, notifications, widgets, and shortcuts;
- **Data and privacy:** FitNotes import, backup, restore, export, storage information, and optional diagnostics;
- **About:** version, licences, privacy information, acknowledgements, and support links.

Settings that materially change existing data interpretation, such as units or metric profiles, must distinguish display conversion from stored-value migration. Reset actions declare their exact scope and do not share a control with destructive data deletion.

## 9. Wear OS companion

### 9.1 Wear product role

The Wear OS app exists to eliminate unnecessary phone use during a workout. It must not merely mirror workout status: it must offer the base workout flow on the wrist.

The initial watch experience supports:

- viewing or starting the current workout;
- browsing the current workout's exercises and planned sets;
- entering and editing weight, repetitions, distance, and duration;
- marking sets complete/incomplete and adding another set;
- viewing the next superset/circuit exercise;
- starting, pausing, extending, and dismissing the rest countdown;
- receiving haptic rest-complete feedback;
- seeing a compact prior-performance reference for the current exercise;
- ending or returning from a workout without forcing the user to pick up their phone.

The phone offers the full library, routine authoring, bulk editing, historical exploration, settings, and analytics. The watch optimises for immediate execution, not dense management tasks. Watch layouts, navigation, tokens, motion, and components will be designed specifically for Cadence and must not be copied from Threshold's watch UI.

Initial release intentionally excludes creating exercises, authoring routines, browsing long-term history, analytics, backup/restore, and global settings from the watch. A watch can start from a locally cached favourite, recent workout, or synced routine section; arbitrary library management belongs on the phone.

### 9.2 Watch information architecture

```text
Watch home
  ├── Resume active workout
  ├── Start from recent/favourite/routine (when locally available)
  └── Rest timer / complication shortcut

Workout
  ├── Current exercise
  │    ├── Next planned set / quick add
  │    ├── Prior-performance reference
  │    └── Set list and edit
  ├── Exercise picker / superset progression
  ├── Rest timer
  └── Workout controls
```

The watch's default screen during an active workout should prioritize, in order: current exercise, next set values, one-tap completion/logging, timer state, and the next exercise. It must be readable in a bright gym and usable with a sweaty hand.

The active flow uses a shallow navigation stack and predictable swipe-back behaviour. Critical actions have visible controls rather than gesture-only discovery. The display may enter ambient mode, but elapsed/rest time must remain logically correct when it wakes. Accidental wrist touches must not silently finish workouts or delete sets.

### 9.3 Watch set-entry interaction

Set entry must support more than one input method, with no precision-critical interaction dependent on a tiny keyboard:

- increment/decrement controls using each exercise's configured increment;
- large numeric picker or rotary input;
- suggested values from the preceding set and previous workout;
- one-tap repeat of the prior set;
- optional voice input only where platform reliability and confirmation make it safe;
- an explicit review/undo affordance after logging.

For strength exercises, the happy path is: open current exercise → adjust weight/reps if needed → tap **Log set**. For planned workouts, the happy path is: see next planned set → tap **Complete** → receive rest countdown and next-action cue.

Input preserves the difference between `0`, blank, and unchanged. Rotary input adjusts the focused field using the exercise increment; buttons provide an alternative. Values require a final visible commit, and the post-commit state offers undo. A repeated tap or retried message uses the same mutation ID and cannot create a duplicate set.

Editing a previously synced set shows its current values and completion state. If the phone changed the same set while disconnected, the watch keeps the user's edit queued and later explains any material conflict; it never pretends an unsent change is safely stored on the phone.

### 9.4 Watch timers and feedback

Rest timing is a watch-native responsibility during an active watch workout. The timer must continue when the display sleeps and provide haptic feedback at completion. The companion phone should reflect the same logical timer state when connected. The watch exposes remaining time, pause/resume, add/subtract time, dismiss, and return-to-set actions. Timer completion never requires the workout screen to remain foregrounded.

Cadence should avoid double alarms. If both devices are connected and awake, the watch is the primary haptic endpoint; the phone may show a silent/low-priority companion notification according to user preference.

### 9.5 Phone/watch synchronization and offline behaviour

The app must work when devices are connected, temporarily disconnected, or when only one is available.

| Situation | Required behaviour |
|---|---|
| Connected | Set changes, completion state, active exercise, workout state, and timer intent synchronize promptly in both directions. |
| Watch temporarily offline | The watch queues mutations locally with IDs, timestamps, and device revision metadata; the user can continue logging. |
| Phone temporarily offline | The phone remains fully usable; it queues mutations for the watch when appropriate. |
| Reconnection | Sync is idempotent, shows any unresolved conflict, and never silently drops a logged set. |
| Conflict on the same field | Prefer the latest explicit edit, preserve the competing value in an audit/recovery record where feasible, and surface a concise resolution UI for material conflicts. |

The wearable data layer must not be the sole owner of workout data. The phone's local database remains the durable primary store; the watch maintains a syncable local subset sufficient for active workout execution and short offline continuity. Locally committed watch mutations are durable watch records until acknowledged by the phone, not best-effort messages.

Sync scope includes the active workout, its exercises and sets, a bounded prior-performance summary, timer state, favourite/recent quick starts, and selected routine sections. The phone does not send the entire training history to the watch. Payloads are versioned, bounded, and forward-compatible; unsupported fields are ignored safely while schema/protocol mismatches produce an actionable status.

The protocol uses stable entity IDs, monotonic phone revisions, per-mutation IDs, tombstones for deletion, acknowledgements, and an idempotent replay queue. Phone-to-watch durable state travels through Data Layer data items; commands and acknowledgements may use messages when connected. A full snapshot repairs revision gaps, while normal changes are incremental or bounded aggregate snapshots. The exact transport is an implementation detail and cannot weaken the no-data-loss requirement.

### 9.6 Watch complications and tiles

**Planned expansion:** a tile and complication that show one of: active rest countdown, active workout status, or a quick-start action. The tile may expose resume, next set, or start-a-favourite actions within platform limits. Complications must avoid exposing sensitive workout detail on an ambient display unless the user explicitly opts in.

### 9.7 Health Connect integration (planned expansion)

Health Connect is Android's unified, on-device store for structured health and fitness records (it superseded the legacy Google Fit APIs), shared across apps under a per-data-type, per-direction permission model. Cadence's Health Connect integration is opt-in, additive, and split into two directions that ship independently:

**Export — Cadence workouts to Health Connect.** When a workout reaches `completed`, Cadence may write an `ExerciseSessionRecord` (and, where applicable, associated measurement records) so that a workout logged in Cadence is visible to other fitness and health apps. This is one-way, fire-and-forget, requires only a write-scoped permission, and never depends on any data being read back. A completed workout shows its export state (not exported / exported / export failed) in Workout detail and can be re-sent on demand.

**Import — external exercise sessions into Cadence.** Not every workout will be tracked in Cadence: a specialized class-based session, a run tracked by a dedicated running app, or anything else recorded elsewhere and written to Health Connect can be brought into Cadence history on request. This follows the same reviewed-staging shape as routine materialization (§8.4): Cadence lists candidate external sessions not yet imported, the user inspects each one's source app, date, duration, and any recognizable metrics, chooses which to bring in, and only then does an import create a real, provenance-tagged `Workout`. An imported workout is never conflated with a manually logged one — it retains its external source app and record ID permanently, is excluded from "exported to Health Connect" round-tripping, and a session that overlaps an existing manually logged workout is flagged for the user to resolve rather than silently duplicated or merged.

Both directions require Cadence to remain fully usable with all Health Connect permissions denied, retain user-entered values as the source of truth over anything externally imported, and never present imported data as if the user had manually logged it.

### 9.8 Live health sensors and recovery context (future exploration)

Distinct from Health Connect (which is a storage layer, mostly phone-side), live sensor data during an active workout is a Wear OS Health Services concern — reading heart rate directly from watch hardware while a Cadence workout is in progress. Candidate capabilities include:

- displaying live heart-rate context on the watch and/or phone during a workout;
- using recovery/heart-rate context as an input to training analysis, never as an unverified replacement for logged sets;
- surfacing rest-interval guidance informed by heart-rate recovery, if validated as useful rather than noisy.

Before implementation, validate battery impact, Wear OS Health Services permissions and availability, data provenance, consent language, retention, and whether users find the metric actionable rather than distracting mid-set. Cadence must remain fully functional when all health permissions are denied.

## 10. Data model requirements

Cadence should use a local, versioned relational database (for example Room over SQLite) with foreign-key enforcement, migrations, and application-level validation. IDs must be stable UUIDs or similarly globally unique identifiers to support backup and device synchronization.

### 10.1 Core entities

| Entity | Required fields / responsibilities |
|---|---|
| `Category` | ID, name, colour, sort order, archived state. |
| `Exercise` | ID, name, category ID, metric profile, notes, URL, favourite, unit/increment/rest/graph defaults, archive state. |
| `Workout` | ID, local date, title, note, start/end timestamps, state, created/updated metadata, source routine metadata, source (`manual` / `fitnotes-import` / `health-connect-import`), external source app and record ID when imported, Health Connect export state. |
| `WorkoutExercise` | Workout ID, exercise ID, display order, optional group reference, state/notes needed for workout context. |
| `Set` | ID, workout ID, workout-exercise ID, exercise ID, order, metric values, unit metadata, planned/completed state, completion timestamp, source template ID, created/updated metadata. |
| `SetNote` | Set ID, text, created/updated metadata. |
| `Routine` / `RoutineSection` / `RoutineExercise` / `SetTemplate` | Ordered template hierarchy and population rules. |
| `Superset` / `SupersetMember` | Workout-specific group, member order, colour, auto-advance and rest behaviour. |
| `ExerciseGoal` | Exercise ID, target metric values, title, dates, progress configuration. |
| `MeasurementDefinition` / `MeasurementRecord` | Generic body/custom metric definitions and dated values. |
| `RestTimer` | Logical timer state tied to workout/exercise/set context, duration, target instant, device ownership/preference, and revision. |
| `DeviceMutation` | Mutation ID, source device, entity/version, timestamp, sync/acknowledgement state; required for durable watch reconciliation. |
| `HealthImportCandidate` | External record ID, source app, record type, date/duration, recognized/unrecognized metric summary, reviewed/imported/dismissed state; staging record for the Health Connect import review (§9.7), never a Cadence workout until explicitly imported. |
| `AppSettings` | Units, theme, accessibility, home/history/progress preferences, timer behaviour, privacy, and integration settings. |

### 10.2 Invariants

- A set belongs to exactly one workout and one workout exercise; its exercise must match that workout exercise.
- A workout can have zero sets, enabling a user to start first and decide later, but an ad-hoc set automatically creates/attaches to a workout.
- Deleting a workout requires explicit confirmation and cascades only to its workout-specific entities, never to reusable exercise or routine definitions.
- Archiving an exercise preserves history and templates; destructive deletion is reserved for unreferenced items or carefully confirmed migrations.
- Routine templates are immutable with respect to already materialized sets. Source references are optional provenance, not live links.
- Set values are nullable only when the metric profile does not require them. Values must pass domain validation before logging.
- All user-visible timestamps carry timezone-aware instants; workout date is stored separately as the user's intended training date.
- Reordering is explicit and durable, not inferred from database insertion order.
- Every synced mutation is idempotent and attributable to a device.
- Importing the same external Health Connect record twice must not create a duplicate workout; the external record ID is the deduplication key. An imported session that overlaps an existing manually logged workout is flagged for user resolution, never silently merged or discarded.

### 10.3 Derived data

The following should be computed from source facts or cached with clear invalidation rules:

- workout volume, set count, and duration;
- exercise history, graph points, trend lines, records, and statistics;
- calendar indicators and category summaries;
- goal progress;
- workout/exercise completion summaries;
- analysis periods and breakdowns.

Derived views must remain traceable back to the responsible sets. Do not treat a graph or personal-record flag as an irreplaceable source of truth.

### 10.4 Units and numeric precision

- Store canonical physical values with explicit units and display preferences rather than relying on integer-only fields.
- Use decimal-safe representation suitable for common plate and bodyweight increments; do not use binary floating-point where it can surface unexpected user-visible values.
- Preserve original-entry units for display/audit where conversion is applied.
- Define distance and duration units at the domain boundary, including pace/speed calculation rules.

## 11. Import, backup, export, and privacy

### FitNotes import

Cadence should support a guided FitNotes `.fitnotes` import. The file is a SQLite database, but Cadence's importer must treat it as untrusted input and validate it before ingestion.

The import should:

1. validate SQLite format and detect schema version/table availability;
2. import categories, exercises, sets, comments, workout metadata, routines, supersets, goals, measurements, and relevant preferences when available;
3. map FitNotes' date-derived workouts into Cadence workouts, normally one imported workout per date;
4. preserve original FitNotes identifiers as external-source references, not Cadence primary IDs;
5. retain unknown values and report unsupported items rather than silently discarding them;
6. provide an import summary with counts, warnings, and a recoverable pre-import backup.

### Cadence backup and export

- **Complete backup:** a versioned, documented, restorable archive containing all Cadence data and configuration. It must support integrity verification and future migrations.
- **Spreadsheet export:** CSV and/or interoperable tabular export for workouts, sets, exercises, routines, measurements, and metadata useful to analysts. It is not represented as a complete restore mechanism.
- **Optional cloud destination:** user-selected storage only; local use and manual export never depend on it.

### Privacy requirements

- No account is required for core use.
- Network access must be unnecessary for logging, timers, history, and watch operation.
- Health and cloud connections use explicit, granular consent and can be revoked without data loss.
- Sensitive data is not included in notifications, tiles, widgets, or shared text beyond user-selected scope.
- The product must document what data remains on phone, watch, backup destination, and any optional third-party service.

## 12. Non-functional requirements

### Reliability

- Logging a set must be transactional and resilient to process death.
- Active rest timers must recover predictably after app/background lifecycle changes; timer expiry is calculated from a target instant, not accumulated ticks.
- Sync retries must not duplicate logged sets.
- Backup/restore and import must be versioned and tested against malformed and older data.

### Performance

- Today and the active watch workout should render promptly from local storage.
- Common set logging actions must remain responsive with years of history.
- Graphs and aggregate analysis may use background calculation, but must communicate loading rather than block logging.

### Accessibility

- Support TalkBack, large text, high contrast, touch targets, and non-colour-only state indicators.
- Wear controls must be operable with touch and rotary input where hardware offers it.
- Haptics and sound are independently configurable; timer completion cannot rely solely on either.

### Security and data integrity

- Use platform storage protections and least-privilege permissions.
- Validate all imports and sync payloads.
- Provide confirmation and clear impact statements for deleting history, changing exercise semantics, restoring backups, and disconnecting/deleting device data.

## 13. Product decisions requiring UI exploration

The following need deliberate design prototypes before implementation:

1. **Workout start semantics:** the balance between a visible “Start workout” action and automatic workout creation on first set.
2. **Exercise logging layout:** one-screen entry versus editable set table, particularly for planned sets and varied metric profiles.
3. **Watch offline messaging:** how to communicate queued changes and conflicts without distracting during training.
4. **Rest-timer ownership:** clear device behaviour when phone and watch are both active, including haptics/notifications.
5. **Navigation density:** exact Android tab structure and the placement of Plan versus Progress for users who use neither routinely.
6. **Routine materialization:** review step depth and how to make “populate from history” legible and safe.
7. **Same-day sessions:** default grouping, naming, and merge behaviour for people who train twice in one day.
8. **Health data boundaries:** what belongs beside training data versus what should remain an optional external context.

## 14. Acceptance requirements for the first vertical slice

The first end-to-end prototype is successful when it demonstrates this complete flow:

```text
Phone: choose a routine or favourite exercise
  → create/continue workout
  → planned/current set appears on watch
  → log or complete set from watch
  → rest timer counts down and haptics fire on watch
  → phone reflects the set and next action
  → temporary disconnect does not lose watch-entered data
  → reconnect reconciles data exactly once
  → workout remains editable in phone history
```

The slice should include at least Weight + Reps exercise logging, one routine with planned sets, a two-exercise superset, local persistence, a rest timer, and a visible sync-state indicator. It should be tested with the phone locked/backgrounded, the watch screen asleep, and a deliberate Bluetooth/Wi-Fi disconnect.

## 15. Cadence requirement summary

**CAD-CORE-001** — A user can log a set without completing a mandatory workout-start flow.  
**CAD-CORE-002** — Cadence stores workouts explicitly while preserving frictionless automatic creation.  
**CAD-CORE-003** — Every set is independently editable, orderable, commentable, and completable.  
**CAD-CORE-004** — Exercise history is immediately available from the logging context.  
**CAD-PLAN-001** — Routines materialize into ordinary editable workout sets.  
**CAD-PLAN-002** — Supersets are workout-specific and support ordered auto-advance behaviour.  
**CAD-PROG-001** — Progress views are derived from recorded sets and link back to source workouts.  
**CAD-DATA-001** — The core product works offline without an account.  
**CAD-DATA-002** — Complete backup remains distinct from spreadsheet export.  
**CAD-DATA-003** — FitNotes import preserves meaningful training history and reports exceptions.  
**CAD-WEAR-001** — The Wear OS app supports practical set entry and completion, not only viewing.  
**CAD-WEAR-002** — The Wear OS app provides the active rest countdown and haptic completion feedback.  
**CAD-WEAR-003** — Phone and watch changes reconcile without silent loss or duplicate sets.  
**CAD-WEAR-004** — The watch remains useful during temporary phone disconnection.  
**CAD-HEALTH-001** — Health metrics are opt-in, permission-scoped, and never required for core workout logging.
**CAD-HEALTH-002** — A completed Cadence workout can be exported to Health Connect as a one-way, opt-in write with a visible export state, independent of any read permission.
**CAD-HEALTH-003** — External exercise sessions from Health Connect are never imported automatically; the user reviews and selects each one, and imported workouts retain their external provenance permanently and are deduplicated by external record ID.

---

## Appendix: FitNotes-inspired principles retained and intentionally changed

| Retained | Modernized for Cadence |
|---|---|
| Fast manual, local-first logging | Explicit workout IDs support same-day sessions and phone/watch synchronization. |
| Exercise + set facts as the durable core | Foreign keys, migrations, numeric precision, and stable sync IDs protect those facts. |
| History adjacent to training | Clear primary navigation replaces feature discovery through drawers/overflows/long presses. |
| Optional routines, planned sets, and supersets | A reviewable materialization flow and provenance make planning safer. |
| User-owned exercise taxonomy and portable backups | Guided FitNotes import, documented backup format, and user-controlled integrations extend portability. |
| Optional body tracking and analysis | Health data becomes a consent-based contextual layer rather than a dependency. |
