// Single error type shared by every domain module — thiserror for the Rust-side ergonomics, plus
// a hand-written Serialize so it crosses the Tauri IPC boundary as a typed {kind, message} object
// instead of the app crate's old stringified-error habit (see the backend design plan's survey of
// Threshold, which mixes both approaches inconsistently — this crate uses this one everywhere).
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{entity} not found: {id}")]
    NotFound { entity: &'static str, id: String },
    #[error("validation failed: {0}")]
    Validation(String),
    #[error("database error: {0}")]
    Db(#[from] sqlx::Error),
}

impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        let kind = match self {
            Error::NotFound { .. } => "notFound",
            Error::Validation(_) => "validation",
            Error::Db(_) => "db",
        };
        let mut state = serializer.serialize_struct("Error", 2)?;
        state.serialize_field("kind", kind)?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

pub type Result<T> = std::result::Result<T, Error>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_as_a_tagged_kind_and_message() {
        let err = Error::NotFound {
            entity: "exercise",
            id: "ex-1".to_string(),
        };
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["kind"], "notFound");
        assert_eq!(json["message"], "exercise not found: ex-1");
    }

    #[test]
    fn validation_errors_serialize_with_their_own_kind() {
        let err = Error::Validation("weight must be positive".to_string());
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["kind"], "validation");
        assert_eq!(
            json["message"],
            "validation failed: weight must be positive"
        );
    }
}
