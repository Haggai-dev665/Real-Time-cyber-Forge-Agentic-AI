//! Signing a profile in and out.
//!
//! A session token is kept only in the credential store, under the profile's
//! own entry (`Profile::session_entry`, which names the profile and its
//! origin), and is read back before it is called kept. When the store does not
//! work nothing is written anywhere else. The token is never returned to a
//! caller for display.

use crate::credentials::SecretStore;
use crate::http::error_chain;
use crate::profile::Profile;
use crate::text::printable;
use serde::Serialize;
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Account {
    pub user_id: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, PartialEq)]
pub enum LoginError {
    /// The backend refused the email and password, or the account (HTTP 401).
    Rejected(String),
    /// The backend refused the input as malformed (HTTP 400).
    Invalid(String),
    /// Too many attempts (HTTP 429).
    RateLimited,
    /// No answer, or a server error.
    Unavailable(String),
    /// An answer this client does not understand.
    Unexpected(String),
}

/// A signed-in session: the account, and the token to keep. `Debug` never
/// prints the token.
pub struct Login {
    pub account: Account,
    token: String,
}

impl std::fmt::Debug for Login {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Login").field("account", &self.account).field("token", &"<hidden>").finish()
    }
}

fn message_of(body: &Value, fallback: &str) -> String {
    printable(body.get("message").and_then(Value::as_str).unwrap_or(fallback), 200)
}

pub fn account_of(user: &Value) -> Account {
    let text = |key: &str| user.get(key).and_then(|v| v.as_str().map(str::to_string).or_else(|| v.as_u64().map(|n| n.to_string())));
    Account {
        user_id: text("id").or_else(|| text("_id")).map(|s| printable(&s, 64)),
        email: text("email").map(|s| printable(&s, 254)),
    }
}

/// Sign in with an email and password at the profile's origin.
pub async fn login(profile: &Profile, client: &reqwest::Client, email: &str, password: &str) -> Result<Login, LoginError> {
    let response = client
        .post(profile.origin.join("/api/auth/login"))
        .json(&json!({ "email": email, "password": password }))
        .send()
        .await
        .map_err(|e| LoginError::Unavailable(printable(&error_chain(e), 300)))?;
    let status = response.status().as_u16();
    let body: Value = response.json().await.unwrap_or(Value::Null);
    match status {
        200 => {}
        400 => return Err(LoginError::Invalid(message_of(&body, "the backend refused the input"))),
        401 | 403 => return Err(LoginError::Rejected(message_of(&body, "invalid credentials"))),
        429 => return Err(LoginError::RateLimited),
        500..=599 => return Err(LoginError::Unavailable(format!("the backend answered HTTP {}", status))),
        other => return Err(LoginError::Unexpected(format!("the backend answered HTTP {}", other))),
    }
    let token = body.pointer("/data/token").and_then(Value::as_str).map(str::trim).unwrap_or("");
    if token.is_empty() || token.len() > 8192 || token.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err(LoginError::Unexpected("the backend's answer held no usable session".into()));
    }
    Ok(Login { account: account_of(body.pointer("/data/user").unwrap_or(&Value::Null)), token: token.to_string() })
}

/// Keep a session for the profile, and read it back. `Err` means it was not
/// kept; nothing was written anywhere else.
pub fn keep(store: &(dyn SecretStore + Sync), profile: &Profile, login: &Login) -> Result<(), String> {
    let entry = profile.session_entry();
    store.set(&entry, &login.token).map_err(|e| printable(&e, 300))?;
    match store.get(&entry) {
        Ok(Some(kept)) if kept == login.token => Ok(()),
        Ok(_) => {
            let _ = store.delete(&entry);
            Err("the system credential store accepted the session and did not keep it".into())
        }
        Err(e) => Err(printable(&e, 300)),
    }
}

