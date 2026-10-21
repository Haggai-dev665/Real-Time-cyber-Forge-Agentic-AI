//! Operations on the profile's server, done once for every surface: the CLI
//! and the MCP server call these, so a result means the same thing in both
//! (plan-update-v2.md §4.1: no second implementation per interface).
//!
//! Each takes the profile, its credential store and a client, and returns the
//! server's checked data or an `OpError` saying which kind of failure it was.
//! Text that came from the network is made printable here.

use crate::credentials::SecretStore;
use crate::grants::{self, Grant, GrantError, GrantStore};
use crate::http::error_chain;
use crate::profile::Profile;
use crate::redact::redact_url;
use crate::session;
use crate::text::printable;
use serde_json::{json, Value};

const MAX_URL: usize = 2048;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OpErrorKind {
    /// The input was wrong.
    Usage,
    /// Not signed in, or the server refused the session.
    Auth,
    /// No answer, rate-limited, or the service cannot say.
    Unavailable,
    /// Anything else.
    Failure,
}

#[derive(Debug, PartialEq)]
pub struct OpError {
    pub kind: OpErrorKind,
    pub code: String,
    pub message: String,
}

impl OpError {
    fn new(kind: OpErrorKind, code: &str, message: impl AsRef<str>) -> OpError {
        OpError { kind, code: code.to_string(), message: printable(message.as_ref(), 500) }
    }
}

fn session_token(store: &(dyn SecretStore + Sync), profile: &Profile) -> Result<String, OpError> {
    match session::token(store, profile) {
        Ok(Some(token)) => Ok(token),
        Ok(None) => Err(OpError::new(OpErrorKind::Auth, "SIGNED_OUT", format!("Profile {} is not signed in; run: cyberforge auth login", profile.name))),
        Err(error) => Err(OpError::new(OpErrorKind::Failure, "STORE_UNAVAILABLE", format!("The system credential store could not be read: {}", error))),
    }
}

/// The server's answer, or the failure it means. `what` names the operation for messages.
async fn answer(response: Result<reqwest::Response, reqwest::Error>, profile: &Profile, what: &str) -> Result<Value, OpError> {
    let response = response.map_err(|e| OpError::new(OpErrorKind::Unavailable, "UNAVAILABLE", format!("The server at {} did not answer: {}", profile.origin, printable(&error_chain(e), 300))))?;
    let status = response.status().as_u16();
    let body: Value = response.json().await.unwrap_or(Value::Null);
    let code = |fallback: &str| body.get("code").and_then(Value::as_str).map(|c| printable(c, 40)).unwrap_or_else(|| fallback.to_string());
    let message = |fallback: &str| printable(body.get("message").and_then(Value::as_str).unwrap_or(fallback), 300);
    match status {
        200 => Ok(body.get("data").cloned().unwrap_or(Value::Null)),
        400 => Err(OpError::new(OpErrorKind::Usage, &code("INVALID"), message("The server refused the input."))),
        401 | 403 => Err(OpError::new(OpErrorKind::Auth, "AUTH_REJECTED", "The server refused the session; sign in again.")),
        404 => Err(OpError::new(OpErrorKind::Unavailable, "NOT_SUPPORTED", format!("This server does not offer {} yet.", what))),
        429 => Err(OpError::new(OpErrorKind::Unavailable, "RATE_LIMITED", message("Too many requests; wait a minute."))),
        503 => Err(OpError::new(OpErrorKind::Unavailable, &code("ML_UNAVAILABLE"), message("The Analysis Agents are not available."))),
        other => Err(OpError::new(OpErrorKind::Failure, "UNEXPECTED", format!("The server answered HTTP {}: {}", other, message("no reason given")))),
    }
}

/// What the Analysis Agents can do now (`GET /api/v1/ml/capabilities`).
pub async fn model_status(profile: &Profile, store: &(dyn SecretStore + Sync), client: &reqwest::Client) -> Result<Value, OpError> {
    let token = session_token(store, profile)?;
    let response = client.get(profile.origin.join("/api/v1/ml/capabilities")).bearer_auth(&token).send().await;
    answer(response, profile, "Analysis Agents capabilities").await
}

