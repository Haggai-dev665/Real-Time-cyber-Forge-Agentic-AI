//! Direct ML capabilities, surfaced from the HF Space through the backend proxy
//! (`/api/cyberforge-ml/v2/*`):
//!   • `ml_security_chat` — grounded Qwen Q&A through the backend by default
//!   • `ml_classify_url`  — BERT URL phishing/malware classifier
//!   • `ml_detect_dga`    — DGA-generated domain detector
//!   • `ml_ioc_scan`      — multi-IOC scan (url/domain/ip/hash) across all models
//!   • `ml_url_enrich`    — AI Deep Scan: ML + BERT + DGA fused into one score
//!   • `ml_status`        — ML stack status (transformers loaded/available + health)
//!
//! These call the BACKEND (not the HF Space directly) so the desktop reuses the
//! same auth + `cyber-forge-desktop` User-Agent path as the rest of the app and
//! has no CORS/CSP concerns. Direct DeepSeek is a separately selected optional
//! provider; storing a token alone does not select it.

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
pub(crate) async fn ml_post(
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

/// Security Q&A uses the backend's fine-tuned Qwen service by default. Direct
/// DeepSeek is an explicit opt-in via CYBERFORGE_CHAT_PROVIDER=deepseek; merely
/// saving an HF token must not bypass the deployed grounding/reference service.
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
    let direct_provider = std::env::var("CYBERFORGE_CHAT_PROVIDER")
        .map(|value| value.eq_ignore_ascii_case("deepseek"))
        .unwrap_or(false);
    let token = if direct_provider { crate::auth::get_hf_token() } else { None };
    #[cfg(debug_assertions)]
    eprintln!(
        "[cyberforge] ml_security_chat: hf_token={}",
        if token.is_some() { "direct provider selected" } else { "using server Qwen" }
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

/// One server-sent event block (`data: {...}`), or None.
fn sse_event(block: &[u8]) -> Option<Value> {
    let text = std::str::from_utf8(block).ok()?;
    let line = text.lines().find(|l| l.starts_with("data: "))?;
    serde_json::from_str(&line[6..]).ok()
}

/// Earlier turns for the assistant: the last 8, roles user|assistant, 2,000 characters each.
fn chat_turns(history: Option<Value>) -> Vec<Value> {
    let all = history.and_then(|h| h.as_array().cloned()).unwrap_or_default();
    let start = all.len().saturating_sub(8);
    all.into_iter()
        .skip(start)
        .filter_map(|t| {
            let content = t.get("content")?.as_str()?.trim().to_string();
            if content.is_empty() {
                return None;
            }
            let role = if t.get("role").and_then(Value::as_str) == Some("assistant") { "assistant" } else { "user" };
            Some(json!({ "role": role, "content": content.chars().take(2000).collect::<String>() }))
        })
        .collect()
}

/// The assistant's answer as it is written. Each piece goes to the main window
/// as a `cf-chat-stream` event ({id, type: "thinking"|"answer", delta}); the
/// checked final answer is returned. A backend without the stream route yet
/// answers through the plain chat route (`streamed: false`).
#[tauri::command]
pub async fn ml_security_chat_stream(
    app: tauri::AppHandle,
    state: State<'_, SharedState>,
    query: String,
    history: Option<Value>,
    think: Option<String>,
    request_id: String,
) -> Result<Value, String> {
    crate::privacy::require(crate::privacy::Feature::LlmProcessing)?;
    let query = crate::input::text(&query, "query", 32_000)?;
    let id: String = request_id.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_').take(64).collect();
    if id.is_empty() {
        return Err("request_id is required".into());
    }
    let think = match think.as_deref() {
        Some("on") => "on",
        Some("off") => "off",
        _ => "auto",
    };
    let turns = chat_turns(history);
    let body = json!({ "query": query, "history": turns, "think": think, "max_tokens": 700 });
    let (base, headers) = ctx(state.inner()).await;
    let req = crate::http::client_with_timeout(Duration::from_secs(120))
        .post(format!("{base}/api/cyberforge-ml/v2/security-chat/stream"))
        .header("Accept", "text/event-stream")
        .json(&body);
    let mut resp = authed(req, &headers).send().await.map_err(crate::http::error_chain)?;
    if resp.status().as_u16() == 404 {
        let mut answer = ml_post(state.inner(), "/api/cyberforge-ml/v2/security-chat", body, 75).await?;
        answer["streamed"] = json!(false);
        return Ok(answer);
    }
    if !resp.status().is_success() {
        return Err(format!("The assistant is unavailable (HTTP {}).", resp.status().as_u16()));
    }
    use tauri::Emitter;
    // bytes, not text: a character can be split across two chunks
    let mut buffer: Vec<u8> = Vec::new();
    let mut last: Option<Value> = None;
    while let Some(chunk) = resp.chunk().await.map_err(crate::http::error_chain)? {
        buffer.extend_from_slice(&chunk);
        while let Some(at) = buffer.windows(2).position(|w| w == b"\n\n") {
            let block: Vec<u8> = buffer.drain(..at + 2).collect();
            let Some(event) = sse_event(&block) else { continue };
            match event["type"].as_str() {
                Some(kind @ ("thinking" | "answer")) => {
                    let _ = app.emit_to("main", "cf-chat-stream", json!({ "id": id, "type": kind, "delta": event["delta"] }));
                }
                Some("final") => last = Some(event["result"].clone()),
                _ => {}
            }
        }
    }
    let mut answer = last.ok_or("The answer stopped before it was finished.")?;
    answer["streamed"] = json!(true);
    Ok(answer)
}

/// The eight analysis agents on one address, reported as they work. Each
/// event of the backend's stream ({type: "stage" | "agent_start" | "agent"})
/// goes to the main window as `cf-agents-stream` ({id, event}); the final
/// report is returned. A backend without the stream route answers through
/// the plain route (`streamed: false`, no live events).
#[tauri::command]
pub async fn agents_analyze_stream(
    app: tauri::AppHandle,
    state: State<'_, SharedState>,
    url: String,
    request_id: String,
) -> Result<Value, String> {
    crate::privacy::require(crate::privacy::Feature::CloudScanning)?;
    let url = crate::input::text(&url, "url", 2048)?;
    let id: String = request_id.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_').take(64).collect();
    if id.is_empty() {
        return Err("request_id is required".into());
    }
    let body = json!({ "url": url });
    let (base, headers) = ctx(state.inner()).await;
    let req = crate::http::client_with_timeout(Duration::from_secs(150))
        .post(format!("{base}/api/orchestrator/analyze/stream"))
        .header("Accept", "text/event-stream")
        .json(&body);
    let mut resp = authed(req, &headers).send().await.map_err(crate::http::error_chain)?;
    if resp.status().as_u16() == 404 {
        let answer = ml_post(state.inner(), "/api/orchestrator/analyze", body, 150).await?;
        let mut report = answer.get("report").cloned().unwrap_or(answer);
        report["streamed"] = json!(false);
        return Ok(report);
    }
    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let detail = resp.text().await.unwrap_or_default();
        let message = serde_json::from_str::<Value>(&detail).ok()
            .and_then(|v| v.get("message").or_else(|| v.get("error")).and_then(Value::as_str).map(str::to_string))
            .unwrap_or_else(|| format!("HTTP {status}"));
        return Err(format!("The analysis agents are unavailable: {message}"));
    }
    use tauri::Emitter;
    let mut buffer: Vec<u8> = Vec::new();
    let mut report: Option<Value> = None;
    while let Some(chunk) = resp.chunk().await.map_err(crate::http::error_chain)? {
        buffer.extend_from_slice(&chunk);
        while let Some(at) = buffer.windows(2).position(|w| w == b"\n\n") {
            let block: Vec<u8> = buffer.drain(..at + 2).collect();
            let Some(event) = sse_event(&block) else { continue };
            match event["type"].as_str() {
                Some("stage" | "agent_start" | "agent") => {
                    let _ = app.emit_to("main", "cf-agents-stream", json!({ "id": id, "event": event }));
                }
                Some("final") => report = Some(event["report"].clone()),
                Some("error") => {
                    return Err(format!("The analysis failed: {}", event["message"].as_str().unwrap_or("no reason given")));
                }
                _ => {}
            }
        }
    }
    let mut report = report.ok_or("The analysis stopped before it was finished.")?;
    report["streamed"] = json!(true);
    Ok(report)
}

#[cfg(test)]
mod stream_tests {
    use super::*;

    #[test]
    fn events_and_turns_are_read_safely() {
        assert_eq!(sse_event(b"data: {\"type\":\"answer\",\"delta\":\"h\xc3\xa9\"}\n\n").unwrap()["delta"], "hé");
        assert!(sse_event(b": comment\n\n").is_none());
        assert!(sse_event(b"data: {broken\n\n").is_none());
        let history = json!((0..12).map(|i| json!({ "role": if i % 2 == 0 { "system" } else { "assistant" }, "content": format!("turn {i}") })).collect::<Vec<_>>());
        let turns = chat_turns(Some(history));
        assert_eq!(turns.len(), 8);
        assert_eq!(turns[0]["content"], "turn 4");
        assert!(turns.iter().all(|t| t["role"] == "user" || t["role"] == "assistant"));
        assert_eq!(chat_turns(Some(json!([{ "role": "user", "content": "x".repeat(5000) }])))[0]["content"].as_str().unwrap().len(), 2000);
        assert!(chat_turns(Some(json!("not a list"))).is_empty());
    }
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
    out["local"] = crate::local_ml::status();
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
