# Cadence

## Screen and State Inventory

**Status:** Initial UI-planning companion to [SPEC.md](SPEC.md)  
**Product:** Cadence — Android training journal and Wear OS companion  
**Scope:** Product surfaces and states, not visual direction or component specifications

---

## 1. How to use this document

This inventory translates the Cadence product specification into the screens, modal flows, persistent system surfaces, and important states that the initial UI design must account for. It is deliberately comprehensive enough to prevent early designs from overlooking a key state such as planned sets, a disconnected watch, an empty history, or a destructive import.

It does not prescribe a layout, visual system, or component library. Cadence's UI is original: it must be designed for training flow, current Android conventions, and Wear OS constraints rather than copied from Threshold or FitNotes.

### Scope labels

| Label       | Meaning                                                                     |
| ----------- | --------------------------------------------------------------------------- |
| **Initial** | Required for the first coherent phone-and-watch release.                    |
| **Planned** | Part of the product direction; design seams now, implementation may follow. |
| **Future**  | Requires validation, platform work, or explicit consent before commitment.  |

### Inventory fields

- **Purpose:** the user need the surface fulfils.
- **Entry:** how a user reaches it; this protects navigation continuity.
- **Content and actions:** decisions and operations that must be supported.
- **States:** empty, loading, error, confirmation, accessibility, offline, and other variants with material UX impact.

## 2. Navigation map

```text
Phone
  First run
    └── Optional import and preferences

  Today
    ├── Active / selected workout
    │    ├── Exercise logging
    │    │    ├── Set editor / note
    │    │    ├── Rest timer
    │    │    └── Superset navigator
    │    ├── Workout controls
    │    └── Add exercise / routine materialization
    ├── Quick start
    └── Recent and favourite exercises

  History
    ├── Calendar
    ├── Workout list
    ├── Workout detail
    └── Exercise detail

  Plan
    ├── Routine list / detail / editor
    └── Exercise library / exercise editor / category editor

  Progress
    ├── Exercise progress
    ├── Training analysis
    ├── Goals
    └── Measurements

  Settings
    ├── Preferences and connected devices
    └── Import, export, backup, restore

Watch
  Watch home
    └── Active workout
         ├── Current exercise / set entry
         ├── Exercise picker
         ├── Rest timer
         └── Workout controls
```

## 3. Phone: first run and recovery

### P-01 — Welcome

**Scope:** Initial  
**Purpose:** Establish that Cadence works without an account and guide a new or returning user into a safe first action.

**Entry:** fresh install or a user who has cleared all local data.

**Content and actions:** concise product promise; continue with local data; import existing FitNotes data; privacy/data-ownership explanation; link to accessibility and permissions choices.

**States:** new user; existing local backup detected; import deferred; no network available. Account sign-in must not be presented as a prerequisite.

### P-02 — Initial preferences

**Scope:** Initial  
**Purpose:** Capture only the defaults that affect immediate logging.

**Entry:** Welcome; Settings later.

**Content and actions:** mass/display units, first day of week, default rest duration, timer feedback preferences, theme/system choice, and optional screen-on behaviour.

**States:** skipped/defaulted; accessible text scale; preferences changed later without losing historical units or values.

### P-03 — FitNotes import wizard

**Scope:** Initial  
**Purpose:** Safely bring existing FitNotes history into Cadence.

**Entry:** Welcome; Settings → Data; an import prompt after a user selects a `.fitnotes` file.

**Content and actions:** select file; validate; preview counts and date range; show mapping/warnings; choose import; create a recoverable pre-import snapshot; show result and next steps.

**States:** invalid/not-SQLite file; unsupported/older schema; duplicate import detected; missing optional tables; insufficient storage; import cancelled; partial warning success. No source data is altered.

### P-04 — Resume/recovery prompt

**Scope:** Initial  
**Purpose:** Restore a safe active-workout context after app restart, interruption, or a timer that elapsed while the app was not visible.

**Entry:** app launch with an open/recent workout or unresolved device synchronization.

**Content and actions:** resume workout; view completed workout; discard only an empty draft; see rest-timer outcome; review queued watch changes if required.

**States:** no active workout; active workout with zero sets; timer expired; watch reconciliation pending; unrecoverable corruption directs to backup/restore help.

