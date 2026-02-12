// Application State — shared across all Tauri commands.

use serde::{Deserialize, Serialize};

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

pub struct AppState {
    pub backend_url: String,
    pub ws_url: String,
    pub auth_token: Option<String>,
    pub current_user: Option<UserInfo>,
    pub is_authenticated: bool,
    pub ws_connected: bool,
    pub dashboard_loaded: bool,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            backend_url: "https://cyberforge-ddd97655464f.herokuapp.com".into(),
            ws_url: "wss://cyberforge-ddd97655464f.herokuapp.com/ws".into(),
            auth_token: None,
            current_user: None,
            is_authenticated: false,
            ws_connected: false,
            dashboard_loaded: false,
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
        self.dashboard_loaded = false;
    }

    pub fn auth_headers(&self) -> Vec<(String, String)> {
        let mut headers = vec![
            ("User-Agent".into(), "cyber-forge-desktop/2.0".into()),
        ];
        if let Some(ref token) = self.auth_token {
            headers.push(("Authorization".into(), format!("Bearer {}", token)));
        }
        headers
    }
}
