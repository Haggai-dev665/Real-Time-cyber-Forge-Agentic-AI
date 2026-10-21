//! Shared HTTP plumbing for every backend/ML call.
//!
//! The implementation is in the shared core (`cyberforge_core::http`), which
//! the CLI uses too. This module keeps the desktop's User-Agent, which the
//! backend recognises, and the signatures every caller here already uses.

use std::time::Duration;

pub use cyberforge_core::http::{error_chain, read_json};

/// The User-Agent the backend recognises as the desktop app.
pub const USER_AGENT: &str = "cyber-forge-desktop/1.0";

/// Default request timeout for normal backend calls.
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(20);

/// Build an HTTP client with the given timeout and the desktop User-Agent.
pub fn client_with_timeout(timeout: Duration) -> reqwest::Client {
    cyberforge_core::http::client(USER_AGENT, timeout)
}

/// Standard client (20s timeout) for backend auth/agent calls.
pub fn client() -> reqwest::Client {
    client_with_timeout(DEFAULT_TIMEOUT)
}