## 4. Phone: Today and workout execution

### P-10 — Today

**Scope:** Initial  
**Purpose:** Be the operational home for today or the selected training date.

**Entry:** launch; primary navigation; active-workout notification; widget; returning from a workout screen.

**Content and actions:** active/selected workout summary; start/resume workout; date selection; quick add from favourites/recent exercises; routine entry; current rest timer; lightweight workout progress; access to workout controls.

**States:** no workout today; empty workout; active workout; completed historical workout; selected non-today date; timer running; offline; set changes queued from watch.

### P-11 — Quick start workout

**Scope:** Initial  
**Purpose:** Start with minimal ceremony while making the selected date/session clear.

**Entry:** Today; app shortcut; widget; watch hand-off.

**Content and actions:** start an unnamed workout now; choose a date; optionally give it a title; select a routine; add an exercise. Logging a first set may bypass this surface by creating a lightweight workout automatically.

**States:** current-day default; another-date logging; existing active workout; multiple same-day workouts; no exercises configured.

### P-12 — Workout detail

**Scope:** Initial  
**Purpose:** Show the workout's exercise order, progress, timer, and next useful action.

**Entry:** Today; History; Calendar; notification; watch-originated hand-off.

**Content and actions:** ordered workout exercises and concise set summaries; add/reorder/remove exercise; open exercise logging; start/stop workout timer; add workout title/note; launch superset management; copy/duplicate/move/delete controls; complete/reopen workout.

**States:** empty; planned-only; in-progress; complete; historical; an exercise with no sets; all sets complete; watch sync pending; same-day sibling workout available; Health Connect export pending/complete/failed (Planned — see P-64).

### P-13 — Add exercise

**Scope:** Initial  
**Purpose:** Add the right exercise quickly without leaving workout context.

**Entry:** Today; Workout detail; exercise logging; routine review.

**Content and actions:** favourites; recent exercises; category browse; partial-text search; create exercise; choose one or many exercises; add to current workout.

**States:** no favourites/recent items; search has no results; archived exercise included/excluded; exercise already in workout; a routine-only section selected.

### P-14 — Exercise logging

**Scope:** Initial  
**Purpose:** Log or complete one exercise's sets with the context needed for the next decision.

**Entry:** Workout detail; Add exercise; watch hand-off; previous/next exercise navigation; superset flow.

**Content and actions:** exercise name/category; current workout context; persistent exercise note; previous-performance reference; planned/logged set list; metric inputs; log, complete, edit, duplicate, reorder, and delete set; rest timer; navigation to next exercise; history/progress shortcut.

**States:** no prior history; new manual set; prefilled from prior workout; planned incomplete set; completed set; selected set being edited; mixed completed/planned list; rest timer running; current exercise in superset; temporary device disconnect.

### P-15 — Set editor

**Scope:** Initial  
**Purpose:** Give a focused, reversible way to create or amend exact set values.

**Entry:** Exercise logging; set row; repeat/duplicate action; routine materialization review.

**Content and actions:** fields matching metric profile; displayed and canonical-unit context; set order; planned/completed toggle; completion time; quick-copy preceding values; save/update/delete; set note.

**States:** Weight + Reps; Distance + Duration; Reps Only; Weight Only; Duration Only; invalid/incomplete input; converted unit; editing historical set; delete confirmation; draft restored after interruption.

### P-16 — Set note

**Scope:** Initial  
**Purpose:** Record set-specific context such as equipment setup, assistance, pain, or technique.

**Entry:** Set editor; set overflow/action.

**Content and actions:** write/edit/remove note; return to the same selected set.

**States:** empty/new note; existing note; unsaved-change dismissal confirmation; screen-reader-friendly text editing.

### P-17 — Rest timer

**Scope:** Initial  
**Purpose:** Make rest duration visible and controllable without leaving the active workout.

**Entry:** inline from Exercise logging/Workout detail; automatic start after configured set action; notification; watch synchronization.

**Content and actions:** remaining time, associated exercise/set, pause/resume, reset, extend/reduce, dismiss, sound/haptic status, and device sync state.

**States:** inactive; running; paused; elapsed; automatically started; phone-primary versus watch-primary feedback; phone/watch temporarily disconnected; notification permission unavailable.