/// The address to send: http(s), at most 2,048 characters, no spaces or
/// control characters, credentials removed. The flag says whether any were.
pub fn analysis_target(input: &str) -> Result<(String, bool), String> {
    let raw = input.trim();
    let lower = raw.to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://")) || raw.len() > MAX_URL || raw.len() < 10 || raw.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err(format!("Give a full http:// or https:// address of at most {} characters, without spaces.", MAX_URL));
    }
    let redacted = redact_url(raw);
    let changed = redacted != raw;
    Ok((redacted, changed))
}

/// One address analysed by the Analysis Agents through the server
/// (`POST /api/v1/ml/analyze-url`): the versioned record, and whether
/// credentials were removed from the address before it left this computer.
pub async fn analyze_url(profile: &Profile, store: &(dyn SecretStore + Sync), client: &reqwest::Client, input: &str) -> Result<(Value, bool), OpError> {
    let (address, redacted) = analysis_target(input).map_err(|m| OpError::new(OpErrorKind::Usage, "URL_INVALID", m))?;
    let token = session_token(store, profile)?;
    let response = client.post(profile.origin.join("/api/v1/ml/analyze-url")).bearer_auth(&token).json(&json!({ "url": address })).send().await;
    let data = answer(response, profile, "versioned URL analysis").await?;
    Ok((data, redacted))
}

/// Approve an AI client for the account `profile` is signed in to now: the
/// read-only default operations plus `extra` (only operations the registry
/// offers over MCP). The server confirms the account first; a grant is never
/// made for a session it has not accepted.
pub async fn approve_mcp_client(dir: &std::path::Path, profile: &Profile, store: &(dyn SecretStore + Sync), client: &reqwest::Client, name: &str, extra: &[String], days: u64) -> Result<Grant, OpError> {
    let account = match crate::status::check(profile, store, client).await.session {
        crate::status::Session::Valid { user_id: Some(id), .. } => id,
        crate::status::Session::SignedOut => return Err(OpError::new(OpErrorKind::Auth, "SIGNED_OUT", format!("Profile {} is not signed in; run: cyberforge auth login", profile.name))),
        crate::status::Session::Rejected { .. } => return Err(OpError::new(OpErrorKind::Auth, "AUTH_REJECTED", "The server refused the profile's session; sign in again with cyberforge auth login.")),
        crate::status::Session::Unknown => return Err(OpError::new(OpErrorKind::Failure, "STORE_UNAVAILABLE", "The system credential store could not be read.")),
        _ => return Err(OpError::new(OpErrorKind::Unavailable, "UNVERIFIED", "The profile's session could not be checked with the server; try again when it answers.")),
    };
    let mut operations = grants::default_operations();
    operations.extend(extra.iter().cloned());
    GrantStore::in_dir(dir)
        .create(name, &profile.name, profile.origin.as_str(), &account, &operations, days, grants::now_secs())
        .map_err(|e| OpError::new(if matches!(e, GrantError::File(_)) { OpErrorKind::Failure } else { OpErrorKind::Usage }, e.code(), e.message()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::credentials::MemoryStore;
    use crate::origin::Origin;

    #[test]
    fn addresses_are_checked_and_redacted_before_they_leave() {
        assert_eq!(analysis_target(" https://example.com/login?next=/home&token=abc123 ").unwrap(), ("https://example.com/login?next=/home&token=[redacted]".to_string(), true));
        assert_eq!(analysis_target("https://example.com/").unwrap(), ("https://example.com/".to_string(), false));
        for bad in ["example.com", "ftp://example.com/", "javascript:alert(1)", "https://exa mple.com/", ""] {
            assert!(analysis_target(bad).is_err(), "{bad}");
        }
        assert!(analysis_target(&format!("https://example.com/{}", "a".repeat(2100))).is_err());
    }

    #[tokio::test]
    async fn without_a_session_nothing_is_sent() {
        // An origin nothing listens on: reaching the network would fail differently.
        let profile = Profile { name: "default".into(), origin: Origin::parse("http://127.0.0.1:9").unwrap() };
        let client = crate::http::client("cyberforge-test", std::time::Duration::from_secs(2));
        let store = MemoryStore::default();
        assert_eq!(model_status(&profile, &store, &client).await.unwrap_err().code, "SIGNED_OUT");
        assert_eq!(analyze_url(&profile, &store, &client, "https://example.com/").await.unwrap_err().code, "SIGNED_OUT");
        assert_eq!(analyze_url(&profile, &store, &client, "nope").await.unwrap_err().kind, OpErrorKind::Usage);
    }
}
