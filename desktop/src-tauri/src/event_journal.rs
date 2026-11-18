//! Bounded, memory-only activity journal. Survives page navigation, never logout
//! into another account. Entries contain a small redacted projection, not raw
//! service payloads, credentials or browser history.
use crate::state::AppState;
use serde_json::{json, Value};
use std::collections::VecDeque;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex, OnceLock,
};
use tauri::{Emitter, State};
type SharedState = std::sync::Arc<tokio::sync::Mutex<AppState>>;
const LIMIT: usize = 500;
const TTL_MS: u64 = 3_600_000;

#[derive(Default)]
struct Journal {
    scope: String,
    events: VecDeque<Value>,
    device: VecDeque<Value>,
}
fn journal() -> &'static Mutex<Journal> {
    static CELL: OnceLock<Mutex<Journal>> = OnceLock::new();
    CELL.get_or_init(|| Mutex::new(Journal::default()))
}
pub fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
pub fn scope(s: &AppState) -> String {
    format!(
        "{}|{}",
        s.backend_url,
        s.current_user
            .as_ref()
            .filter(|_| s.is_authenticated)
            .map(|u| u.id.as_str())
            .unwrap_or("signed-out")
    )
}
fn compact(event: &Value, source: &str) -> Value {
    let mut data = serde_json::Map::new();
    for key in [
        "type",
        "url",
        "indicator",
        "message",
        "verdict",
        "riskScore",
        "status",
        "durationMs",
        "modelCount",
        "source",
        "reason",
    ] {
        if let Some(v) = event.get("data").and_then(|d| d.get(key)) {
            if let Some(t) = v.as_str() {
                let text = if key == "url" || key == "indicator" {
                    crate::system::redact_url(t)
                } else {
                    t.to_string()
                };
                data.insert(
                    key.into(),
                    json!(text
                        .chars()
                        .filter(|c| !c.is_control())
                        .take(500)
                        .collect::<String>()),
                );
            } else if v.is_number() || v.is_boolean() {
                data.insert(key.into(), v.clone());
            }
        }
    }
    json!({"id": event["id"], "type": event["type"], "ts": event["ts"], "source": source, "data": data})
}
fn prune(events: &mut VecDeque<Value>) {
    while events.len() > LIMIT
        || events
            .front()
            .map(|e| now().saturating_sub(e["ts"].as_u64().unwrap_or(0)) > TTL_MS)
            .unwrap_or(false)
    {
        events.pop_front();
    }
}
pub fn record(scope: &str, event: &Value, source: &str) {
    let mut j = journal().lock().unwrap_or_else(|p| p.into_inner());
    if j.scope != scope {
        j.events.clear();
        j.scope = scope.into();
    }
    let entry = compact(event, source);
    if !j.events.iter().any(|e| e["id"] == entry["id"]) {
        j.events.push_back(entry);
    }
    prune(&mut j.events);
}
pub fn envelope(kind: &str, data: Value) -> Value {
    static SEQ: AtomicU64 = AtomicU64::new(0);
    json!({"id":format!("local-{}-{}", now(), SEQ.fetch_add(1,Ordering::Relaxed)),"type":kind,"ts":now(),"source":"desktop","data":data})
}
pub fn device(app: &tauri::AppHandle, kind: &str, data: Value) {
    let event = compact(&envelope(kind, data), "desktop");
    let mut j = journal().lock().unwrap_or_else(|p| p.into_inner());
    j.device.push_back(event.clone());
    prune(&mut j.device);
    drop(j);
    let _ = app.emit("cf-stream", event);
}
pub async fn publish(app: &tauri::AppHandle, state: &SharedState, kind: &str, data: Value) {
    let s = state.lock().await;
    let event = compact(&envelope(kind, data), "desktop");
    record(&scope(&s), &event, "desktop");
    let _ = app.emit("cf-stream", event);
}
#[tauri::command]
pub async fn stream_history(state: State<'_, SharedState>) -> Result<Value, String> {
    let s = state.lock().await;
    let key = scope(&s);
    let mut j = journal().lock().unwrap_or_else(|p| p.into_inner());
    if j.scope != key {
        j.events.clear();
        j.scope = key;
    }
    prune(&mut j.events);
    prune(&mut j.device);
    let mut events: Vec<Value> = j.events.iter().chain(j.device.iter()).cloned().collect();
    events.sort_by_key(|e| e["ts"].as_u64().unwrap_or(0));
    let start = events.len().saturating_sub(LIMIT);
    Ok(
        json!({"events":events[start..],"limit":LIMIT,"retentionMs":TTL_MS,"scope":"current account and this device","persisted":false}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn journal_projection_redacts_and_never_keeps_secrets() {
        let e = compact(
            &envelope(
                "scan:update",
                json!({"url":"https://a.test/?token=secret", "token":"hidden","raw":{"password":"hidden"},"verdict":"unknown"}),
            ),
            "desktop",
        );
        assert!(!e.to_string().contains("secret") && !e.to_string().contains("hidden"));
        assert_eq!(e["data"]["verdict"], "unknown");
    }
    #[test]
    fn journal_is_bounded_and_deduplicated_per_account() {
        for _ in 0..(LIMIT + 3) {
            record(
                "journal-test",
                &envelope("scan:update", json!({})),
                "backend",
            );
        }
        let e = envelope("alert:new", json!({}));
        record("journal-test", &e, "backend");
        record("journal-test", &e, "backend");
        let j = journal().lock().unwrap();
        assert_eq!(j.events.len(), LIMIT);
        drop(j);
        record(
            "other-account",
            &envelope("scan:update", json!({})),
            "backend",
        );
        assert_eq!(journal().lock().unwrap().events.len(), 1);
    }
}
