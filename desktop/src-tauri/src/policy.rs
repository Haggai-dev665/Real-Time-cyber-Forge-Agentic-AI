//! Security Functions — proxy commands to the backend Policy Engine (`/api/policy`).
//!
//! Powers the Security Functions screen: list / toggle / create / delete the
//! policies that decide what to do during a threat (block the request, alert the
//! user/SOC, or secure the system), plus live evaluation and a response-action
//! log. Every call runs from Rust (reqwest + keychain token) so there are no
//! CORS/CSP concerns — identical pattern to `agent.rs`.

use crate::state::AppState;
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;
use tauri::State;
use tokio::sync::Mutex;

type SharedState = Arc<Mutex<AppState>>;

fn authed(
    mut req: reqwest::RequestBuilder,
    headers: &[(String, String)],
) -> reqwest::RequestBuilder {
    for (k, v) in headers {
        req = req.header(k, v);
    }
    req
}

/// (backend_url, auth_headers, is_authenticated)
async fn ctx(state: &SharedState) -> (String, Vec<(String, String)>, bool) {
    let s = state.lock().await;
    (s.backend_url.clone(), s.auth_headers(), s.is_authenticated)
}

async fn finish(req: reqwest::RequestBuilder) -> Result<Value, String> {
    match req.send().await {
        Ok(r) => r.json::<Value>().await.map_err(crate::http::error_chain),
        Err(e) => Err(crate::http::error_chain(e)),
    }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/// Supported trigger metrics, operators, and action types (no auth required).
#[tauri::command]
pub async fn policy_meta(state: State<'_, SharedState>) -> Result<Value, String> {
    let (base, _h, _a) = ctx(state.inner()).await;
    let client = reqwest::Client::new();
    finish(client.get(format!("{}/api/policy/meta", base)).timeout(Duration::from_secs(15))).await
}

/// List all security functions (policies).
#[tauri::command]
pub async fn policy_list(state: State<'_, SharedState>) -> Result<Value, String> {
    let (base, headers, is_auth) = ctx(state.inner()).await;
    if !is_auth {
        return Ok(json!({ "success": true, "policies": [], "total": 0, "offline": true }));
    }
    let client = reqwest::Client::new();
    finish(authed(
        client.get(format!("{}/api/policy", base)).timeout(Duration::from_secs(15)),
        &headers,
    ))
    .await
}

/// Policy engine statistics (totals + most-triggered).
#[tauri::command]
pub async fn policy_stats(state: State<'_, SharedState>) -> Result<Value, String> {
    let (base, headers, is_auth) = ctx(state.inner()).await;
    if !is_auth {
        return Ok(json!({ "success": true, "data": { "totalPolicies": 0, "enabledPolicies": 0, "totalResponseActions": 0, "mostTriggered": [] } }));
    }
    let client = reqwest::Client::new();
    finish(authed(
        client.get(format!("{}/api/policy/stats", base)).timeout(Duration::from_secs(15)),
        &headers,
    ))
    .await
}

/// Recent response actions taken by the engine.
#[tauri::command]
pub async fn policy_response_log(
    state: State<'_, SharedState>,
    limit: Option<u32>,
) -> Result<Value, String> {
    let (base, headers, is_auth) = ctx(state.inner()).await;
    if !is_auth {
        return Ok(json!({ "success": true, "log": [], "total": 0 }));
    }
    let l = limit.unwrap_or(50);
    let client = reqwest::Client::new();
    finish(authed(
        client
            .get(format!("{}/api/policy/response-log?limit={}", base, l))
            .timeout(Duration::from_secs(15)),
        &headers,
    ))
    .await
}

// ── Writes ──────────────────────────────────────────────────────────────────

/// Create a new security function. `policy` = { name, description, trigger, action, enabled, scope }.
#[tauri::command]
pub async fn policy_create(
    state: State<'_, SharedState>,
    policy: Value,
) -> Result<Value, String> {
    let (base, headers, is_auth) = ctx(state.inner()).await;
    if !is_auth {
        return Ok(json!({ "success": false, "error": "Sign in to manage security functions" }));
    }
    let client = reqwest::Client::new();
    finish(
        authed(
            client.post(format!("{}/api/policy", base)).timeout(Duration::from_secs(15)),
            &headers,
        )
        .json(&policy),
    )
    .await
}

/// Update a security function (used for enable/disable toggle and edits).
/// `updates` = any of { name, description, trigger, action, enabled, scope }.
#[tauri::command]
pub async fn policy_update(
    state: State<'_, SharedState>,
    id: String,
    updates: Value,
) -> Result<Value, String> {
    let (base, headers, is_auth) = ctx(state.inner()).await;
    if !is_auth {
        return Ok(json!({ "success": false, "error": "Sign in to manage security functions" }));
    }
    let client = reqwest::Client::new();
    finish(
        authed(
            client.put(format!("{}/api/policy/{}", base, id)).timeout(Duration::from_secs(15)),
            &headers,
        )
        .json(&updates),
    )
    .await
}

/// Delete a security function (default policies are protected server-side).
#[tauri::command]
pub async fn policy_delete(
    state: State<'_, SharedState>,
    id: String,
) -> Result<Value, String> {
    let (base, headers, is_auth) = ctx(state.inner()).await;
    if !is_auth {
        return Ok(json!({ "success": false, "error": "Sign in to manage security functions" }));
    }
    let client = reqwest::Client::new();
    finish(authed(
        client.delete(format!("{}/api/policy/{}", base, id)).timeout(Duration::from_secs(15)),
        &headers,
    ))
    .await
}

/// Evaluate a simulated/real risk event against all enabled functions.
/// `payload` = { nodeId, metrics: { risk_score, alert_count_24h, ... } }.
#[tauri::command]
pub async fn policy_evaluate(
    state: State<'_, SharedState>,
    payload: Value,
) -> Result<Value, String> {
    let (base, headers, _is_auth) = ctx(state.inner()).await;
    let client = reqwest::Client::new();
    finish(
        authed(
            client
                .post(format!("{}/api/policy/evaluate", base))
                .timeout(Duration::from_secs(15)),
            &headers,
        )
        .json(&payload),
    )
    .await
}
