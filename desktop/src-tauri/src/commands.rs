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
pub fn build_user_info(user_val: &Value) -> UserInfo {
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

    // OPTIMISTIC RESTORE: if we cached the user profile at login, restore the
    // session immediately with NO network call — so login persists across
    // restarts even when the backend is slow, asleep, or rate-limited. A
    // best-effort background check then re-validates and only logs out on a
    // definitive 401/403 (a genuinely expired or revoked token).
    if let Some(uj) = crate::auth::get_stored_user() {
        if let Ok(val) = serde_json::from_str::<Value>(&uj) {
            let user = build_user_info(&val);
            if !user.email.is_empty() || !user.id.is_empty() {
                {
                    let mut s = shared.lock().await;
                    s.set_authenticated(user.clone(), tok.clone());
                }
                #[cfg(debug_assertions)]
                eprintln!("[cyberforge] restore_session: optimistic (cached user {})", user.email);
                let shared2 = shared.clone();
                let url = format!("{}/api/auth/profile", backend_url);
                let tok2 = tok.clone();
                tauri::async_runtime::spawn(async move { revalidate(shared2, url, tok2).await });
                return Ok(Some(user));
            }
        }
    }

    // No cached user (older / token-only session): validate against the backend,
    // and cache the profile on success so future launches restore offline.
    let profile_url = format!("{}/api/auth/profile", backend_url);
    let client = crate::http::client();
    let response = client
        .get(&profile_url)
        .header("Authorization", format!("Bearer {}", tok))
        .send()
        .await;

    match response {
        Ok(resp) => {
            let status = resp.status();
            let body = match crate::http::read_json(resp).await {
                Ok(b) => b,
                // Non-JSON (rate-limited / server hiccup): keep the token, don't log out.
                Err(_) => return Ok(None),
            };
            if body.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
                if let Some(user_val) = body.pointer("/data/user") {
                    let user = build_user_info(user_val);
                    let user_json = serde_json::to_string(&user).unwrap_or_default();
                    {
                        let mut s = shared.lock().await;
                        s.set_authenticated(user.clone(), tok.clone());
                    }
                    let _ = crate::auth::store_token(&tok);
                    crate::auth::store_user(&user_json);
                    return Ok(Some(user));
                }
            }
            // Only forget the token when the server DEFINITIVELY rejected it.
            if status == reqwest::StatusCode::UNAUTHORIZED
                || status == reqwest::StatusCode::FORBIDDEN
            {
                let _ = crate::auth::delete_token();
            }
            Ok(None)
        }
        Err(_) => Ok(None),
    }
}

/// Background re-validation for an optimistically-restored session. Only clears
/// the session when the server DEFINITIVELY rejects the token (401/403); a
/// network / rate-limit / non-JSON failure keeps the session intact.
async fn revalidate(shared: SharedState, profile_url: String, token: String) {
    let client = crate::http::client();
    if let Ok(resp) = client
        .get(&profile_url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
    {
        let status = resp.status();
        if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
            {
                let mut s = shared.lock().await;
                s.clear_auth();
            }
            let _ = crate::auth::delete_token();
            #[cfg(debug_assertions)]
            eprintln!("[cyberforge] revalidate: token rejected ({status}), session cleared");
        }
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

    let client = crate::http::client();
    let resp = client
        .post(&url)
        .json(&serde_json::json!({
            "email": credentials.email,
            "password": credentials.password
        }))
        .send()
        .await
        .map_err(crate::http::error_chain)?;

    let body = crate::http::read_json(resp).await?;
    let success = body.get("success").and_then(|v| v.as_bool()).unwrap_or(false);

    if success {
        if let (Some(user_val), Some(token)) = (
            body.pointer("/data/user"),
            body.pointer("/data/token").and_then(|t| t.as_str()),
        ) {
            let user = build_user_info(user_val);
            let user_json = serde_json::to_string(&user).unwrap_or_default();
            let mut s = state.lock().await;
            s.set_authenticated(user, token.to_string());
            drop(s);
            let _ = crate::auth::store_token(token);
            crate::auth::store_user(&user_json); // cache profile for offline restore

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

    let client = crate::http::client();
    let resp = client
        .post(&url)
        .json(&serde_json::json!({
            "name": data.name,
            "email": data.email,
            "password": data.password
        }))
        .send()
        .await
        .map_err(crate::http::error_chain)?;

    let body = crate::http::read_json(resp).await?;
    let success = body.get("success").and_then(|v| v.as_bool()).unwrap_or(false);

    if success {
        if let (Some(user_val), Some(token)) = (
            body.pointer("/data/user"),
            body.pointer("/data/token").and_then(|t| t.as_str()),
        ) {
            let user = build_user_info(user_val);
            let user_json = serde_json::to_string(&user).unwrap_or_default();
            let mut s = state.lock().await;
            s.set_authenticated(user, token.to_string());
            drop(s);
            let _ = crate::auth::store_token(token);
            crate::auth::store_user(&user_json); // cache profile for offline restore

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

    let client = crate::http::client();
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