### P-18 — Workout note and timing

**Scope:** Initial  
**Purpose:** Capture workout-level context without creating logging friction.

**Entry:** Workout detail controls.

**Content and actions:** workout title/note; start/end timestamps; manual time adjustment; duration; complete/reopen action.

**States:** no title/note/time; timer-started workout; manually dated workout; invalid end-before-start correction; unsaved change confirmation.

### P-19 — Superset/circuit editor

**Scope:** Initial  
**Purpose:** Arrange exercises into an ordered training flow for the current workout.

**Entry:** Workout detail; Exercise logging navigation; routine materialization review.

**Content and actions:** create/rename group; colour; choose/reorder members; auto-advance; rest timing behaviour; dissolve group; preview progression.

**States:** no groups; two-exercise superset; tri-set/circuit; an exercise belongs to a group; incomplete group; deleting a member; historical workout editing.

### P-20 — Routine materialization review

**Scope:** Initial  
**Purpose:** Let the user adapt a routine before it creates editable workout sets.

**Entry:** Today; Quick start; Plan → Routine section.

**Content and actions:** choose routine section(s); include/deselect/reorder exercises; inspect planned values; choose explicit targets or last-performance seeding; create workout; optionally create supersets from routine structure.

**States:** empty routine section; no prior performance for a seeded template; routine has existing exercise in active workout; partial materialization; cancelled review leaves no unwanted sets.

### P-21 — Workout actions

**Scope:** Initial  
**Purpose:** Group lower-frequency workout operations without hiding their consequences.

**Entry:** Workout detail overflow/action sheet.

**Content and actions:** copy/duplicate, move date, merge/separate same-day workout, share (planned), export selected workout (planned), delete, and view metadata.

**States:** no eligible prior workout; partial-selection copy; move conflict; destructive confirmation with affected set count; restored/archived workout.

## 5. Phone: Plan and exercise management

### P-30 — Plan / routine list

**Scope:** Initial  
**Purpose:** Find, launch, and manage reusable workout templates.

**Entry:** primary navigation; Today quick start.

**Content and actions:** routine list; search; create routine; favourite/pin routine; open routine; start a selected section.

**States:** no routines; one-section routine; multi-section programme; archived routine; search no results.

### P-31 — Routine detail

**Scope:** Initial  
**Purpose:** Explain what a routine will create and provide direct start actions.

**Entry:** Routine list; widget/shortcut (planned).

**Content and actions:** routine description; sections; exercise and set-template previews; start section/all; edit routine; duplicate/archive routine.

**States:** no sections; empty section; explicit targets; history-seeded targets; deleted/archived referenced exercise.

### P-32 — Routine editor

**Scope:** Initial  
**Purpose:** Create and maintain a reusable programme without conflating it with history.

**Entry:** Routine list/detail.

**Content and actions:** routine name/notes; add/reorder/delete sections; add/reorder exercise; set template editor; population rule; optional superset metadata.

**States:** new draft; unsaved changes; duplicate routine; missing exercise; destructive section deletion; templates with multiple metric profiles.

### P-33 — Exercise library

**Scope:** Initial  
**Purpose:** Browse and maintain the reusable exercise catalogue outside a workout.

**Entry:** Plan; Add exercise; Settings/category management.

**Content and actions:** category/favourites/recent tabs or filters; search; exercise count/last-used context; create/edit/archive exercise; open exercise history.

**States:** empty library; no favourites; search results; archived items; category removed; no workout history.

### P-34 — Exercise definition editor

**Scope:** Initial  
**Purpose:** Define the reusable behaviour of an exercise.

**Entry:** Exercise library; Add exercise; exercise actions.

**Content and actions:** name, category, metric profile, favourite, note/URL, unit/increment/rest/graph defaults, archive. Explain the impact of metric-profile changes.

**States:** new exercise; duplicate name; metric profile with incompatible history; archived exercise; discard unsaved changes; accessibility-friendly form validation.

### P-35 — Category editor

**Scope:** Initial  
**Purpose:** Manage user-owned exercise taxonomy.

**Entry:** Exercise library/category filter; Settings.

**Content and actions:** create/rename/recolour/reorder/archive category; reassign exercises before archival/deletion.

