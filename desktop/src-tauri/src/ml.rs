//! Direct ML capabilities, surfaced from the HF Space through the backend proxy
//! (`/api/cyberforge-ml/v2/*`):
//!   • `ml_security_chat` — DeepSeek cybersecurity Q&A (DeepSeek → Mistral → ML heuristic)
//!   • `ml_classify_url`  — BERT URL phishing/malware classifier
//!   • `ml_detect_dga`    — DGA-generated domain detector
//!   • `ml_ioc_scan`      — multi-IOC scan (url/domain/ip/hash) across all models
//!   • `ml_url_enrich`    — AI Deep Scan: ML + BERT + DGA fused into one score
//!   • `ml_status`        — ML stack status (transformers loaded/available + health)
//!
//! These call the BACKEND (not the HF Space directly) so the desktop reuses the
//! same auth + `cyber-forge-desktop` User-Agent path as the rest of the app and
//! has no CORS/CSP concerns. DeepSeek vs. Mistral is decided server-side on the
//! Space, so the desktop transparently benefits once the Space has `HF_TOKEN`.

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

/// (backend base url, auth headers) snapshot from shared state.
async fn ctx(state: &SharedState) -> (String, Vec<(String, String)>) {
    let s = state.lock().await;
    (s.backend_url.clone(), s.auth_headers())
}

/// POST `body` to a backend ML path and return the parsed JSON.
async fn ml_post(
    state: &SharedState,
    path: &str,
    body: Value,
    timeout: u64,
) -> Result<Value, String> {
    let (base, headers) = ctx(state).await;
    let client = reqwest::Client::new();
    let req = client
        .post(format!("{}{}", base, path))
        .timeout(Duration::from_secs(timeout))
        .json(&body);
    let resp = authed(req, &headers).send().await.map_err(crate::http::error_chain)?;
    resp.json::<Value>().await.map_err(|e| e.to_string())
}

/// DeepSeek cybersecurity Q&A. The Space decides DeepSeek vs. Mistral vs. heuristic.
#[tauri::command]
pub async fn ml_security_chat(
    state: State<'_, SharedState>,
    query: String,
    max_tokens: Option<u32>,
) -> Result<Value, String> {
    if query.trim().is_empty() {
        return Err("query is required".into());
    }
    ml_post(
        state.inner(),
        "/api/cyberforge-ml/v2/security-chat",
        json!({ "query": query, "max_tokens": max_tokens.unwrap_or(512) }),
        75,
    )
    .await
}

/// BERT URL phishing/malware classification (elftsdmr/malware-url-detect).
#[tauri::command]
pub async fn ml_classify_url(state: State<'_, SharedState>, url: String) -> Result<Value, String> {
    if url.trim().is_empty() {
        return Err("url is required".into());
    }
    ml_post(
        state.inner(),
        "/api/cyberforge-ml/v2/url-classify",
        json!({ "url": url }),
        40,
    )
    .await
}

/// DGA-generated domain detection (entropy + character-pattern model).
#[tauri::command]
pub async fn ml_detect_dga(state: State<'_, SharedState>, domain: String) -> Result<Value, String> {
    if domain.trim().is_empty() {
        return Err("domain is required".into());
    }
    ml_post(
        state.inner(),
        "/api/cyberforge-ml/v2/dga-detect",
        json!({ "domain": domain }),
        40,
    )
    .await
}

/// Multi-IOC scan: any of url/domain/ip/hash, across all ML models + DGA + BERT.
#[tauri::command]
pub async fn ml_ioc_scan(
    state: State<'_, SharedState>,
    url: Option<String>,
    domain: Option<String>,
    ip: Option<String>,
    hash: Option<String>,
) -> Result<Value, String> {
    let mut body = serde_json::Map::new();
    if let Some(u) = url.filter(|s| !s.trim().is_empty()) {
        body.insert("url".into(), json!(u));
    }
    if let Some(d) = domain.filter(|s| !s.trim().is_empty()) {
        body.insert("domain".into(), json!(d));
    }
    if let Some(i) = ip.filter(|s| !s.trim().is_empty()) {
        body.insert("ip".into(), json!(i));
    }
    if let Some(h) = hash.filter(|s| !s.trim().is_empty()) {
        body.insert("hash".into(), json!(h));
    }
    if body.is_empty() {
        return Err("at least one of url, domain, ip, hash is required".into());
    }
    ml_post(
        state.inner(),
        "/api/cyberforge-ml/v2/ioc-scan",
        Value::Object(body),
        75,
    )
    .await
}

/// AI Deep Scan — ML predictions + BERT + DGA + feature importances, one fused score.
#[tauri::command]
pub async fn ml_url_enrich(state: State<'_, SharedState>, url: String) -> Result<Value, String> {
    if url.trim().is_empty() {
        return Err("url is required".into());
    }
    ml_post(
        state.inner(),
        "/api/cyberforge-ml/v2/url-enrich",
        json!({ "url": url }),
        60,
    )
    .await
}

/// ML stack status: transformer models loaded/available + service health.
#[tauri::command]
pub async fn ml_status(state: State<'_, SharedState>) -> Result<Value, String> {
    let (base, headers) = ctx(state.inner()).await;
    let client = reqwest::Client::new();
    let mut out = json!({});
    if let Ok(r) = authed(
        client
            .get(format!("{}/api/cyberforge-ml/v2/status", base))
            .timeout(Duration::from_secs(15)),
        &headers,
    )
    .send()
    .await
    {
        if let Ok(v) = r.json::<Value>().await {
            out["transformers"] = v;
        }
    }
    if let Ok(r) = authed(
        client
            .get(format!("{}/api/cyberforge-ml/health", base))
            .timeout(Duration::from_secs(15)),
        &headers,
    )
    .send()
    .await
    {
        if let Ok(v) = r.json::<Value>().await {
            out["health"] = v;
        }
    }
    Ok(out)
}
