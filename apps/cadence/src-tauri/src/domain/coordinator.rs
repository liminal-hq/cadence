// Transaction boundaries, revision stamping, cross-entity invariants, and event emission
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::collections::HashMap;
use std::time::Duration;

use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

use super::barbells::models::{BarbellConfig, NewBarbellConfig};
use super::barbells::plates::{self, PlateCalculationResult};
use super::error::Result;
use super::events::REST_TIMER_CHANGED;
use super::exercises::models::Exercise;
use super::history::HistorySummary;
use super::rest_timer::models::{RestTimerState, StartRestTimerOptions};
use super::sets::models::{SetEntry, SetValues};
use super::settings::models::{Settings, SettingsPatch};
use super::units::kg_to_g;
use super::workouts::models::{Workout, WorkoutExercise};
use super::{barbells, exercises, history, rest_timer, sets, settings, workouts};

/// Everything the plain per-entity repo functions deliberately don't do. This is the one piece of
/// the crate that needs an `AppHandle` (to emit events) and is generic over the Tauri runtime so
/// it can be exercised in tests against `tauri::test::MockRuntime` the same way production code
/// uses it against the real `Wry` runtime.
pub struct Coordinator<R: Runtime = tauri::Wry> {
    pool: SqlitePool,
    app: AppHandle<R>,
    scheduled_elapse: Mutex<Option<JoinHandle<()>>>,
}

impl<R: Runtime> Coordinator<R> {
    pub fn new(pool: SqlitePool, app: AppHandle<R>) -> Self {
        Coordinator {
            pool,
            app,
            scheduled_elapse: Mutex::new(None),
        }
    }

    // ============ exercises ============

    pub async fn get_exercise(&self, id: &str) -> Result<Exercise> {
        let mut conn = self.pool.acquire().await?;
        exercises::repo::get(&mut conn, id).await
    }

    pub async fn list_exercises(&self) -> Result<Vec<Exercise>> {
        let mut conn = self.pool.acquire().await?;
        exercises::repo::list(&mut conn).await
    }

    pub async fn update_exercise_favourite(&self, id: &str, favourite: bool) -> Result<Exercise> {
        let mut conn = self.pool.acquire().await?;
        exercises::repo::update_favourite(&mut conn, id, favourite).await
    }

    // ============ workouts / workout-exercises ============

    pub async fn get_workout(&self, id: &str) -> Result<Workout> {
        let mut conn = self.pool.acquire().await?;
        workouts::repo::get(&mut conn, id).await
    }

