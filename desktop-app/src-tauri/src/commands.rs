// Tauri Commands — equivalent to Electron IPC handlers.
// Each #[tauri::command] maps 1:1 with the old ipcMain.handle() calls.

use crate::state::{AppState, UserInfo};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use sysinfo::System;
use tauri::{Emitter, State, WebviewWindow};
use tokio::sync::Mutex;

type SharedState = Arc<Mutex<AppState>>;

// ──────────────────────────────────────────────
// Response Wrappers
// ──────────────────────────────────────────────

#[derive(Serialize)]
pub struct CmdResult<T: Serialize> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl<T: Serialize> CmdResult<T> {
    pub fn ok(data: T) -> Self {
        Self { success: true, data: Some(data), error: None }
    }
    #[allow(dead_code)]
    pub fn err(msg: impl Into<String>) -> Self {
        Self { success: false, data: None, error: Some(msg.into()) }
    }
}

// ──────────────────────────────────────────────
// AUTH COMMANDS
// ──────────────────────────────────────────────

#[derive(Deserialize)]
pub struct LoginCredentials {
    pub email: String,
    pub password: String,
}

#[tauri::command]
pub async fn auth_login(
    state: State<'_, SharedState>,
    credentials: LoginCredentials,
) -> Result<Value, String> {
    let s = state.lock().await;
    let url = format!("{}/api/auth/login", s.backend_url);
    drop(s);

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&serde_json::json!({
            "email": credentials.email,
            "password": credentials.password
        }))
        .header("User-Agent", "cyber-forge-desktop/2.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body: Value = resp.json().await.map_err(|e| e.to_string())?;

    if body.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
        if let (Some(user_val), Some(token)) = (
            body.pointer("/data/user"),
            body.pointer("/data/token").and_then(|t| t.as_str()),
        ) {
            let user = UserInfo {
                id: user_val.get("id").and_then(|v| v.as_str()).unwrap_or("").into(),
                email: user_val.get("email").and_then(|v| v.as_str()).unwrap_or("").into(),
                name: user_val.get("name").and_then(|v| v.as_str()).unwrap_or("").into(),
                avatar: user_val.get("avatar").and_then(|v| v.as_str()).map(String::from),
                role: user_val.get("role").and_then(|v| v.as_str()).map(String::from),
            };
            let mut s = state.lock().await;
            s.set_authenticated(user, token.to_string());
        }
    }

    Ok(body)
}

#[derive(Deserialize)]
pub struct RegisterData {
    pub name: String,
    pub email: String,
    pub password: String,
}

#[tauri::command]
pub async fn auth_register(
    state: State<'_, SharedState>,
    data: RegisterData,
) -> Result<Value, String> {
    let s = state.lock().await;
    let url = format!("{}/api/auth/register", s.backend_url);
    drop(s);

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&serde_json::json!({
            "name": data.name,
            "email": data.email,
            "password": data.password
        }))
        .header("User-Agent", "cyber-forge-desktop/2.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body: Value = resp.json().await.map_err(|e| e.to_string())?;

    if body.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
        if let (Some(user_val), Some(token)) = (
            body.pointer("/data/user"),
            body.pointer("/data/token").and_then(|t| t.as_str()),
        ) {
            let user = UserInfo {
                id: user_val.get("id").and_then(|v| v.as_str()).unwrap_or("").into(),
                email: user_val.get("email").and_then(|v| v.as_str()).unwrap_or("").into(),
                name: user_val.get("name").and_then(|v| v.as_str()).unwrap_or("").into(),
                avatar: user_val.get("avatar").and_then(|v| v.as_str()).map(String::from),
                role: user_val.get("role").and_then(|v| v.as_str()).map(String::from),
            };
            let mut s = state.lock().await;
            s.set_authenticated(user, token.to_string());
        }
    }

    Ok(body)
}

#[tauri::command]
pub async fn auth_logout(state: State<'_, SharedState>) -> Result<CmdResult<()>, String> {
    let mut s = state.lock().await;
    let url = format!("{}/api/auth/logout", s.backend_url);
    let headers = s.auth_headers();
    s.clear_auth();
    drop(s);

    let client = reqwest::Client::new();
    let mut req = client.post(&url);
    for (k, v) in headers {
        req = req.header(&k, &v);
    }
    let _ = req.send().await; // Best-effort server-side logout

    Ok(CmdResult::ok(()))
}