**States:** empty category; category has exercises; colour contrast warning; reassign required; sort/reorder mode.

## 6. Phone: History and progress

### P-40 — History hub

**Scope:** Initial  
**Purpose:** Choose a historical browsing mode and preserve filters across it.

**Entry:** primary navigation; exercise or graph drill-down.

**Content and actions:** Calendar/List switch; active exercise/category/date filter summary; recent workouts; quick jump to today.

**States:** no history; filtered-empty history; imported history; multiple same-day workouts; background calculation/loading.

### P-41 — Calendar

**Scope:** Initial  
**Purpose:** Browse workouts spatially by date.

**Entry:** History hub.

**Content and actions:** month navigation; workout indicators/category summary; select date; filters; jump to today; switch to list.

**States:** no workouts month; one/multiple workouts same date; filters active; accessible non-colour indicators; daylight-saving/timezone date boundaries.

### P-42 — Workout history list

**Scope:** Initial  
**Purpose:** Browse workouts chronologically and scan their contents.

**Entry:** History hub; Calendar switch; search/filter result.

**Content and actions:** date, workout title/duration, exercises, compact set summaries, filters, open workout, load earlier history.

**States:** empty; loading earlier pages; filter no result; same-day sessions; deleted/archived exercise display.

### P-43 — Historical workout detail

**Scope:** Initial  
**Purpose:** Inspect and correct a past workout using the same durable data model as the active workout.

**Entry:** Calendar; History list; graph/stat/record drill-down.

**Content and actions:** all Workout detail operations, clearly dated; edit sets; copy to another date; open exercise detail; inspect notes/timing/supersets.

**States:** completed; imported (FitNotes or Health Connect — see P-03, P-65); archived exercise/category; source for a personal record; read-only only while an explicit conflict/restore operation is in progress.

### P-44 — Exercise detail

**Scope:** Initial  
**Purpose:** Be the durable analytical home for one exercise.

**Entry:** Exercise logging; Exercise library; History; Progress; record/goal links.

**Content and actions:** summary, recent history, graph, records, statistics, goals (planned where necessary), exercise settings, links to originating workouts.

**States:** no history; one logged set; metric-profile change in history; inactive/archived exercise; large history loading; filters/date range.

### P-45 — Exercise graph

**Scope:** Initial  
**Purpose:** Show change over time while preserving a route to evidence.

**Entry:** Exercise detail.

**Content and actions:** metric selector, period selector, trend/point controls, point inspection, link to source workout/set, explanatory calculation text.

**States:** insufficient data; data gaps; no valid metric for selected profile; imported values requiring conversion; chart accessible summary/table alternative.

### P-46 — Records and statistics

**Scope:** Initial for basic records/statistics; Planned for advanced configurations  
**Purpose:** Explain best performance and period summaries without obscuring whether they are actual or estimated.

**Entry:** Exercise detail; Progress.

**Content and actions:** actual PRs; estimated 1RM PRs; calculation details; workout/week/month/year/custom statistics; drill to source set/workout; recompute records.

**States:** no eligible records; tied records; incomplete/planned sets excluded as configured; estimate formula limitation; recalculation running/error.

### P-47 — Training analysis

**Scope:** Initial basic; Planned advanced  
**Purpose:** Answer how training volume, frequency, duration, and composition are changing overall.

**Entry:** Progress primary destination.

**Content and actions:** period, metric, category/exercise filters, comparison, category/exercise breakdown, drill-down to exercise/workout.

**States:** no data; filtered-empty result; long time range computing; data with no volume-compatible sets; accessible table alternative.

### P-48 — Exercise goals

**Scope:** Planned  
**Purpose:** Define and review an exercise-specific target.

**Entry:** Exercise detail; Progress.

**Content and actions:** title; target metrics; start/target dates; progress; edit/archive goal; source performance reference.

**States:** no goals; achieved; overdue; no compatible performance yet; metric profile changed.

### P-49 — Measurement tracker

**Scope:** Planned  
**Purpose:** Record generic body/custom measurements separately from a workout.

**Entry:** Progress; Today shortcut (optional).

**Content and actions:** enabled measurement list, current values, log record, open history/graph, manage definitions.