    pub async fn list_workouts_in_range(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<Workout>> {
        let mut conn = self.pool.acquire().await?;
        workouts::repo::list_in_range(&mut conn, start_date, end_date).await
    }

    pub async fn update_workout_note(&self, id: &str, note: Option<&str>) -> Result<Workout> {
        let mut conn = self.pool.acquire().await?;
        workouts::repo::update_note(&mut conn, id, note).await
    }

    pub async fn get_workout_exercise(&self, id: &str) -> Result<WorkoutExercise> {
        let mut conn = self.pool.acquire().await?;
        workouts::workout_exercises::get(&mut conn, id).await
    }

    pub async fn list_workout_exercises_by_workout(
        &self,
        workout_id: &str,
    ) -> Result<Vec<WorkoutExercise>> {
        let mut conn = self.pool.acquire().await?;
        workouts::workout_exercises::list_by_workout(&mut conn, workout_id).await
    }

    pub async fn list_workout_exercises_by_exercise(
        &self,
        exercise_id: &str,
    ) -> Result<Vec<WorkoutExercise>> {
        let mut conn = self.pool.acquire().await?;
        workouts::workout_exercises::list_by_exercise(&mut conn, exercise_id).await
    }

    pub async fn update_today_note(
        &self,
        workout_exercise_id: &str,
        note: Option<&str>,
    ) -> Result<WorkoutExercise> {
        let mut conn = self.pool.acquire().await?;
        workouts::workout_exercises::update_today_note(&mut conn, workout_exercise_id, note).await
    }

    /// "Start workout" with minimal ceremony (SPEC.md 8.1): an in-progress, manually-sourced
    /// workout with no exercises yet — adding the first one is a separate `add_workout_exercise`
    /// call, not part of creation.
    pub async fn create_workout(&self, local_date: &str, title: &str) -> Result<Workout> {
        let mut conn = self.pool.acquire().await?;
        workouts::repo::create(&mut conn, local_date, title).await
    }

    pub async fn add_workout_exercise(
        &self,
        workout_id: &str,
        exercise_id: &str,
    ) -> Result<WorkoutExercise> {
        let mut conn = self.pool.acquire().await?;
        workouts::workout_exercises::add(&mut conn, workout_id, exercise_id).await
    }

    pub async fn delete_workout_exercise(&self, id: &str) -> Result<()> {
        let mut conn = self.pool.acquire().await?;
        workouts::workout_exercises::delete(&mut conn, id).await
    }

    /// Copies every workout-exercise and set from `workout_id` into a new planned workout dated
    /// `target_date` — mirrors `duplicateWorkout`'s reset-on-copy semantics exactly (today_note/
    /// offline_since dropped, sets reset to planned), but rebuilds supersets as new rows scoped to
    /// the new workout rather than copying the source superset id verbatim, since this schema's
    /// `supersets.workout_id` foreign key would otherwise point a new workout-exercise at another
    /// workout's superset.
    pub async fn duplicate_workout(&self, workout_id: &str, target_date: &str) -> Result<Workout> {
        let mut tx = self.pool.begin().await?;

        let source = workouts::repo::get(&mut tx, workout_id).await?;
        let source_workout_exercises =
            workouts::workout_exercises::list_by_workout(&mut tx, workout_id).await?;

        let now = chrono::Utc::now().timestamp_millis();
        let new_workout_id = uuid::Uuid::new_v4().to_string();
        let workout_revision = crate::db::next_revision(&mut tx).await?;
        sqlx::query(
            "INSERT INTO workouts (id, local_date, title, status, source, logged_by_watch, \
             created_at_ms, updated_at_ms, revision) \
             VALUES (?, ?, ?, 'in-progress', 'manual', 0, ?, ?, ?)",
        )
        .bind(&new_workout_id)
        .bind(target_date)
        .bind(&source.title)
        .bind(now)
        .bind(now)
        .bind(workout_revision)
        .execute(&mut *tx)
        .await?;

        let mut superset_id_map: HashMap<String, String> = HashMap::new();

        for source_we in &source_workout_exercises {
            let new_superset_id = match &source_we.superset_group_id {
                None => None,
                Some(old_superset_id) => {
                    if let Some(existing) = superset_id_map.get(old_superset_id) {
                        Some(existing.clone())
                    } else {
                        let new_id = uuid::Uuid::new_v4().to_string();
                        let revision = crate::db::next_revision(&mut tx).await?;
                        sqlx::query(
                            "INSERT INTO supersets (id, workout_id, created_at_ms, \
                             updated_at_ms, revision) VALUES (?, ?, ?, ?, ?)",
                        )
                        .bind(&new_id)
                        .bind(&new_workout_id)
                        .bind(now)
                        .bind(now)
                        .bind(revision)
                        .execute(&mut *tx)
                        .await?;
                        superset_id_map.insert(old_superset_id.clone(), new_id.clone());
                        Some(new_id)
                    }
                }
            };

            let new_we_id = uuid::Uuid::new_v4().to_string();
            let we_revision = crate::db::next_revision(&mut tx).await?;
            sqlx::query(
                "INSERT INTO workout_exercises (id, workout_id, exercise_id, sort_order, \
                 superset_id, superset_position, created_at_ms, updated_at_ms, revision) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&new_we_id)
            .bind(&new_workout_id)
            .bind(&source_we.exercise_id)
            .bind(source_we.order)
            .bind(&new_superset_id)
            .bind(source_we.superset_position)
            .bind(now)
            .bind(now)
            .bind(we_revision)
            .execute(&mut *tx)
            .await?;

            let source_sets = sets::repo::list(&mut tx, &source_we.id).await?;
            for source_set in source_sets {
                let new_set_id = uuid::Uuid::new_v4().to_string();
                let set_revision = crate::db::next_revision(&mut tx).await?;
                sqlx::query(
                    "INSERT INTO sets (id, workout_id, workout_exercise_id, exercise_id, \
                     sort_order, status, weight_g, reps, distance_m, duration_s, note, \
                     pending_sync, created_at_ms, updated_at_ms, revision) \
                     VALUES (?, ?, ?, ?, ?, 'planned', ?, ?, ?, ?, ?, 0, ?, ?, ?)",
                )
                .bind(&new_set_id)
                .bind(&new_workout_id)
                .bind(&new_we_id)
                .bind(&source_we.exercise_id)
                .bind(source_set.order)
                .bind(source_set.weight_kg.map(kg_to_g))
                .bind(source_set.reps)
                .bind(source_set.distance_km.map(super::units::km_to_m))
                .bind(source_set.duration_sec)
                .bind(&source_set.note)
                .bind(now)
                .bind(now)
                .bind(set_revision)
                .execute(&mut *tx)
                .await?;
            }
        }

        tx.commit().await?;
        let mut conn = self.pool.acquire().await?;
        workouts::repo::get(&mut conn, &new_workout_id).await
    }

    // ============ sets ============

    pub async fn list_sets(&self, workout_exercise_id: &str) -> Result<Vec<SetEntry>> {
        let mut conn = self.pool.acquire().await?;
        sets::repo::list(&mut conn, workout_exercise_id).await
    }

    pub async fn save_set(&self, set: &SetEntry) -> Result<SetEntry> {
        let mut conn = self.pool.acquire().await?;
        sets::repo::save(&mut conn, set).await
    }

    pub async fn complete_set(&self, id: &str) -> Result<SetEntry> {
        let mut conn = self.pool.acquire().await?;
        sets::repo::complete(&mut conn, id).await
    }

    pub async fn add_set(&self, workout_exercise_id: &str) -> Result<SetEntry> {
        let mut conn = self.pool.acquire().await?;
        sets::repo::add(&mut conn, workout_exercise_id).await
    }

    pub async fn log_new_set(
        &self,
        workout_exercise_id: &str,
        values: &SetValues,
    ) -> Result<SetEntry> {
        let mut conn = self.pool.acquire().await?;
        sets::repo::log_new(&mut conn, workout_exercise_id, values).await
    }

    pub async fn duplicate_set(&self, id: &str) -> Result<SetEntry> {
        let mut conn = self.pool.acquire().await?;
        sets::repo::duplicate(&mut conn, id).await
    }

    pub async fn delete_set(&self, id: &str) -> Result<()> {
        let mut conn = self.pool.acquire().await?;
        sets::repo::delete(&mut conn, id).await
    }

    pub async fn update_set_note(&self, id: &str, note: Option<&str>) -> Result<SetEntry> {
        let mut conn = self.pool.acquire().await?;
        sets::repo::update_note(&mut conn, id, note).await
    }

    // ============ barbells / plates ============

    pub async fn list_barbell_configs(&self) -> Result<Vec<BarbellConfig>> {
        let mut conn = self.pool.acquire().await?;
        barbells::repo::list(&mut conn).await
    }

    /// `target_weight` is in `barbell.display_unit` — converted to the same milli-unit space as
    /// the barbell's own stored plates before the pure calculator runs.
    pub fn calculate_plates(
        &self,
        target_weight: f64,
        barbell: &BarbellConfig,
    ) -> PlateCalculationResult {
        let plates_milli: Vec<i64> = barbell
            .available_plates
            .iter()
            .map(|&p| super::units::unit_to_milli(p))
            .collect();
        plates::calculate_plates(
            super::units::unit_to_milli(target_weight),
            super::units::unit_to_milli(barbell.bar_weight),
            &plates_milli,
        )
    }

    pub async fn add_barbell_config(&self, config: &NewBarbellConfig) -> Result<BarbellConfig> {
        let mut conn = self.pool.acquire().await?;
        barbells::repo::add(&mut conn, config).await
    }

    pub async fn update_barbell_config(&self, config: &BarbellConfig) -> Result<BarbellConfig> {
        let mut conn = self.pool.acquire().await?;
        barbells::repo::update(&mut conn, config).await
    }

    pub async fn delete_barbell_config(&self, id: &str) -> Result<()> {
        let mut conn = self.pool.acquire().await?;
        barbells::repo::delete(&mut conn, id).await
    }

    // ============ settings ============

    pub async fn get_settings(&self) -> Result<Settings> {
        let mut conn = self.pool.acquire().await?;
        settings::repo::get(&mut conn).await
    }

    pub async fn update_settings(&self, patch: &SettingsPatch) -> Result<Settings> {
        let mut conn = self.pool.acquire().await?;
        settings::repo::update(&mut conn, patch).await
    }

    // ============ history ============

    pub async fn get_history_summary(&self) -> Result<HistorySummary> {
        let mut conn = self.pool.acquire().await?;
        history::get_summary(&mut conn).await
    }

    /// Clears completed history, then resets the rest timer to inactive — mirrors the mock's own
    /// `deleteAllHistory`, which also cancels any scheduled elapse and blanks the timer state.
    pub async fn delete_all_history(&self) -> Result<()> {
        {
            let mut conn = self.pool.acquire().await?;
            history::delete_all(&mut conn).await?;
        }
        self.dismiss_rest_timer().await?;
        Ok(())
    }

    // ============ rest timer ============

    async fn clear_scheduled_elapse(&self) {
        if let Some(handle) = self.scheduled_elapse.lock().await.take() {
            handle.abort();
        }
    }

    /// Persists a rest-timer state and emits the change event — the common tail of every
    /// foreground transition below.
    async fn persist_and_emit_rest_timer(
        &self,
        conn: &mut sqlx::SqliteConnection,
        next: &RestTimerState,
    ) -> Result<RestTimerState> {
        let saved = rest_timer::repo::set(conn, next).await?;
        let _ = self.app.emit(REST_TIMER_CHANGED, &saved);
        Ok(saved)
    }

    /// Spawns a task that marks the timer elapsed and emits the change event once `remaining_ms`
    /// passes, unless something else (pause/dismiss/resume/extend) cancels it first — mirrors
    /// the mock's own `scheduleElapse`/`clearScheduledElapse` pair, using `tokio::spawn`/`abort`
    /// in place of `setTimeout`/`clearTimeout`. `expected_target_instant` guards against the
    /// unavoidable gap between `abort()` being requested and the task actually observing it
    /// (`abort` is cooperative, only taking effect at the task's next await point): if the row's
    /// `target_instant` no longer matches what this task was scheduled for by the time it wakes,
    /// some other transition already superseded it, so it's a no-op instead of clobbering
    /// whatever that transition wrote (e.g. a dismiss that landed in the same instant).
    async fn schedule_elapse(&self, remaining_ms: i64, expected_target_instant: String)
    where
        R: 'static,
    {
        self.clear_scheduled_elapse().await;
        let pool = self.pool.clone();
        let app = self.app.clone();
        let handle = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(remaining_ms.max(0) as u64)).await;
            let Ok(mut conn) = pool.acquire().await else {
                return;
            };
            let Ok(current) = rest_timer::repo::get(&mut conn).await else {
                return;
            };
            if current.status != "running"
                || current.target_instant.as_deref() != Some(expected_target_instant.as_str())
            {
                return;
            }
            let elapsed = RestTimerState {
                status: "elapsed".to_string(),
                ..current
            };
            // A background task has no caller to report a failed persist/emit to; swallowing is
            // deliberate here, unlike the foreground transitions' `?`-propagating counterpart.
            if let Ok(saved) = rest_timer::repo::set(&mut conn, &elapsed).await {
                let _ = app.emit(REST_TIMER_CHANGED, &saved);
            }
        });
        *self.scheduled_elapse.lock().await = Some(handle);
    }

    pub async fn get_rest_timer_state(&self) -> Result<RestTimerState> {
        let mut conn = self.pool.acquire().await?;
        rest_timer::repo::get(&mut conn).await
    }

    /// Reconciles the persisted timer row against the wall clock at startup — a process restart
    /// loses the in-memory `scheduled_elapse` task entirely, so a timer that was `running` when
    /// the app last exited would otherwise stay stuck `running` forever, even if its target
    /// instant already passed while the app was closed. Called once from `lib.rs`'s setup hook,
    /// before the Coordinator is handed to any command.
    pub async fn rehydrate_rest_timer(&self) -> Result<()>
    where
        R: 'static,
    {
        let mut conn = self.pool.acquire().await?;
        let current = rest_timer::repo::get(&mut conn).await?;
        if current.status != "running" {
            return Ok(());
        }
        let Some(target_instant) = current.target_instant.clone() else {
            return Ok(());
        };
        let target_ms = super::units::iso_to_ms(&target_instant)?;
        let now = chrono::Utc::now().timestamp_millis();
        if now >= target_ms {
            let elapsed = RestTimerState {
                status: "elapsed".to_string(),
                ..current
            };
            self.persist_and_emit_rest_timer(&mut conn, &elapsed)
                .await?;
        } else {
            self.schedule_elapse(target_ms - now, target_instant).await;
        }
        Ok(())
    }

    /// "New rest replaces a running one" off: a request that arrives while one is already
    /// counting down is dropped rather than restarting the clock.
    pub async fn start_rest_timer(
        &self,
        total_ms: i64,
        options: &StartRestTimerOptions,
    ) -> Result<RestTimerState>
    where
        R: 'static,
    {
        let mut conn = self.pool.acquire().await?;
        let current = rest_timer::repo::get(&mut conn).await?;
        let settings = settings::repo::get(&mut conn).await?;
        if current.status == "running" && !settings.rest_replaces_running {
            return Ok(current);
        }
        let now = chrono::Utc::now().timestamp_millis();
        let target_instant = super::units::ms_to_iso(now + total_ms);
        let next = RestTimerState {
            status: "running".to_string(),
            target_instant: Some(target_instant),
            total_ms: Some(total_ms),
            remaining_ms_at_pause: None,
            owner_device: Some(
                options
                    .owner_device
                    .clone()
                    .unwrap_or_else(|| "phone".to_string()),
            ),
            for_set_id: options.for_set_id.clone(),
            next_set_label: options.next_set_label.clone(),
        };
        let saved = self.persist_and_emit_rest_timer(&mut conn, &next).await?;
        self.schedule_elapse(total_ms, saved.target_instant.clone().unwrap())
            .await;
        Ok(saved)
    }

    pub async fn pause_rest_timer(&self) -> Result<RestTimerState> {
        let mut conn = self.pool.acquire().await?;
        let current = rest_timer::repo::get(&mut conn).await?;
        let Some(target_instant) = current.target_instant.as_deref() else {
            return Ok(current);
        };
        if current.status != "running" {
            return Ok(current);
        }
        let now = chrono::Utc::now().timestamp_millis();
        let remaining_ms_at_pause = super::units::iso_to_ms(target_instant)? - now;
        self.clear_scheduled_elapse().await;
        let next = RestTimerState {
            status: "paused".to_string(),
            remaining_ms_at_pause: Some(remaining_ms_at_pause),
            ..current
        };
        self.persist_and_emit_rest_timer(&mut conn, &next).await
    }

    pub async fn resume_rest_timer(&self) -> Result<RestTimerState>
    where
        R: 'static,
    {
        let mut conn = self.pool.acquire().await?;
        let current = rest_timer::repo::get(&mut conn).await?;
        let (Some(remaining_ms), true) =
            (current.remaining_ms_at_pause, current.status == "paused")
        else {
            return Ok(current);
        };
        let now = chrono::Utc::now().timestamp_millis();
        let target_instant = super::units::ms_to_iso(now + remaining_ms);
        let next = RestTimerState {
            status: "running".to_string(),
            target_instant: Some(target_instant),
            remaining_ms_at_pause: None,
            ..current
        };
        let saved = self.persist_and_emit_rest_timer(&mut conn, &next).await?;
        self.schedule_elapse(remaining_ms, saved.target_instant.clone().unwrap())
            .await;
        Ok(saved)
    }

    pub async fn extend_rest_timer(&self, delta_ms: i64) -> Result<RestTimerState>
    where
        R: 'static,
    {
        let mut conn = self.pool.acquire().await?;
        let current = rest_timer::repo::get(&mut conn).await?;
        let next = match current.status.as_str() {
            "running" => {
                let target_instant_ms =
                    super::units::iso_to_ms(current.target_instant.as_deref().unwrap_or_default())?
                        + delta_ms;
                RestTimerState {
                    target_instant: Some(super::units::ms_to_iso(target_instant_ms)),
                    total_ms: Some(current.total_ms.unwrap_or(0) + delta_ms),
                    ..current
                }
            }
            "paused" => RestTimerState {
                remaining_ms_at_pause: Some(current.remaining_ms_at_pause.unwrap_or(0) + delta_ms),
                ..current
            },
            _ => return Ok(current),
        };
        // Persist *before* scheduling the new elapse — scheduling first (as an earlier version
        // of this code did) could spawn an immediately-runnable task (when the adjusted target is
        // already due) that reads the row before this write lands, then overwrites this write
        // with a stale "elapsed" a moment later.
        let saved = self.persist_and_emit_rest_timer(&mut conn, &next).await?;
        if saved.status == "running" {
            let target_instant = saved.target_instant.clone().unwrap();
            let remaining_ms =
                super::units::iso_to_ms(&target_instant)? - chrono::Utc::now().timestamp_millis();
            self.schedule_elapse(remaining_ms, target_instant).await;
        }
        Ok(saved)
    }

    pub async fn dismiss_rest_timer(&self) -> Result<RestTimerState> {
        self.clear_scheduled_elapse().await;
        let mut conn = self.pool.acquire().await?;
        self.persist_and_emit_rest_timer(&mut conn, &RestTimerState::inactive())
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;
    use tauri::test::{mock_app, MockRuntime};

    async fn test_coordinator() -> Coordinator<MockRuntime> {
        let pool = init_test_pool().await;
        let app = mock_app();
        Coordinator::new(pool, app.handle().clone())
    }

    #[tokio::test]
    async fn starts_a_rest_timer() {
        let c = test_coordinator().await;
        let state = c
            .start_rest_timer(120_000, &StartRestTimerOptions::default())
            .await
            .unwrap();
        assert_eq!(state.status, "running");
        assert_eq!(state.total_ms, Some(120_000));
        assert_eq!(state.owner_device.as_deref(), Some("phone"));
    }

    #[tokio::test]
    async fn a_second_start_is_dropped_while_replaces_running_is_off() {
        let c = test_coordinator().await;
        c.update_settings(&SettingsPatch {
            rest_replaces_running: Some(false),
            ..Default::default()
        })
        .await
        .unwrap();
        let first = c
            .start_rest_timer(120_000, &StartRestTimerOptions::default())
            .await
            .unwrap();
        let second = c
            .start_rest_timer(60_000, &StartRestTimerOptions::default())
            .await
            .unwrap();
        assert_eq!(first, second);
    }

    #[tokio::test]
    async fn a_second_start_replaces_the_running_timer_when_enabled() {
        let c = test_coordinator().await;
        c.update_settings(&SettingsPatch {
            rest_replaces_running: Some(true),
            ..Default::default()
        })
        .await
        .unwrap();
        c.start_rest_timer(120_000, &StartRestTimerOptions::default())
            .await
            .unwrap();
        let second = c
            .start_rest_timer(60_000, &StartRestTimerOptions::default())
            .await
            .unwrap();
        assert_eq!(second.total_ms, Some(60_000));
    }

    #[tokio::test]
    async fn pause_then_resume_round_trips_the_remaining_time() {
        let c = test_coordinator().await;
        c.start_rest_timer(120_000, &StartRestTimerOptions::default())
            .await
            .unwrap();
        let paused = c.pause_rest_timer().await.unwrap();
        assert_eq!(paused.status, "paused");
        assert!(paused.remaining_ms_at_pause.unwrap() > 0);

        let resumed = c.resume_rest_timer().await.unwrap();
        assert_eq!(resumed.status, "running");
        assert_eq!(resumed.remaining_ms_at_pause, None);
        assert!(resumed.target_instant.is_some());
    }

    #[tokio::test]
    async fn pausing_an_inactive_timer_is_a_no_op() {
        let c = test_coordinator().await;
        let state = c.pause_rest_timer().await.unwrap();
        assert_eq!(state.status, "inactive");
    }

    #[tokio::test]
    async fn extend_adds_time_while_running_and_while_paused() {
        let c = test_coordinator().await;
        c.start_rest_timer(60_000, &StartRestTimerOptions::default())
            .await
            .unwrap();
        let extended = c.extend_rest_timer(30_000).await.unwrap();
        assert_eq!(extended.total_ms, Some(90_000));

        let paused = c.pause_rest_timer().await.unwrap();
        let extended_while_paused = c.extend_rest_timer(15_000).await.unwrap();
        assert_eq!(
            extended_while_paused.remaining_ms_at_pause,
            Some(paused.remaining_ms_at_pause.unwrap() + 15_000)
        );
    }

    #[tokio::test]
    async fn dismiss_resets_to_a_bare_inactive_state() {
        let c = test_coordinator().await;
        c.start_rest_timer(60_000, &StartRestTimerOptions::default())
            .await
            .unwrap();
        let dismissed = c.dismiss_rest_timer().await.unwrap();
        assert_eq!(dismissed, RestTimerState::inactive());
    }

    #[tokio::test]
    async fn a_running_timer_elapses_on_its_own_after_the_scheduled_duration() {
        let c = test_coordinator().await;
        c.start_rest_timer(50, &StartRestTimerOptions::default())
            .await
            .unwrap();
        tokio::time::sleep(Duration::from_millis(200)).await;
        let state = c.get_rest_timer_state().await.unwrap();
        assert_eq!(state.status, "elapsed");
    }

    #[tokio::test]
    async fn dismissing_right_as_a_timer_elapses_is_not_clobbered_by_the_stale_elapse_task() {
        let c = test_coordinator().await;
        c.start_rest_timer(50, &StartRestTimerOptions::default())
            .await
            .unwrap();
        // Dismiss changes the row's target_instant (to None) well before the scheduled task
        // wakes; the guard token means that stale task must find its expectation no longer
        // matches and do nothing, rather than resurrecting the timer as "elapsed" afterwards.
        c.dismiss_rest_timer().await.unwrap();
        tokio::time::sleep(Duration::from_millis(200)).await;
        let state = c.get_rest_timer_state().await.unwrap();
        assert_eq!(state, RestTimerState::inactive());
    }

    #[tokio::test]
    async fn extending_a_timer_persists_before_any_new_elapse_task_can_run() {
        let c = test_coordinator().await;
        // A total_ms small enough that a naive "schedule first" ordering could let the spawned
        // task observe the row before extend's own write lands.
        c.start_rest_timer(10, &StartRestTimerOptions::default())
            .await
            .unwrap();
        let extended = c.extend_rest_timer(200).await.unwrap();
        assert_eq!(extended.status, "running");
        assert_eq!(extended.total_ms, Some(210));
        // The extended timer is genuinely running for a while yet, not already elapsed.
        tokio::time::sleep(Duration::from_millis(50)).await;
        let state = c.get_rest_timer_state().await.unwrap();
        assert_eq!(state.status, "running");
    }

    #[tokio::test]
    async fn rehydrate_reschedules_a_still_running_timer_found_at_startup() {
        let c = test_coordinator().await;
        c.start_rest_timer(50, &StartRestTimerOptions::default())
            .await
            .unwrap();
        // Simulate a process restart: a fresh Coordinator (empty scheduled_elapse) over the same
        // already-populated database.
        let restarted = Coordinator::new(c.pool.clone(), c.app.clone());
        restarted.rehydrate_rest_timer().await.unwrap();
        tokio::time::sleep(Duration::from_millis(200)).await;
        let state = restarted.get_rest_timer_state().await.unwrap();
        assert_eq!(state.status, "elapsed");
    }

    #[tokio::test]
    async fn rehydrate_immediately_elapses_a_timer_whose_target_already_passed() {
        let c = test_coordinator().await;
        c.start_rest_timer(60_000, &StartRestTimerOptions::default())
            .await
            .unwrap();
        // Force the persisted target into the past, simulating the app having been closed well
        // past the original duration.
        let mut conn = c.pool.acquire().await.unwrap();
        let past = RestTimerState {
            target_instant: Some(crate::domain::units::ms_to_iso(
                chrono::Utc::now().timestamp_millis() - 5_000,
            )),
            ..rest_timer::repo::get(&mut conn).await.unwrap()
        };
        rest_timer::repo::set(&mut conn, &past).await.unwrap();
        drop(conn);

        let restarted = Coordinator::new(c.pool.clone(), c.app.clone());
        restarted.rehydrate_rest_timer().await.unwrap();
        let state = restarted.get_rest_timer_state().await.unwrap();
        assert_eq!(state.status, "elapsed");
    }

    #[tokio::test]
    async fn rehydrate_leaves_a_paused_or_inactive_timer_alone() {
        let c = test_coordinator().await;
        let state = c.rehydrate_rest_timer().await;
        assert!(state.is_ok());
        assert_eq!(c.get_rest_timer_state().await.unwrap().status, "inactive");
    }

    #[tokio::test]
    async fn create_workout_starts_in_progress_with_no_exercises() {
        let c = test_coordinator().await;
        let created = c.create_workout("2026-09-10", "Push day").await.unwrap();
        assert_eq!(created.date, "2026-09-10");
        assert_eq!(created.title, "Push day");
        assert_eq!(created.status, "in-progress");
        assert_eq!(created.source, "manual");
        let workout_exercises = c
            .list_workout_exercises_by_workout(&created.id)
            .await
            .unwrap();
        assert!(workout_exercises.is_empty());
    }

    #[tokio::test]
    async fn add_workout_exercise_appends_to_a_freshly_created_workout() {
        let c = test_coordinator().await;
        let workout = c.create_workout("2026-09-10", "Push day").await.unwrap();
        let added = c
            .add_workout_exercise(&workout.id, "ex-bench-press")
            .await
            .unwrap();
        assert_eq!(added.order, 1);
        assert_eq!(added.workout_id, workout.id);
        let second = c
            .add_workout_exercise(&workout.id, "ex-goblet-squat")
            .await
            .unwrap();
        assert_eq!(second.order, 2);
    }

    #[tokio::test]
    async fn delete_workout_exercise_is_a_no_op_on_an_unknown_id() {
        let c = test_coordinator().await;
        c.delete_workout_exercise("no-such-we").await.unwrap();
    }

    #[tokio::test]
    async fn delete_workout_exercise_removes_it_from_its_workout() {
        let c = test_coordinator().await;
        let workout = c.create_workout("2026-09-10", "Push day").await.unwrap();
        let added = c
            .add_workout_exercise(&workout.id, "ex-bench-press")
            .await
            .unwrap();
        c.delete_workout_exercise(&added.id).await.unwrap();
        let remaining = c
            .list_workout_exercises_by_workout(&workout.id)
            .await
            .unwrap();
        assert!(remaining.is_empty());
    }

    #[tokio::test]
    async fn duplicate_workout_copies_sets_as_planned_and_drops_day_specific_fields() {
        let c = test_coordinator().await;
        let source = c.create_workout("2026-09-04", "Push A").await.unwrap();
        let bench = c
            .add_workout_exercise(&source.id, "ex-bench-press")
            .await
            .unwrap();
        c.log_new_set(
            &bench.id,
            &SetValues {
                weight_kg: Some(80.0),
                reps: Some(8),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        c.add_workout_exercise(&source.id, "ex-running")
            .await
            .unwrap();

        let duplicated = c.duplicate_workout(&source.id, "2026-09-20").await.unwrap();
        assert_ne!(duplicated.id, source.id);
        assert_eq!(duplicated.date, "2026-09-20");
        assert_eq!(duplicated.title, "Push A");
        assert_eq!(duplicated.status, "in-progress");

        let workout_exercises = c
            .list_workout_exercises_by_workout(&duplicated.id)
            .await
            .unwrap();
        assert_eq!(workout_exercises.len(), 2);
        for we in &workout_exercises {
            assert_eq!(we.today_note, None);
            assert_eq!(we.offline_since, None);
            let sets = c.list_sets(&we.id).await.unwrap();
            for set in sets {
                assert_eq!(set.status, "planned");
                assert_eq!(set.completed_at, None);
                assert!(!set.pending_sync);
            }
        }

        // The source workout is untouched.
        let source_sets = c.list_sets(&bench.id).await.unwrap();
        assert_eq!(source_sets[0].status, "completed");
    }

    #[tokio::test]
    async fn duplicate_workout_rebuilds_supersets_under_new_ids() {
        let c = test_coordinator().await;
        let source = c.create_workout("2026-09-09", "Superset A").await.unwrap();
        let lateral_raise = c
            .add_workout_exercise(&source.id, "ex-lateral-raise")
            .await
            .unwrap();
        let triceps_pushdown = c
            .add_workout_exercise(&source.id, "ex-triceps-pushdown")
            .await
            .unwrap();
        {
            let mut conn = c.pool.acquire().await.unwrap();
            sqlx::query(
                "INSERT INTO supersets (id, workout_id, created_at_ms, updated_at_ms, revision) \
                 VALUES ('ss-1', ?, 0, 0, 1)",
            )
            .bind(&source.id)
            .execute(&mut *conn)
            .await
            .unwrap();
            for (id, position) in [(&lateral_raise.id, 1), (&triceps_pushdown.id, 2)] {
                sqlx::query(
                    "UPDATE workout_exercises SET superset_id = 'ss-1', superset_position = ? \
                     WHERE id = ?",
                )
                .bind(position)
                .bind(id)
                .execute(&mut *conn)
                .await
                .unwrap();
            }
        }

        let duplicated = c.duplicate_workout(&source.id, "2026-09-20").await.unwrap();
        let workout_exercises = c
            .list_workout_exercises_by_workout(&duplicated.id)
            .await
            .unwrap();
        assert_eq!(workout_exercises.len(), 2);
        let group_ids: Vec<&str> = workout_exercises
            .iter()
            .map(|we| {
                we.superset_group_id
                    .as_deref()
                    .expect("copied superset membership")
            })
            .collect();
        assert_eq!(group_ids[0], group_ids[1]);
        assert_ne!(
            group_ids[0], "ss-1",
            "must not point at the source workout's superset"
        );
    }

    #[tokio::test]
    async fn delete_all_history_also_resets_the_rest_timer() {
        let c = test_coordinator().await;
        c.start_rest_timer(60_000, &StartRestTimerOptions::default())
            .await
            .unwrap();
        c.delete_all_history().await.unwrap();
        let state = c.get_rest_timer_state().await.unwrap();
        assert_eq!(state, RestTimerState::inactive());
        let summary = c.get_history_summary().await.unwrap();
        assert_eq!(summary.workout_count, 0);
    }

    #[tokio::test]
    async fn calculate_plates_delegates_to_the_pure_calculator() {
        let c = test_coordinator().await;
        let configs = c.list_barbell_configs().await.unwrap();
        let olympic = configs.into_iter().find(|b| b.name == "Olympic").unwrap();
        let result = c.calculate_plates(100.0, &olympic);
        assert!(result.loadable);
        assert_eq!(result.achieved_total, 100.0);
    }
}
