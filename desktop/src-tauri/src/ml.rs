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

/// Direct DeepSeek call via HF Inference Providers (OpenAI-compatible chat
/// completions). Returns a normalized `{response, model, source}` or `None` so
/// the caller can fall back to the backend. The token is read from the
/// keychain/env (see `auth::get_hf_token`) and is never embedded in source.
pub(crate) async fn deepseek_chat(query: &str, max_tokens: u32, token: &str) -> Result<Value, String> {
    let model = std::env::var("DEEPSEEK_MODEL")
        .unwrap_or_else(|_| "deepseek-ai/DeepSeek-V3-0324".to_string());
    let client = crate::http::client();
    let body = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": "You are CyberForge, an expert cybersecurity analyst assistant. Give precise, technically accurate, actionable answers about threats, malware, phishing, ransomware, C2, MITRE ATT&CK, IOCs, vulnerabilities and defensive operations. Lead with the verdict, then the reasoning. Be concise." },
            { "role": "user", "content": query }
        ],
        "max_tokens": max_tokens,
        "temperature": 0.3,
        "stream": false
    });
    let resp = client
        .post("https://router.huggingface.co/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(90))
        .json(&body)
        .send()
        .await
        .map_err(crate::http::error_chain)?;
    let status = resp.status();
    if !status.is_success() {
        let snippet: String = resp.text().await.unwrap_or_default().chars().take(220).collect();
        return Err(format!("HTTP {} from HF Inference Providers — {}", status.as_u16(), snippet.trim()));
    }
    let v: Value = resp.json().await.map_err(|e| format!("decode error: {}", e))?;
    let raw = v
        .pointer("/choices/0/message/content")
        .and_then(|t| t.as_str())
        .ok_or_else(|| "response had no message content".to_string())?;
    // DeepSeek-R1 may prepend chain-of-thought inside <think>…</think>; drop it.
    let mut text = raw.to_string();
    if let (Some(s), Some(e)) = (text.find("<think>"), text.find("</think>")) {
        if e >= s {
            text.replace_range(s..e + "</think>".len(), "");
        }
    }
    let text = text.trim();
    if text.is_empty() {
        return Err("model returned empty content".into());
    }
    Ok(json!({
        "success": true, "response": text, "model": model, "source": "deepseek-hf-providers",
        "engine": your_token_engine(&model)
    }))
}

/// The engine description for an answer that went straight from this app to
/// Hugging Face with the user's own token: a separate, user-supplied feature
/// (plan section 15), named so the user can tell it from the ML service.
fn your_token_engine(model: &str) -> Value {
    json!({
        "id": "your-token-deepseek",
        "kind": "language-model",
        "where": "Hugging Face Inference Providers, with your own token",
        "model": model,
        "label": format!("{} (sent from this app to Hugging Face with your own token)", model.rsplit('/').next().unwrap_or(model))
    })
}

/// DeepSeek cybersecurity Q&A. Calls DeepSeek DIRECTLY via HF Inference Providers
/// when a token is configured (reliable, real model). If a token IS set but the
/// call fails, the real reason is surfaced (not silently swallowed). Only with
/// NO token does it proxy to the backend (HF Space → grounded heuristic).
#[tauri::command]
pub async fn ml_security_chat(
    state: State<'_, SharedState>,
    query: String,
    max_tokens: Option<u32>,
) -> Result<Value, String> {
    // Reports send long prompts, so the limit is generous; the answer length is
    // capped because it is paid for on the user's own token.
    crate::privacy::require(crate::privacy::Feature::LlmProcessing)?;
    let query = crate::input::text(&query, "query", 32_000)?;
    let mt = crate::input::count(max_tokens, 512, 1, 4096);
    let token = crate::auth::get_hf_token();
    #[cfg(debug_assertions)]
    eprintln!(
        "[cyberforge] ml_security_chat: hf_token={}",
        if token.is_some() { "present" } else { "absent (will use server KB)" }
    );
    if let Some(token) = token {
        match deepseek_chat(query.trim(), mt, &token).await {
            Ok(v) => return Ok(v),
            Err(e) => {
                #[cfg(debug_assertions)]
                eprintln!("[cyberforge] deepseek call failed: {}", e);
                let model = std::env::var("DEEPSEEK_MODEL")
                    .unwrap_or_else(|_| "deepseek-ai/DeepSeek-V3-0324".to_string());
                return Ok(json!({
                    "success": false,
                    "model": "deepseek",
                    "source": "deepseek-error",
                    "engine": your_token_engine(&model),
                    "error": e.clone(),
                    "response": format!(
                        "DeepSeek request failed — {e}\n\nFix: confirm your Hugging Face token has the **Inference Providers** permission (and provider access/credits for `{model}`). Change the model with the DEEPSEEK_MODEL env var if needed."
                    )
                }));
            }
        }
    }
    ml_post(
        state.inner(),
        "/api/cyberforge-ml/v2/security-chat",
        json!({ "query": query, "max_tokens": mt }),
        75,
    )
    .await
}

/// Store the HF Inference token in the system credential store. Called from the
/// AI Assistance screen and Settings. Fails, with the reason, when the store
/// does not keep it; nothing is written to disk in its place.
#[tauri::command]
pub async fn set_hf_token(token: String) -> Result<Value, String> {
    let t = token.trim();
    if t.is_empty() {
        return Err("token is required".into());
    }
    // It is sent later as an Authorization header: printable ASCII, no spaces.
    if t.len() < 8 || t.len() > 512 || !t.chars().all(|c| c.is_ascii_graphic()) {
        return Err("that does not look like a Hugging Face token".into());
    }
    crate::auth::store_hf_token(t)?;
    Ok(json!({ "success": true }))
}