#[tauri::command]
pub async fn auth_get_user(state: State<'_, SharedState>) -> Result<Value, String> {
    let s = state.lock().await;
    if let Some(ref user) = s.current_user {
        Ok(serde_json::json!({ "success": true, "user": user }))
    } else {
        Ok(serde_json::json!({ "success": false, "user": null }))
    }
}

#[tauri::command]
pub async fn auth_is_authenticated(state: State<'_, SharedState>) -> Result<Value, String> {
    let s = state.lock().await;
    Ok(serde_json::json!({
        "authenticated": s.is_authenticated,
        "user": s.current_user
    }))
}

#[tauri::command]
pub async fn auth_update_profile(
    state: State<'_, SharedState>,
    profile_data: Value,
) -> Result<Value, String> {
    let s = state.lock().await;
    let url = format!("{}/api/auth/profile", s.backend_url);
    let headers = s.auth_headers();
    drop(s);

    let client = reqwest::Client::new();
    let mut req = client.put(&url).json(&profile_data);
    for (k, v) in headers {
        req = req.header(&k, &v);
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(body)
}

#[tauri::command]
pub async fn auth_change_password(
    state: State<'_, SharedState>,
    password_data: Value,
) -> Result<Value, String> {
    let s = state.lock().await;
    let url = format!("{}/api/auth/password", s.backend_url);
    let headers = s.auth_headers();
    drop(s);

    let client = reqwest::Client::new();
    let mut req = client.put(&url).json(&password_data);
    for (k, v) in headers {
        req = req.header(&k, &v);
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(body)
}

#[tauri::command]
pub async fn auth_google_url() -> Result<String, String> {
    let client_id = "YOUR_GOOGLE_CLIENT_ID";
    let redirect_uri = "https://cyberforge-ddd97655464f.herokuapp.com/api/auth/google/callback";
    let scope = "email profile openid";
    Ok(format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
        client_id,
        urlencoding::encode(redirect_uri),
        urlencoding::encode(scope)
    ))
}

#[tauri::command]
pub async fn auth_get_token(state: State<'_, SharedState>) -> Result<Value, String> {
    let s = state.lock().await;
    Ok(serde_json::json!({ "token": s.auth_token }))
}

#[tauri::command]
pub async fn auth_check_session(state: State<'_, SharedState>) -> Result<Value, String> {
    let s = state.lock().await;
    let token = s.auth_token.clone();
    let url = format!("{}/api/auth/session", s.backend_url);
    drop(s);

    if let Some(tok) = token {
        let client = reqwest::Client::new();
        let resp = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", tok))
            .header("User-Agent", "cyber-forge-desktop/2.0")
            .send()
            .await;

        match resp {
            Ok(r) => {
                let body: Value = r.json().await.map_err(|e| e.to_string())?;
                Ok(body)
            }
            Err(e) => Ok(serde_json::json!({ "valid": false, "error": e.to_string() })),
        }
    } else {
        Ok(serde_json::json!({ "valid": false }))
    }
}

// ──────────────────────────────────────────────
// SYSTEM COMMANDS
// ──────────────────────────────────────────────

#[tauri::command]
pub async fn get_system_stats() -> Result<Value, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let total_mem = sys.total_memory() as f64;
    let used_mem = sys.used_memory() as f64;
    let mem_percent = if total_mem > 0.0 { (used_mem / total_mem) * 100.0 } else { 0.0 };

    let cpu_usage: f64 = sys.cpus().iter().map(|c| c.cpu_usage() as f64).sum::<f64>()
        / sys.cpus().len().max(1) as f64;

    Ok(serde_json::json!({
        "success": true,
        "data": {
            "cpu": (cpu_usage * 10.0).round() / 10.0,
            "memory": (mem_percent * 10.0).round() / 10.0,
            "uptime": System::uptime(),
            "platform": std::env::consts::OS,
            "arch": std::env::consts::ARCH,
            "totalMemory": total_mem,
            "usedMemory": used_mem
        }
    }))
}

