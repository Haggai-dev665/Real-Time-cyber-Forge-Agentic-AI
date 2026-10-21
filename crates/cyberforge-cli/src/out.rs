//! What a command produces, and how it is printed.
//!
//! With `--json`: one line on stdout,
//! `{"schema":"cyberforge.cli.v1","command","ok","data","error","warnings","correlation_id"}`.
//! Without: the text on stdout, warnings and the error on stderr.

use cyberforge_core::text::printable;
use serde_json::{json, Value};

pub const SCHEMA: &str = "cyberforge.cli.v1";

/// Exit codes (plan-update-v2.md §6.2). 5 approval required and 6 partial or
/// timeout are reserved for commands that can produce them.
pub mod exit {
    pub const OK: u8 = 0;
    pub const FAILURE: u8 = 1;
    pub const USAGE: u8 = 2;
    pub const AUTH: u8 = 3;
    pub const UNAVAILABLE: u8 = 4;
    pub const CONFLICT: u8 = 7;
    pub const INTERRUPTED: u8 = 130;
}

pub struct Outcome {
    pub command: &'static str,
    pub code: u8,
    pub data: Value,
    pub error: Option<Value>,
    pub warnings: Vec<String>,
    pub text: String,
}

impl Outcome {
    pub fn done(command: &'static str, data: Value, text: String) -> Outcome {
        Outcome { command, code: exit::OK, data, error: None, warnings: vec![], text }
    }

    pub fn failed(command: &'static str, code: u8, error_code: &str, message: impl AsRef<str>) -> Outcome {
        let message = printable(message.as_ref(), 500);
        Outcome {
            command,
            code,
            data: Value::Null,
            error: Some(json!({ "code": error_code, "message": message })),
            warnings: vec![],
            text: String::new(),
        }
    }
}

/// The outcome of a shared operation's failure, with the exit code its kind means.
pub fn from_op(command: &'static str, error: cyberforge_core::ops::OpError) -> Outcome {
    use cyberforge_core::ops::OpErrorKind;
    let code = match error.kind {
        OpErrorKind::Usage => exit::USAGE,
        OpErrorKind::Auth => exit::AUTH,
        OpErrorKind::Unavailable => exit::UNAVAILABLE,
        OpErrorKind::Failure => exit::FAILURE,
    };
    Outcome::failed(command, code, &error.code, error.message)
}

fn correlation_id() -> String {
    let mut bytes = [0u8; 8];
    if getrandom::fill(&mut bytes).is_err() {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0);
        bytes = (nanos ^ std::process::id() as u64).to_le_bytes();
    }
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

pub fn emit(outcome: &Outcome, as_json: bool) {
    if as_json {
        let envelope = json!({
            "schema": SCHEMA,
            "command": outcome.command,
            "ok": outcome.code == exit::OK,
            "data": outcome.data,
            "error": outcome.error,
            "warnings": outcome.warnings,
            "correlation_id": correlation_id(),
        });
        println!("{}", envelope);
        return;
    }
    if !outcome.text.is_empty() {
        println!("{}", outcome.text);
    }
    for warning in &outcome.warnings {
        eprintln!("warning: {}", warning);
    }
    if let Some(error) = &outcome.error {
        eprintln!("error: {}", error["message"].as_str().unwrap_or("failed"));
    }
}
