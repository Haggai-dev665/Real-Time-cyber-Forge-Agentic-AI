//! A finding's workflow from the Investigations page (DET-02): acknowledge,
//! investigate, resolve, mark a false positive, or reopen.
//!
//! One command, `finding_state`, with the actions from a fixed list. The finding
//! ID is checked as a record ID before it goes into the path; the backend checks
//! the transition against the finding's state and records it.

use serde_json::{json, Value};
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;

use crate::state::AppState;

type SharedState = Arc<Mutex<AppState>>;

pub const ACTIONS: &[&str] = &["acknowledge", "investigate", "resolve", "false_positive", "reopen"];

/// The path and body for a step, or why it cannot be sent.
pub fn request_for(threat_id: &str, action: &str, note: Option<&str>) -> Result<(String, Value), String> {
    if !ACTIONS.contains(&action) {
        return Err(format!("action must be one of: {}", ACTIONS.join(", ")));
    }
    let id = crate::input::record_id(threat_id, "finding")?;
    let note: String = note.unwrap_or("").chars().filter(|c| !c.is_control()).take(1000).collect();
    Ok((format!("/api/threats/{id}/state"), json!({ "action": action, "note": note })))
}

#[tauri::command]
pub async fn finding_state(state: State<'_, SharedState>, threat_id: String, action: String, note: Option<String>) -> Result<Value, String> {
    let (path, body) = request_for(&threat_id, &action, note.as_deref())?;
    let (base, headers, signed_in) = {
        let s = state.lock().await;
        (s.backend_url.clone(), s.auth_headers(), s.is_authenticated)
    };
    if !signed_in {
        return Err("Sign in first.".into());
    }
    let mut request = crate::http::client().put(format!("{base}{path}")).json(&body);
    for (k, v) in &headers {
        request = request.header(k, v);
    }
    let response = request.send().await.map_err(|e| format!("The server could not be reached: {e}"))?;
    let ok = response.status().is_success();
    let json: Value = response.json().await.unwrap_or(Value::Null);
    if ok {
        return Ok(json.get("data").cloned().unwrap_or(Value::Null));
    }
    let message = json.get("message").and_then(|m| m.as_str()).unwrap_or("The server refused the request");
    let code = json.get("code").and_then(|c| c.as_str()).unwrap_or("");
    Err(if code.is_empty() { message.to_string() } else { format!("{message} ({code})") })
}

/// An exception for a finding's category and target: the reason (3 to 500 characters) and 1 to 90 days.
pub fn exception_request(threat_id: &str, reason: &str, days: u32) -> Result<(String, Value), String> {
    let id = crate::input::record_id(threat_id, "finding")?;
    let reason: String = reason.chars().filter(|c| !c.is_control()).take(500).collect();
    if reason.trim().chars().count() < 3 {
        return Err("A reason is required.".into());
    }
    if !(1..=90).contains(&days) {
        return Err("An exception lasts 1 to 90 days.".into());
    }
    Ok((format!("/api/threats/{id}/exception"), json!({ "reason": reason.trim(), "expiresInDays": days })))
}

#[tauri::command]
pub async fn finding_exception(state: State<'_, SharedState>, threat_id: String, reason: String, days: u32) -> Result<Value, String> {
    let (path, body) = exception_request(&threat_id, &reason, days)?;
    let (base, headers, signed_in) = {
        let s = state.lock().await;
        (s.backend_url.clone(), s.auth_headers(), s.is_authenticated)
    };
    if !signed_in {
        return Err("Sign in first.".into());
    }
    let mut request = crate::http::client().post(format!("{base}{path}")).json(&body);
    for (k, v) in &headers {
        request = request.header(k, v);
    }
    let response = request.send().await.map_err(|e| format!("The server could not be reached: {e}"))?;
    let ok = response.status().is_success();
    let json: Value = response.json().await.unwrap_or(Value::Null);
    if ok {
        return Ok(json.get("data").cloned().unwrap_or(Value::Null));
    }
    Err(json.get("message").and_then(|m| m.as_str()).unwrap_or("The server refused the request").to_string())
}

