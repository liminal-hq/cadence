// Canonical-unit boundary conversions — storage is always integer grams/metres/seconds so plate
// and volume arithmetic stays exact; the TS contract's f64 kg/km values, and its ISO-8601 instant
// strings, are converted only here (SPEC.md section 10.4: "canonical storage in one unit per
// dimension").
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use crate::domain::error::Error;

/// Formats a stored epoch-millisecond instant the same way `completeSet()`'s
/// `new Date().toISOString()` already does on the frontend — always UTC, always millisecond
/// precision, always `Z`-suffixed — so a Rust-produced instant is indistinguishable from one the
/// mock repository would have produced.
pub fn ms_to_iso(ms: i64) -> String {
    chrono::DateTime::<chrono::Utc>::from_timestamp_millis(ms)
        .expect("epoch milliseconds within chrono's representable range")
        .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub fn iso_to_ms(s: &str) -> Result<i64, Error> {
    chrono::DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.timestamp_millis())
        .map_err(|e| Error::Validation(format!("invalid ISO 8601 instant {s:?}: {e}")))
}

pub fn kg_to_g(kg: f64) -> i64 {
    (kg * 1000.0).round() as i64
}

pub fn g_to_kg(g: i64) -> f64 {
    g as f64 / 1000.0
}

pub fn km_to_m(km: f64) -> i64 {
    (km * 1000.0).round() as i64
}

pub fn m_to_km(m: i64) -> f64 {
    m as f64 / 1000.0
}

/// Scales an arbitrary display-unit value into its own milli-units — for values that aren't
/// canonically kg/km, like barbell/plate weights, which are always expressed in the config's own
/// display unit (kg or lb) rather than canonical kg (SPEC.md 10.4).
pub fn unit_to_milli(value: f64) -> i64 {
    (value * 1000.0).round() as i64
}

pub fn milli_to_unit(milli: i64) -> f64 {
    milli as f64 / 1000.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_common_weight_values() {
        assert_eq!(kg_to_g(80.0), 80_000);
        assert_eq!(kg_to_g(82.5), 82_500);
        assert_eq!(g_to_kg(82_500), 82.5);
    }

    #[test]
    fn round_trips_common_distance_values() {
        assert_eq!(km_to_m(5.2), 5_200);
        assert_eq!(m_to_km(5_200), 5.2);
    }

    #[test]
    fn round_trips_arbitrary_unit_milli_values() {
        assert_eq!(unit_to_milli(1.25), 1_250);
        assert_eq!(milli_to_unit(1_250), 1.25);
    }

    #[test]
    fn formats_an_instant_the_same_way_the_frontend_does() {
        assert_eq!(ms_to_iso(1_788_912_000_000), "2026-09-09T00:00:00.000Z");
    }

    #[test]
    fn round_trips_an_iso_instant_through_ms() {
        let ms = iso_to_ms("2026-09-09T09:40:00.000Z").unwrap();
        assert_eq!(ms_to_iso(ms), "2026-09-09T09:40:00.000Z");
    }

    #[test]
    fn rejects_a_malformed_instant() {
        assert!(iso_to_ms("not-a-date").is_err());
    }
}