**States:** no enabled measurements; no records; unit-specific values; multiple readings in a day; record imported from Health Connect (Planned — see P-65) shown with source provenance.

### P-50 — Measurement detail and editor

**Scope:** Planned  
**Purpose:** View a measurement's trend and maintain its definition/records.

**Entry:** Measurement tracker.

**Content and actions:** graph/history; add/edit/delete record; definition name/unit/goal/enabled/order; source/provenance display.

**States:** empty history; goal line; duplicate timestamp; archived definition; health-imported record (Planned) clearly marked as external and not directly editable to the same degree as a manual entry.

## 7. Phone: settings, data, and connected devices

### P-60 — Settings hub

**Scope:** Initial  
**Purpose:** Organize durable application choices away from workout flow.

**Entry:** profile/settings primary destination or overflow.

**Content and actions:** units, appearance, accessibility, timer/workout behaviour, history/progress preferences, data, connected devices, privacy/permissions, about/help.

**States:** changed defaults with impact explanation; system theme; permissions denied; managed/no cloud service.

### P-61 — Timer and workout preferences

**Scope:** Initial  
**Purpose:** Configure reliable, user-controlled timer behaviour.

**Entry:** Settings.

**Content and actions:** default rest duration, auto-start rules, vibration, sound, notification permission status, keep-screen-on, workout timer defaults, phone/watch feedback preference.

**States:** notifications denied; no paired watch; haptics unavailable; per-exercise override active.

### P-62 — Data management

**Scope:** Initial  
**Purpose:** Keep backup, restore, import, export, and deletion explicit and recoverable.

**Entry:** Settings.

**Content and actions:** complete backup; restore; FitNotes import; spreadsheet export; integrity check; backup destination; delete all history/data with clear scope.

**States:** no writable destination; backup created/verified; restore compatibility warning; insufficient storage; failed validation; destructive confirmation and recovery information.

### P-63 — Connected watch and sync status

**Scope:** Initial  
**Purpose:** Make phone/watch ownership, connection, data state, and troubleshooting legible.

**Entry:** Settings; active-workout sync warning; first watch connection.

**Content and actions:** pairing/availability status; last sync; active workout sync state; queued change count; resync; disconnect/remove watch data; help.

**States:** no compatible watch; paired/connected; temporarily disconnected; update required; queued mutations; material conflict needing review; watch app removed.

### P-64 — Health Connect settings

**Scope:** Planned  
**Purpose:** Make Cadence's two independent Health Connect directions — export and import — legible and separately controllable, without gating core workout logging on either.

**Entry:** Settings; health feature call-to-action; first Health Connect-eligible workout completion.

**Content and actions:** explain what export and import each do in plain language; grant/revoke the write permission (export) and the read permission (import) independently; show last export time and any export failures; open Health Connect import review (P-65); explain and control export/import for measurements (bodyweight etc., shared with P-49/P-50); link to Android's Health Connect app settings for full permission control; delete Cadence's Health Connect-imported data where supported.

**States:** Health Connect not installed/available; export-only granted; import-only granted; both granted; both denied; a grant revoked outside Cadence (detected on next launch); no health data yet. Core workout UI remains fully unchanged regardless of state.

### P-65 — Health Connect import review

**Scope:** Planned  
**Purpose:** Let the user selectively bring externally-tracked exercise sessions into Cadence history, without ever auto-importing or conflating them with manually logged workouts. Mirrors the reviewed-staging pattern of P-20 Routine materialization review.

**Entry:** P-64 Health Connect settings; a notification-free periodic check (no auto-import); History hub call-to-action when candidates exist.

**Content and actions:** list of `HealthImportCandidate` records not yet reviewed (source app, date, duration, recognized metric summary); inspect one candidate; map it to an existing exercise/metric profile where recognizable or leave unmapped for manual follow-up; import selected candidate(s) as provenance-tagged workouts; dismiss a candidate without importing (does not delete it from Health Connect); resolve an overlap warning against an existing manually logged workout.

**States:** no candidates; unmapped metric type; recognized metric type with confident mapping; candidate overlaps an existing Cadence workout (must be explicitly resolved, never silently merged); already-imported candidate (deduplicated by external record ID, shown as such rather than hidden); import failure with retry.

## 8. Wear OS: active workout execution

### W-01 — Watch home

