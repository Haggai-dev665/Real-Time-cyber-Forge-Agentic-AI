//! Backend authentication commands.
//!
//! These mirror the existing desktop-app: the HTTP calls to `/api/auth/*` run
//! from Rust (via `reqwest`) rather than the webview, which avoids browser CORS
//! and lets us persist the session token in the OS keychain. The frontend calls
//! them through `window.__TAURI__.core.invoke(...)`.

use crate::state::{AppState, UserInfo};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

type SharedState = Arc<Mutex<AppState>>;

/// Normalize a backend `user` object into our `UserInfo` (handles both
/// `firstName`/`lastName` and a single `name` field, and `id`/`_id`).
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

/// Restore an existing session from the in-memory state or the keychain by
/// validating the token against `/api/auth/profile`.
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
        .header("User-Agent", "cyberforge-console/1.0")
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
// Response wrapper
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
}

// ──────────────────────────────────────────────
// Auth commands
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
    let url = {
        let s = state.lock().await;
        format!("{}/api/auth/login", s.backend_url)
    };

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&serde_json::json!({
            "email": credentials.email,
            "password": credentials.password
        }))
        .header("User-Agent", "cyberforge-console/1.0")
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

            // Flatten so the frontend can read `result.token` / `result.user`.
            return Ok(serde_json::json!({
                "success": true,
                "token": token,
                "user": body.pointer("/data/user"),
                "message": "Login successful"
            }));
        }
    }

    // Pass the backend body through for error cases (carries success:false + message).
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
    let url = {
        let s = state.lock().await;
        format!("{}/api/auth/register", s.backend_url)
    };

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&serde_json::json!({
            "name": data.name,
            "email": data.email,
            "password": data.password
        }))
        .header("User-Agent", "cyberforge-console/1.0")
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
    let (url, headers) = {
        let mut s = state.lock().await;
        let url = format!("{}/api/auth/logout", s.backend_url);
        let headers = s.auth_headers();
        s.clear_auth();
        (url, headers)
    };

    let client = reqwest::Client::new();
    let mut req = client.post(&url);
    for (k, v) in headers {
        req = req.header(&k, &v);
    }
    let _ = req.send().await; // best-effort server-side logout
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
