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

fn build_user_info(user_val: &Value) -> UserInfo {
    let first_name = user_val
        .get("firstName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let last_name = user_val
        .get("lastName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    let full_name = format!("{} {}", first_name, last_name).trim().to_string();
    let fallback_name = user_val
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    UserInfo {
        id: user_val
            .get("id")
            .or_else(|| user_val.get("_id"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .into(),
        email: user_val
            .get("email")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .into(),
        name: if !full_name.is_empty() {
            full_name
        } else {
            fallback_name
        },
        avatar: user_val.get("avatar").and_then(|v| v.as_str()).map(String::from),
        role: user_val.get("role").and_then(|v| v.as_str()).map(String::from),
    }
}

async fn restore_session_from_storage(shared: &SharedState) -> Result<Option<UserInfo>, String> {
    let (existing_auth, existing_user, backend_url, mem_token) = {
        let s = shared.lock().await;
        (
            s.is_authenticated,
            s.current_user.clone(),
            s.backend_url.clone(),
            s.auth_token.clone(),
        )
    };

    if existing_auth {
        return Ok(existing_user);
    }

    let token = mem_token.or_else(crate::auth::get_stored_token);
    let Some(tok) = token else {
        return Ok(None);
    };

    let profile_url = format!("{}/api/auth/profile", backend_url);
    let client = reqwest::Client::new();
    let response = client
        .get(&profile_url)
        .header("Authorization", format!("Bearer {}", tok))
        .header("User-Agent", "cyber-forge-desktop/2.0")
        .send()
        .await;

    match response {
        Ok(resp) => {
            let body: Value = resp.json().await.map_err(|e| e.to_string())?;
            if body.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
                if let Some(user_val) = body.pointer("/data/user") {
                    let user = build_user_info(user_val);
                    let mut s = shared.lock().await;
                    s.set_authenticated(user.clone(), tok.clone());
                    let _ = crate::auth::store_token(&tok);
                    return Ok(Some(user));
                }
            }

            let _ = crate::auth::delete_token();
            Ok(None)
        }
        Err(_) => Ok(None),
    }
}

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
    #[serde(default)]
    #[allow(dead_code)]
    pub rememberMe: Option<bool>,
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

    let success = body.get("success").and_then(|v| v.as_bool()).unwrap_or(false);

    if success {
        if let (Some(user_val), Some(token)) = (
            body.pointer("/data/user"),
            body.pointer("/data/token").and_then(|t| t.as_str()),
        ) {
            let user = build_user_info(user_val);
            let mut s = state.lock().await;
            s.set_authenticated(user, token.to_string());
            let _ = crate::auth::store_token(token);

            // Return flattened response so JS can read result.token directly
            return Ok(serde_json::json!({
                "success": true,
                "token": token,
                "user": body.pointer("/data/user"),
                "message": "Login successful"
            }));
        }
    }

    // Return body as-is for error cases (already has success:false + message)
    Ok(body)
}

#[derive(Deserialize)]
pub struct RegisterData {
    pub name: String,
    pub email: String,
    pub password: String,
    #[serde(default)]
    #[allow(dead_code)]
    pub firstName: Option<String>,
    #[serde(default)]
    #[allow(dead_code)]
    pub lastName: Option<String>,
    #[serde(default)]
    #[allow(dead_code)]
    pub role: Option<String>,
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

    let success = body.get("success").and_then(|v| v.as_bool()).unwrap_or(false);

    if success {
        if let (Some(user_val), Some(token)) = (
            body.pointer("/data/user"),
            body.pointer("/data/token").and_then(|t| t.as_str()),
        ) {
            let user = build_user_info(user_val);
            let mut s = state.lock().await;
            s.set_authenticated(user, token.to_string());
            let _ = crate::auth::store_token(token);

            return Ok(serde_json::json!({
                "success": true,
                "token": token,
                "user": body.pointer("/data/user"),
                "message": "Registration successful"
            }));
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
    let _ = crate::auth::delete_token();

    Ok(CmdResult::ok(()))
}

#[tauri::command]
pub async fn auth_get_user(state: State<'_, SharedState>) -> Result<Value, String> {
    if let Some(user) = restore_session_from_storage(state.inner()).await? {
        Ok(serde_json::json!({ "success": true, "user": user }))
    } else {
        Ok(serde_json::json!({ "success": false, "user": null }))
    }
}

#[tauri::command]
pub async fn auth_is_authenticated(state: State<'_, SharedState>) -> Result<Value, String> {
    let restored_user = restore_session_from_storage(state.inner()).await?;
    Ok(serde_json::json!({
        "authenticated": restored_user.is_some(),
        "user": restored_user
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
    let mem_token = {
        let s = state.lock().await;
        s.auth_token.clone()
    };

    if let Some(token) = mem_token.or_else(crate::auth::get_stored_token) {
        let mut s = state.lock().await;
        s.auth_token = Some(token.clone());
        return Ok(serde_json::json!({ "token": token }));
    }

    Ok(serde_json::json!({ "token": Value::Null }))
}

#[tauri::command]
pub async fn auth_check_session(state: State<'_, SharedState>) -> Result<Value, String> {
    let s = state.lock().await;
    let token = s.auth_token.clone().or_else(crate::auth::get_stored_token);
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

    // Use the system module's get_os_name for accurate OS detection
    let os_name = crate::system::get_os_name();

    // Gather detailed system info for the setup wizard
    let cpu_model = sys.cpus().first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| format!("{} cores", sys.cpus().len()));
    let cpu_count = sys.cpus().len();
    let hostname = System::host_name().unwrap_or_else(|| "Unknown".to_string());
    let os_version = System::os_version().unwrap_or_default();
    let os_long_name = System::long_os_version().unwrap_or_default();

    Ok(serde_json::json!({
        "success": true,
        "data": {
            "cpu": (cpu_usage * 10.0).round() / 10.0,
            "cpu_model": cpu_model,
            "cpu_count": cpu_count,
            "memory": (mem_percent * 10.0).round() / 10.0,
            "uptime": System::uptime(),
            "platform": os_name,
            "os_name": os_long_name,
            "os_version": os_version,
            "arch": std::env::consts::ARCH,
            "hostname": hostname,
            "totalMemory": total_mem,
            "total_memory": total_mem,
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
// BROWSER DETECTION & MONITORING
// ──────────────────────────────────────────────

/// Full OS-aware browser detection — returns rich metadata for the frontend.
/// Privacy-conscious: no browsing history, cookies, or profile data accessed.
#[tauri::command]
pub async fn detect_system_browsers() -> Result<Value, String> {
    // Run detection on a blocking thread to avoid occupying the async runtime
    let result = tokio::task::spawn_blocking(|| {
        crate::system::detect_all_browsers()
    })
    .await
    .map_err(|e| format!("Detection task failed: {}", e))?;

    serde_json::to_value(&result).map_err(|e| e.to_string())
}

/// Legacy-compatible browser list (returns simplified array for existing callers).
#[tauri::command]
pub async fn get_available_browsers() -> Result<Value, String> {
    let result = tokio::task::spawn_blocking(|| {
        crate::system::detect_all_browsers()
    })
    .await
    .map_err(|e| format!("Detection task failed: {}", e))?;

    // Map to legacy format for backward compatibility
    let legacy: Vec<Value> = result.browsers.iter().filter(|b| b.is_installed).map(|b| {
        serde_json::json!({
            "name": b.name,
            "id": b.key,
            "key": b.key,
            "debugPort": b.debug_port,
            "available": b.is_installed,
            "version": b.version,
            "isRunning": b.is_running
        })
    }).collect();

    Ok(serde_json::json!(legacy))
}

#[tauri::command]
pub async fn system_monitor_stats() -> Result<Value, String> {
    let result = tokio::task::spawn_blocking(|| {
        let detection = crate::system::detect_all_browsers();

        // Use count_running_processes to get a count of all browser-related processes
        let browser_process_count = crate::system::process_checker::count_running_processes(
            &["chrome", "firefox", "safari", "edge", "brave", "opera", "arc"]
        );

        (detection, browser_process_count)
    })
    .await
    .map_err(|e| format!("Detection task failed: {}", e))?;

    let (detection, process_count) = result;
    let running_count = detection.browsers.iter().filter(|b| b.is_running).count();
    let installed_count = detection.browsers.iter().filter(|b| b.is_installed).count();

    Ok(serde_json::json!({
        "browsersInstalled": installed_count,
        "browsersRunning": running_count,
        "browserProcesses": process_count,
        "requestsCaptured": 0,
        "threatsDetected": 0,
        "monitoring": false
    }))
}