/// GET or POST to the backend for the account, returning `data`.
async fn call(state: &SharedState, method: &str, path: &str, body: Value) -> Result<Value, String> {
    let (base, headers, signed_in) = {
        let s = state.lock().await;
        (s.backend_url.clone(), s.auth_headers(), s.is_authenticated)
    };
    if !signed_in {
        return Err("Sign in first.".into());
    }
    let client = crate::http::client();
    let mut request = if method == "GET" { client.get(format!("{base}{path}")) } else { client.post(format!("{base}{path}")).json(&body) };
    for (k, v) in &headers {
        request = request.header(k, v);
    }
    let response = request.send().await.map_err(|e| format!("The server could not be reached: {e}"))?;
    let ok = response.status().is_success();
    let json: Value = response.json().await.unwrap_or(Value::Null);
    if ok {
        return Ok(json.get("data").cloned().unwrap_or(Value::Null));
    }
    Err(json.get("message").and_then(|m| m.as_str()).unwrap_or("The server refused the request").to_string())
}

/// Move an agent alert through its workflow (DET-02).
#[tauri::command]
pub async fn alert_state(state: State<'_, SharedState>, alert_id: String, action: String, note: Option<String>) -> Result<Value, String> {
    if !["acknowledge", "escalate", "resolve", "false_positive", "reopen"].contains(&action.as_str()) {
        return Err("action must be acknowledge, escalate, resolve, false_positive or reopen".into());
    }
    let id = alert_id.trim();
    if id.is_empty() || id.len() > 128 || !id.chars().all(|c| c.is_ascii_alphanumeric() || "_.:-".contains(c)) {
        return Err("alert is not a valid ID".into());
    }
    let note: String = note.unwrap_or_default().chars().filter(|c| !c.is_control()).take(1000).collect();
    let (base, headers, signed_in) = {
        let s = state.lock().await;
        (s.backend_url.clone(), s.auth_headers(), s.is_authenticated)
    };
    if !signed_in {
        return Err("Sign in first.".into());
    }
    let mut request = crate::http::client().put(format!("{base}/api/agent/alerts/{id}/state")).json(&json!({ "action": action, "note": note }));
    for (k, v) in &headers {
        request = request.header(k, v);
    }
    let response = request.send().await.map_err(|e| format!("The server could not be reached: {e}"))?;
    let ok = response.status().is_success();
    let json: Value = response.json().await.unwrap_or(Value::Null);
    if ok {
        return Ok(json.get("data").cloned().unwrap_or(Value::Null));
    }
    Err(json.get("message").and_then(|m| m.as_str()).unwrap_or("The server refused the request").to_string())
}

/// The account's incidents: related findings grouped, with one timeline (DET-02).
#[tauri::command]
pub async fn incidents_list(state: State<'_, SharedState>) -> Result<Value, String> {
    call(state.inner(), "GET", "/api/v1/incidents", Value::Null).await
}

/// Resolve an incident: each of its open findings, through the audited workflow.
#[tauri::command]
pub async fn incident_resolve(state: State<'_, SharedState>, incident_id: String, note: Option<String>) -> Result<Value, String> {
    let id = crate::input::record_id(&incident_id, "incident")?;
    let note: String = note.unwrap_or_default().chars().filter(|c| !c.is_control()).take(900).collect();
    call(state.inner(), "POST", &format!("/api/v1/incidents/{id}/resolve"), json!({ "note": note })).await
}

/// Percent-encode a query value (RFC 3986 unreserved characters kept).
pub fn query_value(value: &str) -> String {
    value.bytes().map(|b| match b {
        b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
        _ => format!("%{b:02X}"),
    }).collect()
}

