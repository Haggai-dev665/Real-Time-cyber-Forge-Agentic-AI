//! Shared HTTP plumbing for every backend/ML call.
//!
//! One place to build the `reqwest::Client` (consistent timeout + desktop
//! User-Agent) and one place to format errors. `reqwest::Error`'s `Display` is
//! famously opaque — it prints `error sending request for url (...)` and hides
//! the real reason (DNS failure, connection refused, TLS handshake, timeout) in
//! its `source()` chain. `error_chain` walks that chain so the UI shows the
//! actual cause instead of the generic wrapper.

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