/// Whether an HF token is configured (so the UI can prompt to connect DeepSeek).
#[tauri::command]
pub async fn hf_token_status() -> Result<Value, String> {
    Ok(json!({ "configured": crate::auth::get_hf_token().is_some() }))
}

/// Mask a secret for display: `hf_Ykf…vzsTZ` (first 6 + last 4).
fn mask_token(t: &str) -> String {
    let t = t.trim();
    let n = t.chars().count();
    if n == 0 {
        return String::new();
    }
    if n <= 10 {
        return "\u{2022}".repeat(n);
    }
    let head: String = t.chars().take(6).collect();
    let tail: String = t.chars().skip(n - 4).collect();
    format!("{}\u{2026}{}", head, tail)
}

/// Say whether an HF token is saved, with a masked preview and where it came
/// from. The token itself is not returned: the page has no use for it, and a
/// value that is never sent to the page cannot leak from it.
#[tauri::command]
pub async fn hf_token_get() -> Result<Value, String> {
    let (tok, source) = crate::auth::hf_token_info();
    let configured = tok.is_some();
    let masked = mask_token(&tok.unwrap_or_default());
    Ok(json!({
        "configured": configured,
        "masked": masked,
        "source": source.label(),
        "plaintext": source == crate::auth::HfSource::PlaintextFile
    }))
}

/// Persist a one-line summary of an analysis to the local vector memory, so the
/// AI Assistant (and the Memory page) can recall every scan/analysis the user
/// runs — not just orchestrator scans.
fn capture_ml(label: &str, subject: &str, result: &Value) {
    if subject.trim().is_empty() {
        return;
    }
    let d = result.get("data").unwrap_or(result);
    let score = d
        .get("riskScore")
        .or_else(|| d.get("score"))
        .or_else(|| d.get("confidence"))
        .and_then(|v| v.as_f64())
        .map(|f| if f <= 1.0 { (f * 100.0).round() as i64 } else { f.round() as i64 });
    let verdict = d
        .get("verdict")
        .or_else(|| d.get("label"))
        .or_else(|| d.get("prediction"))
        .or_else(|| d.get("category"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let mut text = format!("{}: {}", label, subject);
    if let Some(v) = &verdict {
        text.push_str(&format!(" \u{2014} {}", v));
    }
    if let Some(s) = score {
        text.push_str(&format!(" (risk {})", s));
    }
    let category = label.to_lowercase().replace(' ', "-");
    crate::memory::remember(&text, "episodic", Some(subject.to_string()), Some(category), score);
}

/// BERT URL phishing/malware classification (elftsdmr/malware-url-detect).
#[tauri::command]
pub async fn ml_classify_url(state: State<'_, SharedState>, url: String) -> Result<Value, String> {
    crate::privacy::require(crate::privacy::Feature::CloudScanning)?;
    let url = crate::input::text(&url, "url", 2048)?;
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
    crate::privacy::require(crate::privacy::Feature::CloudScanning)?;
    let domain = crate::input::text(&domain, "domain", 253)?;
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
    crate::privacy::require(crate::privacy::Feature::CloudScanning)?;
    let url = crate::input::optional_text(url.as_deref(), "url", 2048)?;
    let domain = crate::input::optional_text(domain.as_deref(), "domain", 253)?;
    let ip = crate::input::optional_text(ip.as_deref(), "ip", 64)?;
    let hash = crate::input::optional_text(hash.as_deref(), "hash", 128)?;
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
    let subject = ["url", "domain", "ip", "hash"]
        .iter()
        .filter_map(|k| body.get(*k).and_then(|v| v.as_str()))
        .collect::<Vec<_>>()
        .join(" ");
    let res = ml_post(
        state.inner(),
        "/api/cyberforge-ml/v2/ioc-scan",
        Value::Object(body),
        75,
    )
    .await?;
    capture_ml("IOC scan", &subject, &res);
    Ok(res)
}

/// AI Deep Scan — ML predictions + BERT + DGA + feature importances, one fused score.
#[tauri::command]
pub async fn ml_url_enrich(state: State<'_, SharedState>, url: String) -> Result<Value, String> {
    crate::privacy::require(crate::privacy::Feature::CloudScanning)?;
    let url = crate::input::text(&url, "url", 2048)?;
    let res = ml_post(
        state.inner(),
        "/api/cyberforge-ml/v2/url-enrich",
        json!({ "url": url }),
        60,
    )
    .await?;
    capture_ml("AI deep scan", &url, &res);
    Ok(res)
}

/// ML stack status: transformer models loaded/available + service health.
#[tauri::command]
pub async fn ml_status(state: State<'_, SharedState>, include_capabilities: Option<bool>) -> Result<Value, String> {
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
    // Opt-in for Diagnostics; regular status polling keeps its existing cost.
    if include_capabilities.unwrap_or(false) {
        out["capabilities"] = json!({"success": false, "message": "Capability report unavailable"});
        if let Ok(r) = authed(
            client.get(format!("{}/api/v1/ml/capabilities", base))
                .timeout(Duration::from_secs(15)),
            &headers,
        ).send().await {
            let ok = r.status().is_success();
            if let Ok(v) = r.json::<Value>().await {
                if ok || v.get("success") == Some(&Value::Bool(false)) {
                    out["capabilities"] = v;
                }
            }
        }
    }
    Ok(out)
}