**Scope:** Initial  
**Purpose:** Get a user into the right workout in one or two actions.

**Entry:** launcher; tile/complication (planned); notification/deep link; app resume.

**Content and actions:** resume active workout; start from a small synced list of recents/favourites/routines; show current rest countdown; indicate disconnected/queued state.

**States:** no active workout; active workout; no paired phone; watch-only cached workout; sync loading; no cached exercises; battery-saving/ambient mode.

### W-02 — Current exercise

**Scope:** Initial  
**Purpose:** Present the next set and the most useful workout context at a glance.

**Entry:** Watch home; exercise picker; auto-advance; timer return; phone hand-off.

**Content and actions:** exercise name; current/next planned set; prior comparable set; completed/planned set count; Log/Complete action; edit/add set; rest status; next exercise/superset cue.

**States:** manual new set; planned set; all exercise sets complete; no prior history; exercise note available; timer running; watch offline; phone changed current exercise.

### W-03 — Watch set entry and edit

**Scope:** Initial  
**Purpose:** Make precise, practical wrist entry possible without a tiny keyboard.

**Entry:** Current exercise; selected set; quick repeat; add set.

**Content and actions:** large increment/decrement controls; rotary input where available; prior-set suggestion; metric-specific fields; log/complete/update; undo; completion toggle.

**States:** Weight + Reps; Distance + Duration; Reps Only; Weight Only; Duration Only; invalid or missing input; unit display; planned versus completed; queued offline save; conflict detected after sync.

### W-04 — Exercise picker and superset navigator

**Scope:** Initial  
**Purpose:** Move through a workout without extracting the phone.

**Entry:** Current exercise; auto-advance; workout controls.

**Content and actions:** ordered exercise list, completion markers, current superset round, next/previous exercise, direct selection, add a simple ad-hoc exercise from cached favourites/recents when supported.

**States:** no exercises; regular ordered workout; superset/circuit; all complete; offline cache cannot offer new library search; phone has reordered workout.

### W-05 — Rest timer

**Scope:** Initial  
**Purpose:** Be the primary on-body countdown and rest-complete feedback mechanism.

**Entry:** automatic after configured set action; Current exercise; Watch home; notification/tile.

**Content and actions:** large remaining time; pause/resume; reset; extend/reduce; dismiss; exercise/next-action label; haptic status.

**States:** inactive; running; paused; elapsed; ambient display; device temporarily disconnected; phone also displaying timer; haptics disabled/unavailable.

### W-06 — Watch workout controls

**Scope:** Initial  
**Purpose:** Provide lightweight session-wide actions without recreating phone management UI.

**Entry:** Current exercise or exercise picker overflow.

**Content and actions:** workout summary, return to phone, start/stop workout timer, mark workout complete/reopen, end display session, sync status.

**States:** empty workout; active; complete; queued mutations; phone unavailable; destructive end/discard confirmation for an empty draft only.

### W-07 — Sync and conflict status

**Scope:** Initial  
**Purpose:** Explain a meaningful device-state problem without interrupting set logging unnecessarily.

**Entry:** persistent compact indicator; Watch home; after a failed/queued mutation; Settings hand-off to phone.

**Content and actions:** connected/offline/queue status; last successful sync; retry; view concise conflict explanation; send user to phone for material conflict resolution.

**States:** connected; syncing; temporary disconnect; queued; retrying; unrecoverable protocol/version issue; same-field conflict. A logged local set must remain visible and marked as pending, never disappear.

## 9. Wear OS: planned system surfaces

### W-10 — Tile

**Scope:** Planned  
**Purpose:** Offer an at-a-glance active timer/workout status or quick start.

**Entry:** Wear OS tile carousel.

**Content and actions:** current rest countdown or resume workout; quick start; last sync indicator.

**States:** no active workout; timer active; phone disconnected; ambient/privacy-safe content.

### W-11 — Complication

**Scope:** Planned  
**Purpose:** Provide a small, user-configured shortcut/status indicator.

**Entry:** watch face complication.

**Content and actions:** rest countdown, active-workout dot, or Cadence quick start; opens Watch home/Rest timer.

**States:** no active workout; timer active; privacy mode hides details; complication provider unavailable.

## 10. System-owned surfaces to design with