#[tauri::command]
pub async fn health_check(state: State<'_, SharedState>) -> Result<Value, String> {
    let s = state.lock().await;
    let url = format!("{}/health", s.backend_url);
    let headers = s.auth_headers();
    drop(s);

    let client = reqwest::Client::new();
    let mut req = client.get(&url);
    for (k, v) in headers {
        req = req.header(&k, &v);
    }

    match req.send().await {
        Ok(resp) => {
            let body: Value = resp.json().await.map_err(|e| e.to_string())?;
            Ok(serde_json::json!({ "success": true, "data": body }))
        }
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "error": "Backend not available",
            "data": { "status": "offline", "message": format!("Backend service unavailable: {}", e) }
        })),
    }
}

#[tauri::command]
pub async fn get_threats(state: State<'_, SharedState>) -> Result<Value, String> {
    let s = state.lock().await;
    let url = format!("{}/api/threats?status=all&limit=100", s.backend_url);
    let headers = s.auth_headers();
    drop(s);

    let client = reqwest::Client::new();
    let mut req = client.get(&url);
    for (k, v) in headers {
        req = req.header(&k, &v);
    }

    match req.send().await {
        Ok(resp) => {
            let body: Value = resp.json().await.map_err(|e| e.to_string())?;
            let threats = body
                .pointer("/data/threats")
                .or_else(|| body.get("threats"))
                .cloned()
                .unwrap_or(Value::Array(vec![]));
            Ok(serde_json::json!({ "success": true, "data": threats }))
        }
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "error": e.to_string(),
            "data": []
        })),
    }
}

// ──────────────────────────────────────────────
// BACKEND COMMANDS
// ──────────────────────────────────────────────

#[tauri::command]
pub async fn send_to_backend(
    state: State<'_, SharedState>,
    _data: Value,
) -> Result<bool, String> {
    // This would send over the WebSocket. For now, acknowledge.
    let s = state.lock().await;
    Ok(s.ws_connected)
}

#[tauri::command]
pub async fn get_analysis_data() -> Result<Value, String> {
    Ok(serde_json::json!([]))
}

// ──────────────────────────────────────────────
// WINDOW COMMANDS
// ──────────────────────────────────────────────

#[tauri::command]
pub async fn toggle_fullscreen(window: WebviewWindow) -> Result<CmdResult<()>, String> {
    let is_full = window.is_fullscreen().unwrap_or(false);
    window.set_fullscreen(!is_full).map_err(|e| e.to_string())?;
    Ok(CmdResult::ok(()))
}

#[tauri::command]
pub async fn minimize_window(window: WebviewWindow) -> Result<CmdResult<()>, String> {
    window.minimize().map_err(|e| e.to_string())?;
    Ok(CmdResult::ok(()))
}

#[tauri::command]
pub async fn maximize_window(window: WebviewWindow) -> Result<CmdResult<()>, String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())?;
    } else {
        window.maximize().map_err(|e| e.to_string())?;
    }
    Ok(CmdResult::ok(()))
}

#[tauri::command]
pub async fn close_window(window: WebviewWindow) -> Result<CmdResult<()>, String> {
    window.close().map_err(|e| e.to_string())?;
    Ok(CmdResult::ok(()))
}

// ──────────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────────

#[tauri::command]
pub async fn navigate_to(window: WebviewWindow, page: String) -> Result<CmdResult<()>, String> {
    // Tauri v2 uses webview_url or we emit an event for the frontend router
    window.emit("navigate", &page).map_err(|e| e.to_string())?;
    Ok(CmdResult::ok(()))
}

// ──────────────────────────────────────────────
// BROWSER MONITOR (stub — native implementation)
// ──────────────────────────────────────────────

#[tauri::command]
pub async fn get_available_browsers() -> Result<Value, String> {
    let browsers = crate::system::detect_browsers();
    Ok(serde_json::json!(browsers))
}

#[tauri::command]
pub async fn system_monitor_stats() -> Result<Value, String> {
    Ok(serde_json::json!({
        "browsersConnected": 0,
        "requestsCaptured": 0,
        "threatsDetected": 0,
        "monitoring": false
    }))
}
