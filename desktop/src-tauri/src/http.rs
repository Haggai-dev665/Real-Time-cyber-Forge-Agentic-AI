//! Shared HTTP plumbing for every backend/ML call.
//!
//! One place to build the `reqwest::Client` (consistent timeout + desktop
//! User-Agent) and one place to format errors. `reqwest::Error`'s `Display` is
//! famously opaque — it prints `error sending request for url (...)` and hides
//! the real reason (DNS failure, connection refused, TLS handshake, timeout) in
//! its `source()` chain. `error_chain` walks that chain so the UI shows the
//! actual cause instead of the generic wrapper.

use serde_json::Value;
use std::error::Error;
use std::time::Duration;

/// Default request timeout for normal backend calls.
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(20);

/// Build an HTTP client with the given timeout and the desktop User-Agent the
/// backend recognizes. Falls back to a bare client if the builder ever fails.
pub fn client_with_timeout(timeout: Duration) -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(timeout)
        .user_agent("cyber-forge-desktop/1.0")
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

/// Standard client (20s timeout) for backend auth/agent calls.
pub fn client() -> reqwest::Client {
    client_with_timeout(DEFAULT_TIMEOUT)
}

/// Read a response body as JSON, with a clear, actionable message when the
/// server returns non-JSON — an HTML error page, a rate-limit notice, or an
/// empty body — instead of reqwest's opaque "error decoding response body:
/// expected value at line 1 column 1". Used by every command that expects JSON.
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

/// Human-readable explanation for a non-JSON / error response.
fn friendly_status(status: reqwest::StatusCode, empty: bool) -> String {
    match status.as_u16() {
        429 => "Too many requests — the server is rate-limiting this device. Please wait a minute and try again.".into(),
        502 | 503 | 504 => format!("The server is temporarily unavailable (HTTP {}). Please try again shortly.", status.as_u16()),
        500 => "The server encountered an internal error (HTTP 500).".into(),
        401 | 403 => "Your session has expired or the credentials are invalid.".into(),
        code if empty => format!("The server returned an empty response (HTTP {}).", code),
        code => format!("The server returned an unexpected (non-JSON) response (HTTP {}).", code),
    }
}

/// Flatten a `reqwest::Error` (and its `source()` chain) into a single readable
/// string, e.g. `error sending request for url (...): dns error: failed to
/// lookup address`. Use everywhere instead of `e.to_string()`.
pub fn error_chain(err: reqwest::Error) -> String {
    let mut parts = vec![err.to_string()];
    let mut source = err.source();
    while let Some(cause) = source {
        let msg = cause.to_string();
        // Avoid repeating the same text the wrapper already printed.
        if !parts.iter().any(|p| p == &msg) {
            parts.push(msg);
        }
        source = cause.source();
    }
    parts.join(": ")
}