/// The evidence report for a window (DET-04): findings, incidents and evidence from a signed snapshot.
#[tauri::command]
pub async fn evidence_report(state: State<'_, SharedState>, from: String, to: String, tz: Option<String>) -> Result<Value, String> {
    for (name, value) in [("from", &from), ("to", &to)] {
        if value.is_empty() || value.len() > 40 || !value.chars().all(|c| c.is_ascii_alphanumeric() || "-:.TZ+".contains(c)) {
            return Err(format!("{name} is not a date"));
        }
    }
    let tz = tz.unwrap_or_else(|| "UTC".into());
    if tz.len() > 64 || !tz.chars().all(|c| c.is_ascii_alphanumeric() || "/_-+".contains(c)) {
        return Err("tz is not a time zone name".into());
    }
    let path = format!("/api/v1/reports/evidence?from={}&to={}&tz={}", query_value(&from), query_value(&to), query_value(&tz));
    call(state.inner(), "GET", &path, Value::Null).await
}

/// Save an incident's stored evidence, with its signed manifest, as a JSON file in Downloads.
#[tauri::command]
pub async fn incident_evidence(app: AppHandle, state: State<'_, SharedState>, incident_id: String) -> Result<Value, String> {
    let id = crate::input::record_id(&incident_id, "incident")?;
    let data = call(state.inner(), "GET", &format!("/api/v1/incidents/{id}/evidence"), Value::Null).await?;
    let items = data.get("items").and_then(|i| i.as_array()).map(|i| i.len()).unwrap_or(0);
    if items == 0 {
        return Ok(json!({ "saved": false, "items": 0, "note": data.get("note").cloned().unwrap_or(Value::Null) }));
    }
    let dir = app.path().download_dir().or_else(|_| app.path().document_dir()).map_err(|e| format!("No Downloads folder to save it in: {e}"))?;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let file = dir.join(format!("cyberforge-{id}-evidence-{}.json", crate::account_api::stamp(now)));
    std::fs::write(&file, serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?).map_err(|e| format!("The evidence could not be saved: {e}"))?;
    Ok(json!({ "saved": true, "path": file.to_string_lossy(), "items": items, "signed": data.get("signature").map(|s| !s.is_null()).unwrap_or(false) }))
}

#[cfg(test)]
mod finding_api_tests {
    use super::{exception_request, request_for};

    #[test]
    fn query_values_are_encoded() {
        assert_eq!(super::query_value("2026-10-16T21:00:00.000Z"), "2026-10-16T21%3A00%3A00.000Z");
        assert_eq!(super::query_value("Europe/London"), "Europe%2FLondon");
        assert_eq!(super::query_value("a&b=c"), "a%26b%3Dc");
    }

    #[test]
    fn an_exception_needs_a_reason_and_1_to_90_days() {
        let (path, body) = exception_request("threat_1_ab", "  our staging page  ", 30).unwrap();
        assert_eq!(path, "/api/threats/threat_1_ab/exception");
        assert_eq!(body["reason"], "our staging page");
        assert_eq!(body["expiresInDays"], 30);
        assert!(exception_request("threat_1_ab", "ok", 30).is_err());
        assert!(exception_request("threat_1_ab", "a reason", 0).is_err());
        assert!(exception_request("threat_1_ab", "a reason", 91).is_err());
        assert!(exception_request("../x", "a reason", 5).is_err());
    }

    #[test]
    fn only_listed_actions_and_plain_ids() {
        let (path, body) = request_for("threat_1791986645_ab12c", "resolve", Some("fixed\nby IT")).unwrap();
        assert_eq!(path, "/api/threats/threat_1791986645_ab12c/state");
        assert_eq!(body["action"], "resolve");
        assert_eq!(body["note"], "fixedby IT");
        assert!(request_for("t1", "delete", None).is_err());
        for id in ["../stats", "a/b", "x?y", ""] {
            assert!(request_for(id, "resolve", None).is_err(), "accepted {id:?}");
        }
    }
}
