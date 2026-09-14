// Row mapping and persistence for set templates (planned sets within a routine exercise).
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use sqlx::{FromRow, SqliteConnection};

use super::models::{SetTemplate, SetTemplateValues, SEED_LAST_PERFORMANCE};
use crate::domain::error::{Error, Result};
use crate::domain::units::{g_to_kg, kg_to_g, km_to_m, m_to_km};

#[derive(FromRow)]
struct SetTemplateRow {
    id: String,
    routine_exercise_id: String,
    sort_order: i32,
    weight_g: Option<i64>,
    reps: Option<i32>,
    distance_m: Option<i64>,
    duration_s: Option<i32>,
    population_rule: Option<String>,
    set_label: Option<String>,
}

impl From<SetTemplateRow> for SetTemplate {
    fn from(row: SetTemplateRow) -> Self {
        SetTemplate {
            id: row.id,
            routine_exercise_id: row.routine_exercise_id,
            order: row.sort_order,
            weight_kg: row.weight_g.map(g_to_kg),
            reps: row.reps,
            distance_km: row.distance_m.map(m_to_km),
            duration_sec: row.duration_s,
            population_rule: row.population_rule,
            set_label: row.set_label,
        }
    }
}

const SELECT_BY_ID: &str = "SELECT id, routine_exercise_id, sort_order, weight_g, reps, \
     distance_m, duration_s, population_rule, set_label FROM set_templates WHERE id = ?";

const SELECT_BY_ROUTINE_EXERCISE: &str = "SELECT id, routine_exercise_id, sort_order, weight_g, \
     reps, distance_m, duration_s, population_rule, set_label FROM set_templates \
     WHERE routine_exercise_id = ? ORDER BY sort_order";

/// The only rule this crate accepts today — kept as a function rather than inlined into `add` so
/// the check has one call site as more rules are added later.
fn validate_population_rule(rule: &str) -> Result<()> {
    if rule == SEED_LAST_PERFORMANCE {
        Ok(())
    } else {
        Err(Error::Validation(format!(
            "unknown set-template population rule {rule:?}"
        )))
    }
}

pub async fn get(conn: &mut SqliteConnection, id: &str) -> Result<SetTemplate> {
    let row: SetTemplateRow = sqlx::query_as(SELECT_BY_ID)
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| Error::NotFound {
            entity: "set template",
            id: id.to_string(),
        })?;
    Ok(row.into())
}

pub async fn list_by_routine_exercise(
    conn: &mut SqliteConnection,
    routine_exercise_id: &str,
) -> Result<Vec<SetTemplate>> {
    let rows: Vec<SetTemplateRow> = sqlx::query_as(SELECT_BY_ROUTINE_EXERCISE)
        .bind(routine_exercise_id)
        .fetch_all(conn)
        .await?;
    Ok(rows.into_iter().map(SetTemplate::from).collect())
}

/// Appends at the end of the routine exercise's existing templates — `MAX(sort_order)+1`, matching
/// `sets::repo::add`'s reasoning. Rejects an unrecognized `population_rule` up front rather than
/// persisting a value materialization could never act on.
pub async fn add(
    conn: &mut SqliteConnection,
    routine_exercise_id: &str,
    values: &SetTemplateValues,
) -> Result<SetTemplate> {
    if let Some(rule) = &values.population_rule {
        validate_population_rule(rule)?;
    }
    let siblings = list_by_routine_exercise(conn, routine_exercise_id).await?;
    let next_order = siblings.iter().map(|t| t.order).max().unwrap_or(0) + 1;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let revision = crate::db::next_revision(conn).await?;
    sqlx::query(
        "INSERT INTO set_templates (id, routine_exercise_id, sort_order, weight_g, reps, \
         distance_m, duration_s, population_rule, set_label, created_at_ms, updated_at_ms, \
         revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(routine_exercise_id)
    .bind(next_order)
    .bind(values.weight_kg.map(kg_to_g))
    .bind(values.reps)
    .bind(values.distance_km.map(km_to_m))
    .bind(values.duration_sec)
    .bind(&values.population_rule)
    .bind(&values.set_label)
    .bind(now)
    .bind(now)
    .bind(revision)
    .execute(&mut *conn)
    .await?;
    get(conn, &id).await
}

/// A no-op if the template doesn't exist, otherwise records a tombstone.
pub async fn delete(conn: &mut SqliteConnection, id: &str) -> Result<()> {
    let result = sqlx::query("DELETE FROM set_templates WHERE id = ?")
        .bind(id)
        .execute(&mut *conn)
        .await?;
    if result.rows_affected() > 0 {
        let revision = crate::db::next_revision(conn).await?;
        let now = chrono::Utc::now().timestamp_millis();
        crate::db::write_tombstone(conn, "set_template", id, revision, now).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_test_pool;

    async fn a_routine_exercise(conn: &mut SqliteConnection) -> String {
        let routine = super::super::repo::create(conn, "Push day").await.unwrap();
        let section = super::super::sections::add(conn, &routine.id, Some("A"))
            .await
            .unwrap();
        super::super::routine_exercises::add(conn, &section.id, "ex-bench-press")
            .await
            .unwrap()
            .id
    }

    #[tokio::test]
    async fn adds_an_explicit_value_template() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let routine_exercise_id = a_routine_exercise(&mut conn).await;
        let created = add(
            &mut conn,
            &routine_exercise_id,
            &SetTemplateValues {
                weight_kg: Some(80.0),
                reps: Some(8),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(created.order, 1);
        assert_eq!(created.weight_kg, Some(80.0));
        assert_eq!(created.reps, Some(8));
        assert_eq!(created.population_rule, None);
    }

    #[tokio::test]
    async fn adds_a_seeded_from_last_performance_template() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let routine_exercise_id = a_routine_exercise(&mut conn).await;
        let created = add(
            &mut conn,
            &routine_exercise_id,
            &SetTemplateValues {
                population_rule: Some(SEED_LAST_PERFORMANCE.to_string()),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(
            created.population_rule.as_deref(),
            Some(SEED_LAST_PERFORMANCE)
        );
        assert_eq!(created.weight_kg, None);
    }

    #[tokio::test]
    async fn rejects_an_unknown_population_rule() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let routine_exercise_id = a_routine_exercise(&mut conn).await;
        let err = add(
            &mut conn,
            &routine_exercise_id,
            &SetTemplateValues {
                population_rule: Some("made-up-rule".to_string()),
                ..Default::default()
            },
        )
        .await
        .unwrap_err();
        assert!(matches!(err, Error::Validation(_)));
    }

    #[tokio::test]
    async fn deletes_a_set_template_and_records_a_tombstone() {
        let pool = init_test_pool().await;
        let mut conn = pool.acquire().await.unwrap();
        let routine_exercise_id = a_routine_exercise(&mut conn).await;
        let created = add(
            &mut conn,
            &routine_exercise_id,
            &SetTemplateValues::default(),
        )
        .await
        .unwrap();
        delete(&mut conn, &created.id).await.unwrap();
        let err = get(&mut conn, &created.id).await.unwrap_err();
        assert!(matches!(err, Error::NotFound { .. }));
    }
}
