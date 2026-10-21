//! Shared HTTP plumbing for backend and ML calls.
//!
//! One place to build a `reqwest::Client` and one place to describe failures.
//! `reqwest::Error`'s `Display` prints `error sending request for url (...)`
//! and hides the real cause (DNS failure, refused connection, TLS, timeout) in
//! its `source()` chain; [`error_chain`] walks that chain.

use serde_json::Value;
use std::error::Error;
use std::time::Duration;

/// A client with this timeout and User-Agent. Falls back to a bare client if
/// the builder ever fails.
pub fn client(user_agent: &str, timeout: Duration) -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(timeout)
        .user_agent(user_agent)
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

/// Read a response body as JSON, with a clear message when the server returns
/// something else: an HTML error page, a rate-limit notice, or nothing.
pub async fn read_json(resp: reqwest::Response) -> Result<Value, String> {
    let status = resp.status();
    let text = resp.text().await.map_err(error_chain)?;
    let body = text.trim_start_matches('\u{feff}').trim();
    if body.starts_with('{') || body.starts_with('[') {
        if let Ok(v) = serde_json::from_str::<Value>(body) {
            return Ok(v);
        }
    }
    Err(friendly_status(status, body.is_empty()))
}

/// What a non-JSON or error response means, in words.
pub fn friendly_status(status: reqwest::StatusCode, empty: bool) -> String {
    match status.as_u16() {
        429 => "Too many requests — the server is rate-limiting this device. Please wait a minute and try again.".into(),
        502 | 503 | 504 => format!("The server is temporarily unavailable (HTTP {}). Please try again shortly.", status.as_u16()),
        500 => "The server encountered an internal error (HTTP 500).".into(),
        401 | 403 => "Your session has expired or the credentials are invalid.".into(),
        code if empty => format!("The server returned an empty response (HTTP {}).", code),
        code => format!("The server returned an unexpected (non-JSON) response (HTTP {}).", code),
    }
}

/// A `reqwest::Error` and its `source()` chain as one readable string.
pub fn error_chain(err: reqwest::Error) -> String {
    let mut parts = vec![err.to_string()];
    let mut source = err.source();
    while let Some(cause) = source {
        let msg = cause.to_string();
        if !parts.iter().any(|p| p == &msg) {
            parts.push(msg);
        }
        source = cause.source();
    }
    parts.join(": ")
}
