// The plate-loading calculator — a direct port of the mock's calculatePlatesPure, but operating
// on exact integer milli-units (matching barbell_configs' storage) instead of floats, so no
// epsilon comparisons are needed for combo equality.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::cmp::Ordering;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export, export_to = "../../src/domain/generated/"))]
#[serde(rename_all = "camelCase")]
pub struct PlateCalculationResult {
    pub loadable: bool,
    pub target_weight: f64,
    pub per_side_plates: Vec<f64>,
    pub per_side_total: f64,
    pub achieved_total: f64,
    #[cfg_attr(test, ts(optional))]
    pub nearest_lower: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub nearest_higher: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub shortfall: Option<f64>,
    #[cfg_attr(test, ts(optional))]
    pub smallest_plate: Option<f64>,
}

struct Combo {
    total: i64,
    plates: Vec<i64>,
}

/// Sorted by total descending; ties broken by fewer plates, then by preferring larger plates
/// first — e.g. 25+5+1.25 sorts ahead of 20+10+1.25 for the same total, matching how a lifter
/// would actually prefer to load a bar.
fn compare_combos(a: &Combo, b: &Combo) -> Ordering {
    if a.total != b.total {
        return b.total.cmp(&a.total);
    }
    if a.plates.len() != b.plates.len() {
        return a.plates.len().cmp(&b.plates.len());
    }
    let mut a_desc = a.plates.clone();
    a_desc.sort_unstable_by(|x, y| y.cmp(x));
    let mut b_desc = b.plates.clone();
    b_desc.sort_unstable_by(|x, y| y.cmp(x));
    for i in 0..a_desc.len() {
        if a_desc[i] != b_desc[i] {
            return b_desc[i].cmp(&a_desc[i]);
        }
    }
    Ordering::Equal
}

/// Every achievable per-side plate total from one instance of each plate, in milli-units.
fn achievable_totals(plates: &[i64]) -> Vec<Combo> {
    let mut results = vec![Combo {
        total: 0,
        plates: vec![],
    }];
    for &plate in plates {
        let additions: Vec<Combo> = results
            .iter()
            .map(|r| {
                let mut plates = r.plates.clone();
                plates.push(plate);
                Combo {
                    total: r.total + plate,
                    plates,
                }
            })
            .collect();
        results.extend(additions);
    }
    results.sort_by(compare_combos);
    results
}

/// `target_weight_milli`/`bar_weight_milli`/`plates_milli` are all in the barbell's own display
/// unit's milli-units (SPEC.md 10.4: plate arithmetic stays exact integer math). The returned
/// DTO converts back to plain display-unit floats at this one boundary.
pub fn calculate_plates(
    target_weight_milli: i64,
    bar_weight_milli: i64,
    plates_milli: &[i64],
) -> PlateCalculationResult {
    let per_side_target = (target_weight_milli - bar_weight_milli) / 2;
    let totals = achievable_totals(plates_milli);

    let exact = totals.iter().find(|t| t.total == per_side_target);
    let below: Vec<&Combo> = totals
        .iter()
        .filter(|t| t.total < per_side_target)
        .collect();
    let above: Vec<&Combo> = totals
        .iter()
        .filter(|t| t.total > per_side_target)
        .collect();
    let nearest_lower_combo = below.first().copied();
    let nearest_higher_combo = above.last().copied();

    let empty = Combo {
        total: 0,
        plates: vec![],
    };
    let shown = exact.or(nearest_lower_combo).unwrap_or(&empty);

    let to_display = |milli: i64| milli as f64 / 1000.0;
    let mut per_side_plates = shown.plates.clone();
    per_side_plates.sort_unstable_by(|a, b| b.cmp(a));

    PlateCalculationResult {
        loadable: exact.is_some(),
        target_weight: to_display(target_weight_milli),
        per_side_plates: per_side_plates.into_iter().map(to_display).collect(),
        per_side_total: to_display(shown.total),
        achieved_total: to_display(bar_weight_milli + 2 * shown.total),
        nearest_lower: nearest_lower_combo.map(|c| to_display(bar_weight_milli + 2 * c.total)),
        nearest_higher: nearest_higher_combo.map(|c| to_display(bar_weight_milli + 2 * c.total)),
        shortfall: if exact.is_some() {
            None
        } else {
            Some(to_display(
                per_side_target - nearest_lower_combo.map(|c| c.total).unwrap_or(0),
            ))
        },
        smallest_plate: if exact.is_some() {
            None
        } else {
            plates_milli.iter().min().map(|&m| to_display(m))
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const OLYMPIC_PLATES: [i64; 7] = [25_000, 20_000, 15_000, 10_000, 5_000, 2_500, 1_250];

    #[test]
    fn finds_an_exact_load() {
        // 100kg target, 20kg bar -> 40kg per side -> 25+15
        let result = calculate_plates(100_000, 20_000, &OLYMPIC_PLATES);
        assert!(result.loadable);
        assert_eq!(result.per_side_plates, vec![25.0, 15.0]);
        assert_eq!(result.achieved_total, 100.0);
        assert_eq!(result.shortfall, None);
    }

    #[test]
    fn prefers_larger_plates_on_a_tie() {
        // 20kg bar + 2*31.25kg per side = 82.5kg; both 25+5+1.25 and 20+10+1.25 sum to 31.25
        let result = calculate_plates(82_500, 20_000, &OLYMPIC_PLATES);
        assert!(result.loadable);
        assert_eq!(result.per_side_plates, vec![25.0, 5.0, 1.25]);
    }

    #[test]
    fn reports_neighbours_and_shortfall_when_not_exactly_loadable() {
        // 20kg bar, target 101kg -> 40.5kg per side; not achievable exactly with these plates.
        let result = calculate_plates(101_000, 20_000, &OLYMPIC_PLATES);
        assert!(!result.loadable);
        assert!(result.nearest_lower.unwrap() < 101.0);
        assert!(result.nearest_higher.unwrap() > 101.0);
        assert!(result.shortfall.unwrap() > 0.0);
        assert_eq!(result.smallest_plate, Some(1.25));
    }

    #[test]
    fn empty_bar_below_the_bar_weight_reports_the_bar_itself() {
        let result = calculate_plates(15_000, 20_000, &OLYMPIC_PLATES);
        assert_eq!(result.per_side_plates, Vec::<f64>::new());
        assert_eq!(result.achieved_total, 20.0);
    }
}
