//! Read-only console snapshots, cached per authenticated session in native memory.
use serde_json::{json, Value};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::State;
use tokio::sync::Mutex;
use crate::state::AppState;
type SharedState = Arc<Mutex<AppState>>;
#[derive(Default)]
struct Cache { key: String, summary: Option<(Instant, Value)>, ml: Option<(Instant, Value)> }
static CACHE: OnceLock<Mutex<Cache>> = OnceLock::new();
async fn read(base: &str, path: &str, headers: &[(String, String)]) -> Value {
    let started = Instant::now();
    let mut req = crate::http::client().get(format!("{base}{path}")).timeout(Duration::from_secs(12));
    for (k, v) in headers { req = req.header(k, v); }
    match req.send().await {
        Ok(response) => {
            let status = response.status().as_u16();
            let body = response.json::<Value>().await.unwrap_or(Value::Null);
            json!({"status": status, "body": body, "durationMs": started.elapsed().as_millis() as u64,
                "fetchedAt": SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64})
        },
        Err(_) => json!({"status": null, "body": null, "reason": "Request unavailable or timed out", "durationMs": started.elapsed().as_millis() as u64})
    }
}
#[tauri::command]
pub async fn console_snapshot(state: State<'_, SharedState>, refresh: Option<bool>) -> Result<Value, String> {
    let (base, headers, signed_in) = { let s=state.lock().await; (s.backend_url.clone(), s.auth_headers(), s.is_authenticated) };
    let mut cache = CACHE.get_or_init(|| Mutex::new(Cache::default())).lock().await;
    if !signed_in { *cache=Cache::default(); return Err("Sign in to read console status".into()); }
    // Private native cache key never leaves this process or appears in diagnostics.
    let key = format!("{}{:?}", base, headers);
    if cache.key != key { *cache=Cache { key: key.clone(), ..Cache::default() }; }
    let force = refresh.unwrap_or(false);
    let due = |slot: &Option<(Instant,Value)>, ttl| slot.as_ref().map(|(t,_)| t.elapsed() >= Duration::from_secs(if force {5} else {ttl})).unwrap_or(true);
    let summary_due=due(&cache.summary,30); let ml_due=due(&cache.ml,60);
    let (summary, ml) = tokio::join!(
        async { if summary_due {Some(read(&base,"/api/v1/console/summary",&headers).await)}else{None} },
        async { if ml_due {Some(read(&base,"/api/v1/ml/capabilities",&headers).await)}else{None} }
    );
    // Do not deliver a snapshot if sign-out or an account change occurred in flight.
    { let s=state.lock().await;
      if !s.is_authenticated || s.backend_url!=base || s.auth_headers()!=headers { *cache=Cache::default(); return Err("Session changed".into()); }
    }
    if let Some(v)=summary {cache.summary=Some((Instant::now(),v));}
    if let Some(v)=ml {cache.ml=Some((Instant::now(),v));}
    Ok(json!({"version": env!("CARGO_PKG_VERSION"), "summary": cache.summary.as_ref().map(|(_,v)|v), "ml": cache.ml.as_ref().map(|(_,v)|v)}))
}
