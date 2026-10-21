//! The account's own data, from Settings › Privacy (SEC-07): export it, delete
//! one kind of it, or delete the account.
//!
//! One command, `account_call`, with a fixed set of operations, each exactly one
//! method and path under /api/v1/me (or the deletion receipt). A deletion scope
//! comes from a fixed list, and a receipt ID is checked for its shape before it
//! goes into the path. The export is saved as a JSON file in the Downloads
//! folder; after the account is deleted, this computer's session is cleared.

use serde_json::{json, Value};
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;

use crate::state::AppState;

type SharedState = Arc<Mutex<AppState>>;

pub const SCOPES: &[&str] = &["memory", "scans", "agents", "devices", "all"];

/// The method and path for an operation, or why it cannot be called.
pub fn route(op: &str, arg: Option<&str>) -> Result<(&'static str, String), String> {
    match op {
        "export" => Ok(("GET", "/api/v1/me/export".to_string())),
        "data_delete" => {
            let scope = arg.unwrap_or("");
            if !SCOPES.contains(&scope) {
                return Err(format!("scope must be one of: {}", SCOPES.join(", ")));
            }
            Ok(("DELETE", format!("/api/v1/me/data?scope={scope}")))
        }
        "delete_account" => Ok(("POST", "/api/v1/me/delete-account".to_string())),
        "receipt" => {
            let id = arg.unwrap_or("");
            let shaped = id.len() == 28
                && id.starts_with("del_")
                && id[4..].chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
            if !shaped {
                return Err("not a deletion receipt ID".into());
            }
            Ok(("GET", format!("/api/v1/account-deletions/{id}")))
        }
        _ => Err(format!("unknown account operation: {op}")),
    }
}

/// `YYYY-MM-DD-HHMMSS` (UTC) for a Unix time, for the export's file name.
pub fn stamp(unix: u64) -> String {
    let days = (unix / 86_400) as i64;
    let secs = unix % 86_400;
    // days since 1970-01-01 to a civil date (Howard Hinnant's algorithm)
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + if month <= 2 { 1 } else { 0 };
    format!("{year:04}-{month:02}-{day:02}-{:02}{:02}{:02}", secs / 3600, secs % 3600 / 60, secs % 60)
}

/// Records per store in an export, for the summary shown after saving.
pub fn store_counts(export: &Value) -> Value {
    let mut counts = serde_json::Map::new();
    if let Some(stores) = export.get("stores").and_then(|s| s.as_object()) {
        for (name, store) in stores {
            let n = store.get("records").and_then(|r| r.as_array()).map(|r| r.len()).unwrap_or(0);
            counts.insert(name.clone(), json!(n));
        }
    }
    Value::Object(counts)
}

#[tauri::command]
pub async fn account_call(
    app: AppHandle,
    state: State<'_, SharedState>,
    op: String,
    arg: Option<String>,
    body: Option<Value>,
) -> Result<Value, String> {
    let (method, path) = route(&op, arg.as_deref())?;
    let (base, headers, signed_in) = {
        let s = state.lock().await;
        (s.backend_url.clone(), s.auth_headers(), s.is_authenticated)
    };
    if op != "receipt" && !signed_in {
        return Err("Sign in first.".into());
    }
    let client = crate::http::client();
    let url = format!("{base}{path}");
    let mut request = match method {
        "GET" => client.get(url),
        "DELETE" => client.delete(url),
        _ => client.post(url),
    };
    if op != "receipt" {
        for (k, v) in &headers {
            request = request.header(k, v);
        }
    }
    if op == "delete_account" {
        let confirm = body.as_ref().and_then(|b| b.get("confirm")).and_then(|c| c.as_str()).unwrap_or("");
        request = request.json(&json!({ "confirm": confirm }));
    }
    let response = request.send().await.map_err(|e| format!("The server could not be reached: {e}"))?;
    let ok = response.status().is_success();
    let json: Value = response.json().await.unwrap_or(Value::Null);
    if !ok {
        let message = json.get("message").and_then(|m| m.as_str()).unwrap_or("The server refused the request");
        let code = json.get("code").and_then(|c| c.as_str()).unwrap_or("");
        return Err(if code.is_empty() { message.to_string() } else { format!("{message} ({code})") });
    }
    let data = json.get("data").cloned().unwrap_or(Value::Null);

    match op.as_str() {
        "export" => {
            let dir = app
                .path()
                .download_dir()
                .or_else(|_| app.path().document_dir())
                .map_err(|e| format!("No Downloads folder to save the export in: {e}"))?;
            let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
            let file = dir.join(format!("cyberforge-export-{}.json", stamp(now)));
            let text = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
            std::fs::write(&file, text).map_err(|e| format!("The export could not be saved: {e}"))?;
            Ok(json!({ "path": file.to_string_lossy(), "counts": store_counts(&data) }))
        }
        "delete_account" => {
            // the account is gone: so is this computer's session for it
            if data.get("state").and_then(|s| s.as_str()) == Some("completed") {
                state.lock().await.clear_auth();
                let _ = crate::auth::delete_token();
            }
            Ok(data)
        }
        _ => Ok(data),
    }
}

#[cfg(test)]
mod account_api_tests {
    use super::{route, stamp, store_counts};
    use serde_json::json;

    #[test]
    fn operations_map_to_one_method_and_path_each() {
        assert_eq!(route("export", None).unwrap(), ("GET", "/api/v1/me/export".to_string()));
        assert_eq!(route("data_delete", Some("memory")).unwrap(), ("DELETE", "/api/v1/me/data?scope=memory".to_string()));
        assert_eq!(route("delete_account", None).unwrap(), ("POST", "/api/v1/me/delete-account".to_string()));
        let id = "del_abcdefghijklmnopqrstuvw_";
        assert_eq!(route("receipt", Some(id)).unwrap().1, format!("/api/v1/account-deletions/{id}"));
    }

    #[test]
    fn nothing_outside_the_table_and_no_path_tricks() {
        assert!(route("delete_everything", None).is_err());
        for scope in ["", "everything", "all&x=1", "memory/../../auth"] {
            assert!(route("data_delete", Some(scope)).is_err(), "accepted {scope:?}");
        }
        for id in ["", "del_short", "../auth/logout", "del_abcdefghijklmnopqrstu/w_", "xyz_abcdefghijklmnopqrstuvw_"] {
            assert!(route("receipt", Some(id)).is_err(), "accepted {id:?}");
        }
    }

    #[test]
    fn the_file_name_carries_the_utc_time() {
        assert_eq!(stamp(0), "1970-01-01-000000");
        assert_eq!(stamp(1_791_986_645), "2026-10-14-140405");
        assert_eq!(stamp(951_782_400), "2000-02-29-000000");
    }

    #[test]
    fn the_summary_counts_records_per_store() {
        let export = json!({ "stores": { "agents": { "records": [1, 2] }, "devices": { "error": "export failed" } } });
        assert_eq!(store_counts(&export), json!({ "agents": 2, "devices": 0 }));
    }
}
