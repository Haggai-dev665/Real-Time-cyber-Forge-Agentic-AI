//! The Agents page's calls to the backend (AGT-02, AGT-04, AGT-05, AGT-07).
//!
//! One command, `agents_call`, with a fixed set of operations. Each operation
//! is exactly one method and path under /api/v1; an ID is checked as a record
//! ID before it goes into the path, and the body is passed as JSON for the
//! backend to validate. Nothing outside this table can be called through it.

use serde_json::Value;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

use crate::state::AppState;

type SharedState = Arc<Mutex<AppState>>;

/// (operation, method, path with `{id}`, needs an ID, sends a body)
const OPERATIONS: &[(&str, &str, &str, bool, bool)] = &[
    ("templates", "GET", "/api/v1/agent-templates", false, false),
    ("list", "GET", "/api/v1/agents", false, false),
    ("get", "GET", "/api/v1/agents/{id}", true, false),
    ("create", "POST", "/api/v1/agents", false, true),
    ("update", "PATCH", "/api/v1/agents/{id}", true, true),
    ("validate", "POST", "/api/v1/agents/{id}/validate", true, false),
    ("activate", "POST", "/api/v1/agents/{id}/activate", true, false),
    ("pause", "POST", "/api/v1/agents/{id}/pause", true, false),
    ("resume", "POST", "/api/v1/agents/{id}/resume", true, false),
    ("archive", "POST", "/api/v1/agents/{id}/archive", true, false),
    ("clone", "POST", "/api/v1/agents/{id}/clone", true, true),
    ("run", "POST", "/api/v1/agents/{id}/runs", true, true),
    ("runs", "GET", "/api/v1/agents/{id}/runs?limit=20", true, false),
    ("run_get", "GET", "/api/v1/runs/{id}", true, false),
    ("run_cancel", "POST", "/api/v1/runs/{id}/cancel", true, false),
    ("run_retry", "POST", "/api/v1/runs/{id}/retry", true, true),
    ("run_search", "GET", "/api/v1/runs", false, false),
    ("actions", "GET", "/api/v1/actions?limit=50", false, false),
    ("approve", "POST", "/api/v1/actions/{id}/approve", true, false),
    ("reject", "POST", "/api/v1/actions/{id}/reject", true, false),
    ("pause_all", "POST", "/api/v1/agents/pause-all", false, false),
];

/// The method and path for an operation, or why it cannot be called.
pub fn route(op: &str, id: Option<&str>) -> Result<(&'static str, String, bool), String> {
    let (_, method, path, needs_id, sends_body) =
        OPERATIONS.iter().find(|(name, ..)| *name == op).ok_or_else(|| format!("unknown agents operation: {op}"))?;
    let path = if *needs_id {
        let id = crate::input::record_id(id.unwrap_or(""), "id")?;
        path.replace("{id}", &id)
    } else {
        path.to_string()
    };
    Ok((method, path, *sends_body))
}

#[tauri::command]
pub async fn agents_call(state: State<'_, SharedState>, op: String, id: Option<String>, body: Option<Value>) -> Result<Value, String> {
    let (method, path, sends_body) = route(&op, id.as_deref())?;
    let (base, headers, signed_in) = {
        let s = state.lock().await;
        (s.backend_url.clone(), s.auth_headers(), s.is_authenticated)
    };
    if !signed_in {
        return Err("Sign in first.".into());
    }
    let client = crate::http::client();
    let url = format!("{base}{path}");
    let mut request = match method {
        "GET" => client.get(url),
        "PATCH" => client.patch(url),
        _ => client.post(url),
    };
    for (k, v) in &headers {
        request = request.header(k, v);
    }
    if sends_body {
        request = request.json(&body.unwrap_or(Value::Object(Default::default())));
    } else if op == "run_search" {
        // the search terms go in the query string, each bounded; nothing else is passed
        request = request.query(&search_query(body.as_ref()));
    }
    let response = request.send().await.map_err(|e| format!("The server could not be reached: {e}"))?;
    let ok = response.status().is_success();
    let json: Value = response.json().await.unwrap_or(Value::Null);
    if ok {
        return Ok(json.get("data").cloned().unwrap_or(Value::Null));
    }
    let message = json.get("message").and_then(|m| m.as_str()).unwrap_or("The server refused the request");
    let code = json.get("code").and_then(|c| c.as_str()).unwrap_or("");
    let errors = json.get("errors").and_then(|e| e.as_array()).map(|e| e.iter().filter_map(|x| x.as_str()).collect::<Vec<_>>().join("; ")).unwrap_or_default();
    Err([message.to_string(), if code.is_empty() { String::new() } else { format!("({code})") }, errors].into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join(" "))
}

/// The run-search terms (q, deviceId, state, agentId), as text of at most 200 characters each.
pub fn search_query(body: Option<&Value>) -> Vec<(String, String)> {
    let mut out = Vec::new();
    if let Some(map) = body.and_then(|b| b.as_object()) {
        for key in ["q", "deviceId", "state", "agentId"] {
            if let Some(v) = map.get(key).and_then(|v| v.as_str()) {
                let v: String = v.chars().filter(|c| !c.is_control()).take(200).collect();
                if !v.is_empty() {
                    out.push((key.to_string(), v));
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod agents_api_tests {
    use super::{route, search_query};
    use serde_json::json;

    #[test]
    fn run_search_passes_only_its_own_terms() {
        let q = search_query(Some(&json!({ "q": "shop.example", "deviceId": "dev-1", "limit": "9", "workspaceId": "other", "state": 5 })));
        assert_eq!(q, vec![("q".to_string(), "shop.example".to_string()), ("deviceId".to_string(), "dev-1".to_string())]);
        assert_eq!(search_query(Some(&json!({ "q": "x".repeat(500) })))[0].1.len(), 200);
        assert!(search_query(None).is_empty());
        assert_eq!(route("run_retry", Some("3f6c1d2a-9b7e-4c1a-8f00-1234567890ab")).unwrap(), ("POST", "/api/v1/runs/3f6c1d2a-9b7e-4c1a-8f00-1234567890ab/retry".to_string(), true));
    }

    #[test]
    fn operations_map_to_one_method_and_path_each() {
        assert_eq!(route("list", None).unwrap(), ("GET", "/api/v1/agents".to_string(), false));
        assert_eq!(route("approve", Some("3f6c1d2a-9b7e-4c1a-8f00-1234567890ab")).unwrap().1, "/api/v1/actions/3f6c1d2a-9b7e-4c1a-8f00-1234567890ab/approve");
        assert_eq!(route("update", Some("abc")).unwrap(), ("PATCH", "/api/v1/agents/abc".to_string(), true));
    }

    #[test]
    fn nothing_outside_the_table_and_no_path_tricks() {
        assert!(route("delete_everything", None).is_err());
        assert!(route("get", None).is_err());
        for id in ["../auth/logout", "x?y=1", "a/b", ""] {
            assert!(route("get", Some(id)).is_err(), "accepted {id:?}");
        }
    }
}
