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

/// Add to a sign-in result whether the session was kept for the next launch.
/// When it was not, the user is signed in until the app closes, and is told so.
pub(crate) fn note_session_storage(result: &mut Value, kept: &Result<(), String>) {
    result["sessionSaved"] = Value::Bool(kept.is_ok());
    if let Err(reason) = kept {
        result["sessionNote"] = Value::String(format!(
            "You are signed in until you close the app. The session could not be saved for next time: {}.",
            reason
        ));
    }
}

/// Whether the system credential store works on this machine, for Settings.
#[tauri::command]
pub async fn credential_storage_status() -> Result<Value, String> {
    Ok(match crate::auth::check_secure_storage() {
        Ok(()) => serde_json::json!({ "working": true }),
        Err(reason) => serde_json::json!({ "working": false, "reason": reason }),
    })
}

/// Restore an existing session from the in-memory state or the credential store
/// by validating the token against `/api/auth/profile`.
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
                    // Already signed in from a stored token; a failure to store
                    // it again changes nothing the user needs to be told.
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
            let kept = crate::auth::store_token(token);
            crate::auth::store_user(&user_json); // cache profile for offline restore

            // The page is told the sign-in worked and who signed in. It is not
            // given the session token: every backend call is made from here.
            let mut result = serde_json::json!({
                "success": true,
                "user": body.pointer("/data/user"),
                "message": "Login successful"
            });
            note_session_storage(&mut result, &kept);
            return Ok(result);
        }
    }

    // A refusal goes to the page with the backend's reasons (see explain_refusal).
    Ok(explain_refusal(body))
}

/// A refused sign-in or registration, as the page shows it. The backend answers
/// a rejected form with "Validation failed" and a list of field errors; the
/// message becomes those reasons ("Last name is required …"), and each field
/// error keeps only its field and reason: the backend's copy also echoes the
/// submitted value, which for a password is the password.
fn explain_refusal(mut body: Value) -> Value {
    let errors: Vec<(String, String)> = body
        .get("errors")
        .and_then(|e| e.as_array())
        .map(|list| {
            list.iter()
                .filter_map(|e| {
                    let reason = e.get("msg").and_then(|m| m.as_str())?.trim().trim_end_matches('.').to_string();
                    let field = e.get("path").and_then(|p| p.as_str()).unwrap_or("").to_string();
                    (!reason.is_empty()).then_some((field, reason))
                })
                .collect()
        })
        .unwrap_or_default();
    if body.get("errors").is_some() {
        body["errors"] = serde_json::json!(errors.iter().map(|(field, reason)| serde_json::json!({ "field": field, "message": reason })).collect::<Vec<_>>());
    }
    let mut reasons: Vec<&str> = Vec::new();
    for (_, reason) in &errors {
        if !reasons.contains(&reason.as_str()) {
            reasons.push(reason);
        }
    }
    if !reasons.is_empty() {
        body["message"] = Value::String(format!("{}.", reasons.join(". ")));
    }
    body
}

/// What the register page sends. The backend requires the first and last
/// names separately; an empty one is sent as empty so the backend's own
/// reason comes back.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterData {
    #[serde(default)]
    pub first_name: String,
    #[serde(default)]
    pub last_name: String,
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
            "firstName": data.first_name.trim(),
            "lastName": data.last_name.trim(),
            "email": data.email.trim(),
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
            let kept = crate::auth::store_token(token);
            crate::auth::store_user(&user_json); // cache profile for offline restore

            let mut result = serde_json::json!({
                "success": true,
                "user": body.pointer("/data/user"),
                "message": "Registration successful"
            });
            note_session_storage(&mut result, &kept);
            return Ok(result);
        }
    }

    Ok(explain_refusal(body))
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

/// Backend base URL this app is configured to use. The UI asks for it instead
/// of carrying its own copy of the address.
#[tauri::command]
pub async fn get_backend_url(state: State<'_, SharedState>) -> Result<String, String> {
    Ok(state.lock().await.backend_url.clone())
}

#[tauri::command]
pub async fn auth_is_authenticated(state: State<'_, SharedState>) -> Result<Value, String> {
    let restored_user = restore_session_from_storage(state.inner()).await?;
    Ok(serde_json::json!({
        "authenticated": restored_user.is_some(),
        "user": restored_user
    }))
}


#[cfg(test)]
mod refusal_tests {
    use super::explain_refusal;
    use serde_json::json;

    #[test]
    fn field_reasons_replace_validation_failed_and_submitted_values_are_dropped() {
        let body = json!({
            "success": false,
            "message": "Validation failed",
            "errors": [
                { "type": "field", "value": "", "msg": "First name is required and must be less than 50 characters", "path": "firstName" },
                { "type": "field", "value": "hunter2", "msg": "Password must be at least 8 characters long", "path": "password" },
                { "type": "field", "value": "hunter2", "msg": "Password must be at least 8 characters long", "path": "password" }
            ]
        });
        let out = explain_refusal(body);
        assert_eq!(out["message"], "First name is required and must be less than 50 characters. Password must be at least 8 characters long.");
        assert_eq!(out["errors"][1], json!({ "field": "password", "message": "Password must be at least 8 characters long" }));
        assert!(!out.to_string().contains("hunter2"), "the submitted password is not passed to the page");
    }

    #[test]
    fn a_refusal_without_field_errors_keeps_its_message() {
        let out = explain_refusal(json!({ "success": false, "message": "Invalid credentials" }));
        assert_eq!(out["message"], "Invalid credentials");
    }
}