/// The profile's kept session token, if any.
pub fn token(store: &(dyn SecretStore + Sync), profile: &Profile) -> Result<Option<String>, String> {
    store
        .get(&profile.session_entry())
        .map(|t| t.filter(|t| !t.trim().is_empty()))
        .map_err(|e| printable(&e, 300))
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Logout {
    /// A session was kept for this profile before.
    pub was_signed_in: bool,
    /// The backend acknowledged the sign-out (it ends the account's live
    /// streams). It cannot revoke the token: that stays valid until it expires.
    pub backend_acknowledged: bool,
    /// The session is gone from this computer's credential store.
    pub removed: bool,
}

/// Sign the profile out: tell the backend, then remove the kept session. The
/// local removal happens whether or not the backend answers.
pub async fn logout(store: &(dyn SecretStore + Sync), profile: &Profile, client: &reqwest::Client) -> Result<Logout, String> {
    let Some(token) = token(store, profile)? else {
        return Ok(Logout { was_signed_in: false, backend_acknowledged: false, removed: true });
    };
    let backend_acknowledged = matches!(
        client.post(profile.origin.join("/api/auth/logout")).bearer_auth(&token).send().await,
        Ok(response) if response.status().is_success()
    );
    store.delete(&profile.session_entry()).map_err(|e| printable(&e, 300))?;
    let removed = matches!(store.get(&profile.session_entry()), Ok(None));
    Ok(Logout { was_signed_in: true, backend_acknowledged, removed })
}

/// Remove a profile's kept session without contacting the backend, for when
/// the profile's origin changes and the old session must not follow it.
pub fn forget(store: &(dyn SecretStore + Sync), profile: &Profile) -> Result<bool, String> {
    let had = token(store, profile)?.is_some();
    store.delete(&profile.session_entry()).map_err(|e| printable(&e, 300))?;
    Ok(had)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::credentials::MemoryStore;
    use crate::origin::Origin;
    use std::time::Duration;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    /// Answers `/api/auth/login` by password: `right` → 200 with a token,
    /// `busy` → 429, `broken` → 200 without a token, else 401. Records whether
    /// `/api/auth/logout` was called with the token.
    async fn serve() -> (Origin, std::sync::Arc<std::sync::atomic::AtomicBool>) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let logged_out = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let flag = logged_out.clone();
        tokio::spawn(async move {
            loop {
                let Ok((mut socket, _)) = listener.accept().await else { return };
                let mut buffer = vec![0u8; 8192];
                let n = socket.read(&mut buffer).await.unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..n]).to_string();
                let (status, body) = if request.starts_with("POST /api/auth/login ") {
                    if request.contains(r#""password":"right""#) {
                        ("200 OK", r#"{"success":true,"data":{"user":{"id":"u1","email":"a@example.com"},"token":"tok.en.value"}}"#)
                    } else if request.contains(r#""password":"busy""#) {
                        ("429 Too Many Requests", r#"{"message":"slow down"}"#)
                    } else if request.contains(r#""password":"broken""#) {
                        ("200 OK", r#"{"success":true,"data":{}}"#)
                    } else {
                        ("401 Unauthorized", r#"{"success":false,"message":"Invalid credentials"}"#)
                    }
                } else if request.starts_with("POST /api/auth/logout ") && request.to_ascii_lowercase().contains("bearer tok.en.value") {
                    flag.store(true, std::sync::atomic::Ordering::SeqCst);
                    ("200 OK", r#"{"success":true}"#)
                } else {
                    ("404 Not Found", "{}")
                };
                let reply = format!("HTTP/1.1 {}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}", status, body.len(), body);
                let _ = socket.write_all(reply.as_bytes()).await;
            }
        });
        (Origin::parse(&format!("http://127.0.0.1:{}", port)).unwrap(), logged_out)
    }

    fn client() -> reqwest::Client {
        crate::http::client("cyberforge-test", Duration::from_secs(5))
    }

    struct ForgetfulStore;
    impl SecretStore for ForgetfulStore {
        fn set(&self, _: &str, _: &str) -> Result<(), String> { Ok(()) }
        fn get(&self, _: &str) -> Result<Option<String>, String> { Ok(None) }
        fn delete(&self, _: &str) -> Result<(), String> { Ok(()) }
    }

    #[tokio::test]
    async fn sign_in_keep_and_sign_out() {
        let (origin, logged_out) = serve().await;
        let profile = Profile { name: "default".into(), origin };
        let store = MemoryStore::default();
        let session = login(&profile, &client(), "a@example.com", "right").await.unwrap();
        assert_eq!(session.account, Account { user_id: Some("u1".into()), email: Some("a@example.com".into()) });
        assert!(!format!("{:?}", session).contains("tok.en.value"));
        keep(&store, &profile, &session).unwrap();
        assert_eq!(token(&store, &profile).unwrap().as_deref(), Some("tok.en.value"));

        let out = logout(&store, &profile, &client()).await.unwrap();
        assert_eq!(out, Logout { was_signed_in: true, backend_acknowledged: true, removed: true });
        assert!(logged_out.load(std::sync::atomic::Ordering::SeqCst));
        assert_eq!(token(&store, &profile).unwrap(), None);
        assert_eq!(logout(&store, &profile, &client()).await.unwrap().was_signed_in, false);
    }

    #[tokio::test]
    async fn refusals_are_told_apart() {
        let (origin, _) = serve().await;
        let profile = Profile { name: "default".into(), origin };
        assert_eq!(login(&profile, &client(), "a@example.com", "wrong").await.unwrap_err(), LoginError::Rejected("Invalid credentials".into()));
        assert_eq!(login(&profile, &client(), "a@example.com", "busy").await.unwrap_err(), LoginError::RateLimited);
        assert!(matches!(login(&profile, &client(), "a@example.com", "broken").await.unwrap_err(), LoginError::Unexpected(_)));
    }

    #[tokio::test]
    async fn offline_sign_in_is_unavailable_and_offline_sign_out_still_removes_the_session() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        // Bound for the whole test and hangs up on every connection, so no other
        // test's server can take the port and answer in its place.
        tokio::spawn(async move {
            while let Ok((socket, _)) = listener.accept().await {
                drop(socket);
            }
        });
        let profile = Profile { name: "default".into(), origin: Origin::parse(&format!("http://127.0.0.1:{}", port)).unwrap() };
        assert!(matches!(login(&profile, &client(), "a@example.com", "right").await.unwrap_err(), LoginError::Unavailable(_)));

        let store = MemoryStore::default();
        store.set(&profile.session_entry(), "kept-token").unwrap();
        let out = logout(&store, &profile, &client()).await.unwrap();
        assert_eq!(out, Logout { was_signed_in: true, backend_acknowledged: false, removed: true });
    }

    #[tokio::test]
    async fn a_store_that_does_not_keep_the_session_is_an_error() {
        let (origin, _) = serve().await;
        let profile = Profile { name: "default".into(), origin };
        let session = login(&profile, &client(), "a@example.com", "right").await.unwrap();
        assert!(keep(&ForgetfulStore, &profile, &session).unwrap_err().contains("did not keep it"));
    }

    #[test]
    fn forgetting_removes_only_this_profiles_session() {
        let store = MemoryStore::default();
        let a = Profile { name: "a".into(), origin: Origin::parse("https://a.example.com").unwrap() };
        let b = Profile { name: "b".into(), origin: Origin::parse("https://b.example.com").unwrap() };
        store.set(&a.session_entry(), "ta").unwrap();
        store.set(&b.session_entry(), "tb").unwrap();
        assert_eq!(forget(&store, &a), Ok(true));
        assert_eq!(token(&store, &a).unwrap(), None);
        assert_eq!(token(&store, &b).unwrap().as_deref(), Some("tb"));
        assert_eq!(forget(&store, &a), Ok(false));
    }
}
