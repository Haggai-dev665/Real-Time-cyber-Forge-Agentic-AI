//! Backend-derived metrics for the floating agent panel.
//! One round-trip gathers everything the panel needs: backend/ML health, the
//! registered-agent count + running state, threat count, and the live backend
//! latency. Calls run from Rust (reqwest + keychain bearer token) like the
//! desktop-app, so there are no CORS/CSP concerns.

use crate::state::AppState;
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::State;
use tokio::sync::Mutex;

type SharedState = Arc<Mutex<AppState>>;

const T: Duration = Duration::from_secs(12);
/// How long a backend-status snapshot stays fresh. The single broadcaster (and
/// any UI poll) reuses the cache within this window, so the backend is hit at
/// most once per `STATUS_TTL` no matter how many surfaces ask. Kept generous so
/// the panel's polling stays well under the backend's 100-req/15-min rate limit.
const STATUS_TTL: Duration = Duration::from_secs(60);

fn authed(
    mut req: reqwest::RequestBuilder,
    headers: &[(String, String)],
) -> reqwest::RequestBuilder {
    for (k, v) in headers {
        req = req.header(k, v);
    }
    req.timeout(T)
}

/// Fetch the backend-status snapshot with TTL caching. Shared by the
/// `agent_status` command and the background telemetry broadcaster.
pub async fn status_data(state: &SharedState) -> Value {
    {
        let s = state.lock().await;
        if let Some((t, v)) = &s.status_cache {
            if t.elapsed() < STATUS_TTL {
                return v.clone();
            }
        }
    }

    let (base, headers, is_auth) = {
        let s = state.lock().await;
        (s.backend_url.clone(), s.auth_headers(), s.is_authenticated)
    };

    // Before sign-in, never touch the backend. The broadcaster runs from app
    // launch (including the loading/login screens); polling /api/* there would
    // burn the server's rate limit and make the login request itself 429.
    // Not cached, so the panel switches to live status immediately after login.
    if !is_auth {
        return json!({ "success": true, "data": {
            "backendOk": false, "mlOk": false, "agentCount": 0,
            "agentRunning": false, "threatCount": 0, "latencyMs": 0
        }});
    }

    let client = reqwest::Client::new();

    // Backend health + live latency.
    let t0 = Instant::now();
    let backend_ok = client
        .get(format!("{}/health", base))
        .timeout(T)
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false);
    let latency_ms = t0.elapsed().as_millis() as u64;

    // ML service health.
    let ml_ok = match client
        .get(format!("{}/api/cyberforge-ml/health", base))
        .timeout(T)
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => r
            .json::<Value>()
            .await
            .ok()
            .map(|b| {
                b.get("success").and_then(|v| v.as_bool()).unwrap_or(false)
                    || b.get("status").and_then(|v| v.as_str()) == Some("healthy")
            })
            .unwrap_or(false),
        _ => false,
    };

    // Registered-agent count + running state (authenticated).
    let mut agent_count: u64 = 0;
    let mut agent_running = false;
    if backend_ok {
        if let Ok(r) = authed(
            client.get(format!("{}/api/agent/status/default", base)),
            &headers,
        )
        .send()
        .await
        {
            if r.status().is_success() {
                if let Ok(b) = r.json::<Value>().await {
                    let info = b.get("data").unwrap_or(&b);
                    agent_running = info
                        .get("isRunning")
                        .and_then(|v| v.as_bool())
                        .or_else(|| info.get("running").and_then(|v| v.as_bool()))
                        .unwrap_or(false);
                }
            }
        }

        if let Ok(r) = authed(client.get(format!("{}/api/agent/list", base)), &headers)
            .send()
            .await
        {
            if r.status().is_success() {
                if let Ok(b) = r.json::<Value>().await {
                    agent_count = b
                        .pointer("/data/count")
                        .and_then(|v| v.as_u64())
                        .or_else(|| b.get("count").and_then(|v| v.as_u64()))
                        .or_else(|| b.pointer("/data/agents").and_then(|v| v.as_array()).map(|a| a.len() as u64))
                        .unwrap_or(0);
                }
            }
        }

        // The desktop app is itself an active agent — count registered + self.
        agent_count += 1;
    }

    // Threat count.
    let mut threat_count: u64 = 0;
    if let Ok(r) = authed(
        client.get(format!("{}/api/threats?status=all&limit=100", base)),
        &headers,
    )
    .send()
    .await
    {
        if r.status().is_success() {
            if let Ok(b) = r.json::<Value>().await {
                threat_count = b
                    .pointer("/data/threats")
                    .or_else(|| b.get("threats"))
                    .and_then(|v| v.as_array())
                    .map(|a| a.len() as u64)
                    .unwrap_or(0);
            }
        }
    }

    let result = json!({
        "success": true,
        "data": {
            "backendOk": backend_ok,
            "mlOk": ml_ok,
            "agentCount": agent_count,
            "agentRunning": agent_running,
            "threatCount": threat_count,
            "latencyMs": latency_ms
        }
    });
    {
        let mut s = state.lock().await;
        s.status_cache = Some((Instant::now(), result.clone()));
    }
    result
}

#[tauri::command]
pub async fn agent_status(state: State<'_, SharedState>) -> Result<Value, String> {
    Ok(status_data(state.inner()).await)
}
