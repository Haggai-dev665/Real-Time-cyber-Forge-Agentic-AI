//! Keep the desktop signed in: renew the session before it expires.
//!
//! The server's session tokens last 24 hours, and `/api/auth/refresh` gives a
//! new one for a token issued in the last seven days, expired or not. Without
//! renewal an app left open was signed out every day, and a token restored at
//! start after a day away made every call fail as if the server were down.
//!
//! Shortly after start, and every ten minutes after, a token that expires
//! within six hours (or has expired) is renewed. The new token replaces the old
//! one in memory and in the system credential store. A refusal of a token that
//! has already expired ends the session here too: it cannot be used again. A
//! network failure changes nothing; the next check tries again.

use base64::Engine;
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

use crate::state::AppState;

type SharedState = Arc<Mutex<AppState>>;

const FIRST_CHECK: Duration = Duration::from_secs(5);
const CHECK_EVERY: Duration = Duration::from_secs(10 * 60);
/// Renew when the token has less than this left.
const RENEW_BEFORE_SECS: u64 = 6 * 60 * 60;

/// The token's issue and expiry times (seconds since the epoch), read from its
/// payload. Not a verification: the server verifies; this only decides when to ask.
pub fn claims(token: &str) -> Option<(u64, u64)> {
    let payload = token.split('.').nth(1)?;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(payload.trim_end_matches('=')).ok()?;
    let value: Value = serde_json::from_slice(&bytes).ok()?;
    Some((value.get("iat")?.as_u64()?, value.get("exp")?.as_u64()?))
}

/// Whether a token should be renewed now.
pub fn due(token: &str, now: u64) -> bool {
    match claims(token) {
        Some((_, exp)) => exp <= now + RENEW_BEFORE_SECS,
        None => false,
    }
}

#[derive(Debug, PartialEq)]
pub enum Renewal {
    Renewed(String),
    /// The server would not renew it (too old, revoked, or the account closed).
    Refused(u16),
    /// No answer, or an answer without a usable token. Try again later.
    Unavailable(String),
}

/// Ask the server for a new token.
pub async fn renew_with(client: &reqwest::Client, base: &str, token: &str) -> Renewal {
    let response = match client.post(format!("{base}/api/auth/refresh")).bearer_auth(token).send().await {
        Ok(response) => response,
        Err(e) => return Renewal::Unavailable(crate::http::error_chain(e)),
    };
    let status = response.status().as_u16();
    if status == 401 || status == 403 {
        return Renewal::Refused(status);
    }
    let body: Value = response.json().await.unwrap_or(Value::Null);
    match body.pointer("/data/token").and_then(Value::as_str) {
        Some(new) if status == 200 && claims(new).is_some() => Renewal::Renewed(new.to_string()),
        _ => Renewal::Unavailable(format!("the server answered HTTP {status} without a new session")),
    }
}

fn now_secs() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

async fn check(state: &SharedState, client: &reqwest::Client) {
    let (base, token) = {
        let s = state.lock().await;
        match (s.is_authenticated, s.auth_token.clone()) {
            (true, Some(token)) => (s.backend_url.clone(), token),
            _ => return,
        }
    };
    if !due(&token, now_secs()) {
        return;
    }
    match renew_with(client, &base, &token).await {
        Renewal::Renewed(new) => {
            let mut s = state.lock().await;
            // Signed out, or signed in again, while the request was out: leave it.
            if s.is_authenticated && s.auth_token.as_deref() == Some(token.as_str()) {
                s.auth_token = Some(new.clone());
                drop(s);
                let _ = crate::auth::store_token(&new);
            }
        }
        Renewal::Refused(_) => {
            let expired = claims(&token).map(|(_, exp)| exp <= now_secs()).unwrap_or(true);
            let mut s = state.lock().await;
            if expired && s.auth_token.as_deref() == Some(token.as_str()) {
                s.clear_auth();
                drop(s);
                let _ = crate::auth::delete_token();
            }
        }
        Renewal::Unavailable(_) => {}
    }
}

/// Start the renewal checks for as long as the app runs.
pub fn start(state: SharedState) {
    tauri::async_runtime::spawn(async move {
        let client = crate::http::client();
        tokio::time::sleep(FIRST_CHECK).await;
        loop {
            check(&state, &client).await;
            tokio::time::sleep(CHECK_EVERY).await;
        }
    });
}

#[cfg(test)]
mod renewal_tests {
    use super::*;
    use std::io::{Read, Write};

    fn token(iat: u64, exp: u64) -> String {
        let engine = base64::engine::general_purpose::URL_SAFE_NO_PAD;
        format!("{}.{}.sig", engine.encode(r#"{"alg":"HS256"}"#), engine.encode(format!(r#"{{"userId":"u","iat":{iat},"exp":{exp}}}"#)))
    }

    #[test]
    fn claims_are_read_and_renewal_is_due_within_six_hours_of_expiry() {
        let now = 1_000_000;
        assert_eq!(claims(&token(now - 10, now + 100)), Some((now - 10, now + 100)));
        assert!(due(&token(now, now + 60), now), "about to expire");
        assert!(due(&token(now - 90_000, now - 3_600), now), "already expired");
        assert!(!due(&token(now, now + 24 * 3_600), now), "fresh");
        assert!(!due("not-a-token", now), "unreadable tokens are left alone");
        assert_eq!(claims("a.b"), None);
    }

    /// One-request server answering `status` and `body`, recording the Authorization header.
    fn serve(status: &'static str, body: String) -> (String, std::sync::mpsc::Receiver<String>) {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            if let Ok((mut stream, _)) = listener.accept() {
                let mut buffer = [0u8; 4096];
                let n = stream.read(&mut buffer).unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..n]).to_string();
                let auth = request.lines().find(|l| l.to_ascii_lowercase().starts_with("authorization:")).unwrap_or("").to_string();
                let _ = tx.send(format!("{} {}", request.lines().next().unwrap_or(""), auth));
                let _ = write!(stream, "HTTP/1.1 {status}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}", body.len());
            }
        });
        (base, rx)
    }

    #[tokio::test]
    async fn a_renewal_sends_the_old_token_and_returns_the_new_one() {
        let fresh = token(2_000_000, 2_086_400);
        let (base, seen) = serve("200 OK", format!(r#"{{"success":true,"data":{{"token":"{fresh}"}}}}"#));
        let result = renew_with(&reqwest::Client::new(), &base, "old.token.value").await;
        assert_eq!(result, Renewal::Renewed(fresh));
        let request = seen.recv().unwrap();
        assert!(request.starts_with("POST /api/auth/refresh "), "{request}");
        assert!(request.to_ascii_lowercase().contains("bearer old.token.value"), "{request}");
    }

    #[tokio::test]
    async fn a_refusal_and_an_unusable_answer_are_told_apart() {
        let (base, _) = serve("401 Unauthorized", r#"{"success":false}"#.into());
        assert_eq!(renew_with(&reqwest::Client::new(), &base, "t").await, Renewal::Refused(401));
        let (base, _) = serve("200 OK", r#"{"success":true,"data":{"token":"not-a-jwt"}}"#.into());
        assert!(matches!(renew_with(&reqwest::Client::new(), &base, "t").await, Renewal::Unavailable(_)));
        let (base, _) = serve("503 Service Unavailable", "{}".into());
        assert!(matches!(renew_with(&reqwest::Client::new(), &base, "t").await, Renewal::Unavailable(_)));
    }
}