| ID   | Surface                             | Scope          | Cadence responsibility and critical states                                                                                                                                     |
| ---- | ----------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S-01 | Android active-workout notification | Initial        | Show active workout/rest state and safe controls; permission denied; phone locked; timer elapsed; watch-primary haptics.                                                       |
| S-02 | Wear OS timer notification          | Initial        | Surface ongoing rest countdown and open W-05; ambient mode; dismissed notification; haptics complete.                                                                          |
| S-03 | Android document picker             | Initial        | Select import/restore source and backup/export destination; cancelled; inaccessible provider; duplicate filename.                                                              |
| S-04 | Android share sheet                 | Planned        | Share user-selected workout text only; no available target; cancelled; private fields excluded.                                                                                |
| S-05 | Android home-screen widget          | Planned        | Resume active workout/rest timer/quick start; stale widget refresh; no active workout; privacy-safe display.                                                                   |
| S-06 | Health Connect consent UI           | Planned        | Android's own permission prompt for the export (write) and import (read) scopes requested from P-64; declined/revoked/unavailable; core app still works regardless of outcome. |
| S-07 | Platform permission prompts         | Initial/Future | Explain notification/haptics-related needs before prompt; denied/retry; no coercive blocking.                                                                                  |

## 11. Cross-screen state matrix

| State                                      | Phone surfaces affected                             | Watch surfaces affected                    | Required behaviour                                                                        |
| ------------------------------------------ | --------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| No workout yet                             | Today, Quick start, History                         | Watch home                                 | Make first exercise/routine discoverable; do not show an error.                           |
| Empty workout                              | Today, Workout detail                               | Watch home, Workout controls               | Allow adding an exercise or safely discarding the draft.                                  |
| Active manual workout                      | Today, Workout detail, Exercise logging             | Current exercise, Exercise picker          | Show next useful action and durable state.                                                |
| Planned workout                            | Workout detail, Exercise logging                    | Current exercise                           | Clearly distinguish planned/incomplete from completed while allowing edits.               |
| Rest timer running                         | Today, Logging, Timer, notification                 | Current exercise, Rest timer, notification | Same logical expiry; avoid duplicate alerts; retain context after sleep/backgrounding.    |
| All sets complete                          | Workout detail, Logging                             | Current exercise, Workout controls         | Offer next exercise/workout completion; never force closure.                              |
| Phone/watch disconnected                   | Sync status, active workout                         | Watch home, Current exercise, Sync status  | Continue locally; visibly queue changes; never lose or duplicate a set.                   |
| Historical workout                         | History, Calendar, Workout detail, Exercise detail  | Not normally shown as an execution flow    | Remains editable and traceable from analytics.                                            |
| No history for exercise                    | Logging, Exercise detail, Graph                     | Current exercise                           | Replace charts/previous set with useful empty guidance.                                   |
| Import/restore in progress                 | Data management, recovery prompt                    | Watch sync status                          | Suspend or carefully queue sync; show durable completion/failure result.                  |
| Health Connect import candidates available | History hub, Health Connect settings, Import review | Not shown on watch                         | Surface as a discoverable, dismissible call-to-action; never auto-import.                 |
| Accessibility mode                         | All                                                 | All                                        | State is not colour-only; controls retain clear labels, focus order, and scalable layout. |

## 12. Implementation sequence

This sequence governs **build order**, not design order. The visual design pass covers the full screen inventory in this document as one cohesive system, so that navigation, components, and cross-screen states (§11) stay consistent from the start rather than drifting across separately designed batches. Implementation then proceeds incrementally against the same design system:

1. P-10 Today, P-12 Workout detail, P-14 Exercise logging, P-15 Set editor, and P-17 Rest timer.
2. W-01 Watch home, W-02 Current exercise, W-03 Watch set entry, W-05 Rest timer, and W-07 Sync status.
3. P-20 Routine materialization review and P-19 Superset editor, then their active-workout states.
4. P-40 through P-46 history/progress flows.
5. Plan management, settings/data, and planned system integrations, including P-64/P-65 Health Connect export and import.

Every prototype in the first two steps must cover at least: no workout, planned set, completed set, active rest timer, a temporary phone/watch disconnect, and a resumed workout after interruption.
