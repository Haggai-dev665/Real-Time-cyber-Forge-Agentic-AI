//! Shared application state for the CyberForge console.
//!
//! Currently this only tracks the authenticated session. Auth is the single
//! piece of the app wired to the backend; everything else renders statically.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Instant;

/// Authenticated user profile, normalized from the backend response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub email: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
}

/// Process-wide state, shared across Tauri commands behind an async `Mutex`.
pub struct AppState {
    pub backend_url: String,
    pub auth_token: Option<String>,
    pub current_user: Option<UserInfo>,
    pub is_authenticated: bool,
    /// Last URL scan result — shared so the Agent Core screen and the floating
    /// agent panel stay in sync (whichever runs a scan, both can read it).
    pub last_scan: Option<Value>,
    /// TTL caches — a single source of truth so many UI surfaces never each hit
    /// the backend. (timestamp, payload).
    pub status_cache: Option<(Instant, Value)>,
    pub sys_cache: Option<(Instant, Value)>,
    pub browsers_cache: Option<(Instant, Value)>,
    pub threats_cache: Option<(Instant, Value)>,
    /// Latest full browser-history snapshot collected in the background (all
    /// browsers, all profiles, read straight from the on-disk SQLite files even
    /// while the browsers are closed). The startup collector task refreshes this;
    /// UI commands serve from it so the history appears instantly. (timestamp,
    /// payload).
    pub history_cache: Option<(Instant, Value)>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            // Same backend the existing desktop-app authenticates against.
            backend_url: "https://cyberforge-ddd97655464f.herokuapp.com".into(),
            auth_token: None,
            current_user: None,
            is_authenticated: false,
            last_scan: None,
            status_cache: None,
            sys_cache: None,
            browsers_cache: None,
            threats_cache: None,
            history_cache: None,
        }
    }

    pub fn set_authenticated(&mut self, user: UserInfo, token: String) {
        self.current_user = Some(user);
        self.auth_token = Some(token);
        self.is_authenticated = true;
    }

    pub fn clear_auth(&mut self) {
        self.current_user = None;
        self.auth_token = None;
        self.is_authenticated = false;
    }

    /// Headers for authenticated backend calls (User-Agent + bearer token).
    pub fn auth_headers(&self) -> Vec<(String, String)> {
        // Identify as a desktop app so the backend grants basic threat/stats
        // access (it matches the "cyber-forge-desktop" User-Agent).
        let mut headers = vec![("User-Agent".into(), "cyber-forge-desktop/1.0".into())];
        if let Some(ref token) = self.auth_token {
            headers.push(("Authorization".into(), format!("Bearer {}", token)));
        }
        headers
    }
}
