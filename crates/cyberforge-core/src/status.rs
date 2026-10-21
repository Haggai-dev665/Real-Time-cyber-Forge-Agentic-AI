//! The read-only status check behind `cyberforge status`.
//!
//! It asks four questions and answers each on its own, so one failure never
//! hides the others:
//! - **backend**: does the profile's origin answer `/health`?
//! - **credential store**: can this profile's entry be read?
//! - **session**: is there a session for this profile, and does the backend
//!   still accept it?
//! - **desktop broker**: can local work be handed to a running desktop app?
//!
//! It writes nothing: not to the credential store, the backend, or the device.

use crate::credentials::SecretStore;
use crate::http::{error_chain, read_json};
use crate::profile::Profile;
use crate::text::printable;
use serde::Serialize;
use serde_json::Value;
use std::time::Instant;

#[derive(Debug, Serialize, PartialEq)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum Backend {
    /// `/health` answered 2xx with a JSON body.
    Reachable { http_status: u16, service_status: Option<String>, latency_ms: u64 },
    /// The origin answered, but not with a healthy JSON response.
    Unhealthy { http_status: u16, detail: String, latency_ms: u64 },
    /// No answer: offline, DNS, refused, TLS or timeout.
    Unreachable { error: String },
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum CredentialStore {
    Available,
    Unavailable { error: String },
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum Session {
    /// No session is kept for this profile.
    SignedOut,
    /// The backend accepted the session.
    Valid { user_id: Option<String>, email: Option<String> },
    /// The backend refused the session (HTTP 401 or 403).
    Rejected { http_status: u16 },
    /// A session is kept but could not be checked.
    Unverified { reason: String },
    /// The credential store could not be read, so whether one is kept is unknown.
    Unknown,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum DesktopBroker {
    /// A program of this user owns this computer's CyberForge state and answered.
    Attached { owner: String, version: String, pid: u32, owns: Vec<String> },
    /// No program owns it now (the desktop app is not running).
    NotRunning,
    /// Something answers on the broker's name but not as this user. Not used.
    Untrusted { reason: String },
    /// No broker on this platform, or it could not be asked.
    NotAvailable { reason: String },
}

impl DesktopBroker {
    pub async fn ask() -> DesktopBroker {
        use crate::broker::QueryError;
        match crate::broker::query(std::time::Duration::from_secs(3)).await {
            Ok(info) => DesktopBroker::Attached {
                owner: printable(&info.owner, 20),
                version: printable(&info.version, 40),
                pid: info.pid,
                owns: info.owns.iter().take(16).map(|s| printable(s, 40)).collect(),
            },
            Err(QueryError::NotRunning) => DesktopBroker::NotRunning,
            Err(QueryError::Untrusted(reason)) => DesktopBroker::Untrusted { reason: printable(&reason, MAX_TEXT) },
            Err(QueryError::Unsupported(reason)) | Err(QueryError::Failed(reason)) => DesktopBroker::NotAvailable { reason: printable(&reason, MAX_TEXT) },
        }
    }
}

#[derive(Debug, Serialize, PartialEq)]
pub struct StatusReport {
    pub profile: String,
    pub origin: String,
    pub backend: Backend,
    pub credential_store: CredentialStore,
    pub session: Session,
    pub desktop_broker: DesktopBroker,
}

impl StatusReport {
    /// What a person should know, in order of importance.
    pub fn warnings(&self) -> Vec<String> {
        let mut out = Vec::new();
        match &self.backend {
            Backend::Unreachable { .. } => out.push(format!("The backend at {} did not answer.", self.origin)),
            Backend::Unhealthy { http_status, .. } => {
                out.push(format!("The backend at {} answered HTTP {} instead of a healthy status.", self.origin, http_status))
            }
            Backend::Reachable { .. } => {}
        }
        if let CredentialStore::Unavailable { .. } = self.credential_store {
            out.push("The system credential store could not be read, so no session can be kept.".into());
        }
        if let Session::Rejected { .. } = self.session {
            out.push("The backend no longer accepts this profile's session; sign in again.".into());
        }
        if let DesktopBroker::Untrusted { .. } = self.desktop_broker {
            out.push("A program not running as you answers on CyberForge's broker name; it was not trusted.".into());
        }
        out
    }
}

const MAX_TEXT: usize = 300;

pub async fn check(profile: &Profile, store: &(dyn SecretStore + Sync), client: &reqwest::Client) -> StatusReport {
    let backend = check_backend(profile, client).await;
    let (credential_store, token) = match store.get(&profile.session_entry()) {
        Ok(token) => (CredentialStore::Available, token.filter(|t| !t.trim().is_empty())),
        Err(error) => (CredentialStore::Unavailable { error: printable(&error, MAX_TEXT) }, None),
    };
    let session = match (&credential_store, token) {
        (CredentialStore::Unavailable { .. }, _) => Session::Unknown,
        (_, None) => Session::SignedOut,
        (_, Some(token)) => match backend {
            Backend::Reachable { .. } => check_session(profile, client, &token).await,
            _ => Session::Unverified { reason: "the backend did not answer".into() },
        },
    };
    StatusReport {
        profile: profile.name.clone(),
        origin: profile.origin.to_string(),
        backend,
        credential_store,
        session,
        desktop_broker: DesktopBroker::ask().await,
    }
}

async fn check_backend(profile: &Profile, client: &reqwest::Client) -> Backend {
    let started = Instant::now();
    let response = match client.get(profile.origin.join("/health")).send().await {
        Ok(response) => response,
        Err(error) => return Backend::Unreachable { error: printable(&error_chain(error), MAX_TEXT) },
    };
    let http_status = response.status().as_u16();
    let success = response.status().is_success();
    let body = read_json(response).await;
    let latency_ms = started.elapsed().as_millis() as u64;
    match body {
        Ok(json) if success => Backend::Reachable {
            http_status,
            service_status: json.get("status").and_then(Value::as_str).map(|s| printable(s, 40)),
            latency_ms,
        },
        Ok(_) => Backend::Unhealthy { http_status, detail: format!("HTTP {}", http_status), latency_ms },
        Err(detail) => Backend::Unhealthy { http_status, detail: printable(&detail, MAX_TEXT), latency_ms },
    }
}

async fn check_session(profile: &Profile, client: &reqwest::Client, token: &str) -> Session {
    let response = match client.get(profile.origin.join("/api/auth/profile")).bearer_auth(token).send().await {
        Ok(response) => response,
        Err(error) => return Session::Unverified { reason: printable(&error_chain(error), MAX_TEXT) },
    };
    let http_status = response.status().as_u16();
    if http_status == 401 || http_status == 403 {
        return Session::Rejected { http_status };
    }
    if !response.status().is_success() {
        return Session::Unverified { reason: format!("the backend answered HTTP {}", http_status) };
    }
    let json = read_json(response).await.unwrap_or(Value::Null);
    let account = crate::session::account_of(json.pointer("/data/user").or_else(|| json.get("user")).unwrap_or(&Value::Null));
    Session::Valid { user_id: account.user_id, email: account.email }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::credentials::MemoryStore;
    use crate::origin::Origin;
    use std::time::Duration;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    /// A one-purpose HTTP server: `/health` answers `health`, and
    /// `/api/auth/profile` answers 200 only for `Bearer good-token`.
    async fn serve(health: &'static str) -> Origin {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            loop {
                let Ok((mut socket, _)) = listener.accept().await else { return };
                let mut buffer = vec![0u8; 8192];
                let n = socket.read(&mut buffer).await.unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..n]).to_string();
                let (status, body) = if request.starts_with("GET /health ") {
                    ("200 OK", health)
                } else if request.starts_with("GET /api/auth/profile ") && request.to_ascii_lowercase().contains("authorization: bearer good-token") {
                    ("200 OK", r#"{"success":true,"data":{"user":{"id":"u1","email":"a@example.com"}}}"#)
                } else {
                    ("401 Unauthorized", r#"{"success":false}"#)
                };
                let reply = format!("HTTP/1.1 {}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}", status, body.len(), body);
                let _ = socket.write_all(reply.as_bytes()).await;
            }
        });
        Origin::parse(&format!("http://127.0.0.1:{}", port)).unwrap()
    }

    async fn closed_origin() -> Origin {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        // Bound for the whole test and hangs up on every connection, so no other
        // test's server can take the port and answer in its place.
        tokio::spawn(async move {
            while let Ok((socket, _)) = listener.accept().await {
                drop(socket);
            }
        });
        Origin::parse(&format!("http://127.0.0.1:{}", port)).unwrap()
    }

    struct BrokenStore;
    impl SecretStore for BrokenStore {
        fn set(&self, _: &str, _: &str) -> Result<(), String> { Err("no store".into()) }
        fn get(&self, _: &str) -> Result<Option<String>, String> { Err("Platform secure storage failure: \u{1b}[31mlocked".into()) }
        fn delete(&self, _: &str) -> Result<(), String> { Err("no store".into()) }
    }

    fn client() -> reqwest::Client {
        crate::http::client("cyberforge-test", Duration::from_secs(5))
    }

    #[tokio::test]
    async fn a_healthy_backend_and_an_accepted_session() {
        let profile = Profile { name: "default".into(), origin: serve(r#"{"status":"healthy"}"#).await };
        let store = MemoryStore::default();
        store.set(&profile.session_entry(), "good-token").unwrap();
        let report = check(&profile, &store, &client()).await;
        assert!(matches!(report.backend, Backend::Reachable { http_status: 200, ref service_status, .. } if service_status.as_deref() == Some("healthy")));
        assert_eq!(report.credential_store, CredentialStore::Available);
        assert_eq!(report.session, Session::Valid { user_id: Some("u1".into()), email: Some("a@example.com".into()) });
        assert!(report.warnings().is_empty());
    }

    #[tokio::test]
    async fn no_session_is_signed_out_and_a_refused_one_is_rejected() {
        let profile = Profile { name: "default".into(), origin: serve(r#"{"status":"healthy"}"#).await };
        let store = MemoryStore::default();
        assert_eq!(check(&profile, &store, &client()).await.session, Session::SignedOut);
        store.set(&profile.session_entry(), "expired-token").unwrap();
        let report = check(&profile, &store, &client()).await;
        assert_eq!(report.session, Session::Rejected { http_status: 401 });
        assert_eq!(report.warnings().len(), 1);
    }

    #[tokio::test]
    async fn offline_reports_unreachable_and_leaves_the_session_unverified() {
        let profile = Profile { name: "default".into(), origin: closed_origin().await };
        let store = MemoryStore::default();
        store.set(&profile.session_entry(), "good-token").unwrap();
        let report = check(&profile, &store, &client()).await;
        assert!(matches!(report.backend, Backend::Unreachable { .. }));
        assert!(matches!(report.session, Session::Unverified { .. }));
        assert!(report.warnings()[0].contains("did not answer"));
    }

    #[tokio::test]
    async fn a_broken_credential_store_is_reported_not_fatal() {
        let profile = Profile { name: "default".into(), origin: serve(r#"{"status":"healthy"}"#).await };
        let report = check(&profile, &BrokenStore, &client()).await;
        assert!(matches!(report.backend, Backend::Reachable { .. }));
        match &report.credential_store {
            CredentialStore::Unavailable { error } => assert!(!error.contains('\u{1b}')),
            other => panic!("{other:?}"),
        }
        assert_eq!(report.session, Session::Unknown);
    }

    #[tokio::test]
    async fn a_non_json_health_answer_is_unhealthy() {
        let profile = Profile { name: "default".into(), origin: serve("<html>maintenance</html>").await };
        let report = check(&profile, &MemoryStore::default(), &client()).await;
        assert!(matches!(report.backend, Backend::Unhealthy { http_status: 200, .. }));
    }

    #[tokio::test]
    async fn a_session_for_another_profile_or_origin_is_not_used() {
        let origin = serve(r#"{"status":"healthy"}"#).await;
        let store = MemoryStore::default();
        let work = Profile { name: "work".into(), origin: origin.clone() };
        store.set(&work.session_entry(), "good-token").unwrap();
        let other = Profile { name: "default".into(), origin };
        assert_eq!(check(&other, &store, &client()).await.session, Session::SignedOut);
    }

    #[test]
    fn the_report_serialises_with_tagged_states() {
        let report = StatusReport {
            profile: "default".into(),
            origin: "https://example.com".into(),
            backend: Backend::Unreachable { error: "refused".into() },
            credential_store: CredentialStore::Available,
            session: Session::SignedOut,
            desktop_broker: DesktopBroker::NotAvailable { reason: "x".into() },
        };
        let json = serde_json::to_value(&report).unwrap();
        assert_eq!(json["backend"]["state"], "unreachable");
        assert_eq!(json["session"]["state"], "signed_out");
        assert_eq!(json["credential_store"]["state"], "available");
    }
}
