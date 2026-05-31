//! Local system telemetry for the floating agent panel — real data via `sysinfo`.
//! CPU / memory / uptime + installed/running browser detection. Results are TTL
//! cached in shared state so the many UI surfaces (Agent Core + every floating
//! panel iframe) share one computation instead of each recomputing.

use crate::state::AppState;
use serde_json::{json, Value};
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, Instant};
use sysinfo::System;
use tauri::State;
use tokio::sync::Mutex;

type SharedState = Arc<Mutex<AppState>>;

const SYS_TTL: Duration = Duration::from_millis(2500);
const BROWSERS_TTL: Duration = Duration::from_secs(15);

fn compute_system_stats() -> Value {
    let mut sys = System::new_all();
    sys.refresh_all();
    // sysinfo needs a second sample (after a short delay) for a real CPU figure.
    std::thread::sleep(Duration::from_millis(200));
    sys.refresh_all();

    let total_mem = sys.total_memory() as f64;
    let used_mem = sys.used_memory() as f64;
    let mem_percent = if total_mem > 0.0 { used_mem / total_mem * 100.0 } else { 0.0 };
    let cpu_usage: f64 = sys.cpus().iter().map(|c| c.cpu_usage() as f64).sum::<f64>()
        / sys.cpus().len().max(1) as f64;

    json!({
        "success": true,
        "data": {
            "cpu": (cpu_usage * 10.0).round() / 10.0,
            "memory": (mem_percent * 10.0).round() / 10.0,
            "uptime": System::uptime(),
            "cpu_count": sys.cpus().len(),
            "hostname": System::host_name().unwrap_or_else(|| "Unknown".into()),
        }
    })
}

fn compute_browsers() -> Value {
    let mut sys = System::new_all();
    sys.refresh_all();

    let running: Vec<String> = sys
        .processes()
        .values()
        .map(|p| p.name().to_string_lossy().to_lowercase())
        .collect();
    let is_running = |needles: &[&str]| -> bool {
        needles.iter().any(|n| running.iter().any(|p| p.contains(*n)))
    };

    let defs: [(&str, &str, &str, &[&str]); 7] = [
        ("chrome", "Google Chrome", "/Applications/Google Chrome.app", &["google chrome"]),
        ("firefox", "Firefox", "/Applications/Firefox.app", &["firefox"]),
        ("safari", "Safari", "/Applications/Safari.app", &["safari"]),
        ("edge", "Microsoft Edge", "/Applications/Microsoft Edge.app", &["microsoft edge", "msedge"]),
        ("brave", "Brave", "/Applications/Brave Browser.app", &["brave"]),
        ("opera", "Opera", "/Applications/Opera.app", &["opera"]),
        ("arc", "Arc", "/Applications/Arc.app", &["arc"]),
    ];

    let mut browsers = Vec::new();
    let mut installed_count = 0u32;
    let mut running_count = 0u32;

    for &(key, name, path, needles) in defs.iter() {
        let run = is_running(needles);
        let installed = Path::new(path).exists() || run;
        if !installed {
            continue;
        }
        installed_count += 1;
        if run {
            running_count += 1;
        }
        browsers.push(json!({
            "key": key,
            "name": name,
            "isInstalled": true,
            "isRunning": run,
            "version": ""
        }));
    }

    json!({
        "success": true,
        "data": { "browsers": browsers, "installed": installed_count, "running": running_count }
    })
}

/// Cached CPU/memory/uptime snapshot. Shared by the command and the broadcaster.
pub async fn system_data(state: &SharedState) -> Value {
    {
        let s = state.lock().await;
        if let Some((t, v)) = &s.sys_cache {
            if t.elapsed() < SYS_TTL {
                return v.clone();
            }
        }
    }
    let result = compute_system_stats();
    {
        let mut s = state.lock().await;
        s.sys_cache = Some((Instant::now(), result.clone()));
    }
    result
}

/// Cached browser detection.
pub async fn browsers_data(state: &SharedState) -> Value {
    {
        let s = state.lock().await;
        if let Some((t, v)) = &s.browsers_cache {
            if t.elapsed() < BROWSERS_TTL {
                return v.clone();
            }
        }
    }
    let result = compute_browsers();
    {
        let mut s = state.lock().await;
        s.browsers_cache = Some((Instant::now(), result.clone()));
    }
    result
}

#[tauri::command]
pub async fn get_system_stats(state: State<'_, SharedState>) -> Result<Value, String> {
    Ok(system_data(state.inner()).await)
}

#[tauri::command]
pub async fn detect_browsers(state: State<'_, SharedState>) -> Result<Value, String> {
    Ok(browsers_data(state.inner()).await)
}
