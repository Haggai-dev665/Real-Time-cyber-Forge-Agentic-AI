//! CyberForge — AI Security Console
//!
//! Tauri desktop shell that serves the static CyberForge UI (HTML/CSS/JS in `../ui`).
//! The only piece wired to the backend is authentication: `auth_login` /
//! `auth_register` (and friends) call `https://…herokuapp.com/api/auth/*` from
//! Rust and persist the session token in the OS keychain. The frontend invokes
//! them via `window.__TAURI__.core.invoke(...)`.

mod agent;
mod auth;
mod commands;
mod http;
mod memory;
mod metrics;
mod ml;
mod policy;
mod state;
mod system;

use state::AppState;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Build and run the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = Arc::new(Mutex::new(AppState::new()));

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::auth_login,
            commands::auth_register,
            commands::auth_logout,
            commands::auth_get_user,
            commands::auth_is_authenticated,
            commands::auth_get_token,
            // Floating agent panel — real local + backend telemetry
            system::get_system_stats,
            system::detect_browsers,
            // Header IP search — resolve a website to its IP(s) via OS DNS
            system::resolve_ip,
            // Installation wizard — OS-aware profile + real PATH registration
            system::get_system_profile,
            system::get_path_status,
            system::add_to_path,
            // Real browser history → URLs to scan in real time
            system::get_browser_history,
            // Full background-collected history (all browsers, all profiles)
            system::get_collected_history,
            // One-time install gate
            system::is_installed,
            system::mark_installed,
            metrics::agent_status,
            // Agent Core + scanning (backend-connected)
            agent::scan_url,
            agent::get_active_urls,
            agent::get_last_scan,
            agent::agent_alerts,
            agent::get_threats,
            agent::auth_google,
            agent::browser_intel,
            agent::browser_intel_report,
            // Local-first vector memory
            memory::memory_save,
            memory::memory_search,
            memory::memory_list,
            memory::memory_sync,
            // ML capabilities (DeepSeek chat, BERT URL, DGA, IOC scan, AI Deep Scan)
            ml::ml_security_chat,
            ml::ml_classify_url,
            ml::ml_detect_dga,
            ml::ml_ioc_scan,
            ml::ml_url_enrich,
            ml::ml_status,
            ml::set_hf_token,
            ml::hf_token_status,
            // Security Functions — Policy Engine (what to do during a threat)
            policy::policy_meta,
            policy::policy_list,
            policy::policy_stats,
            policy::policy_response_log,
            policy::policy_create,
            policy::policy_update,
            policy::policy_delete,
            policy::policy_evaluate,
        ])
        .setup(|app| {
            // `Manager` provides `get_webview_window` (debug devtools) and
            // `state` (telemetry broadcaster below).
            use tauri::Manager;

            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
            }

            // Real-time telemetry broadcaster: ONE poller for the whole app.
            // Every 3s it pushes a single `cf-telemetry` event (system stats +
            // browsers + backend status + last scan) to every UI surface — the
            // Agent Core screen and every floating-panel iframe just listen.
            // Backend status is TTL-cached, so the backend is hit ~once per
            // cache window no matter how many surfaces are open.
            let shared = app.state::<Arc<Mutex<AppState>>>().inner().clone();
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use tauri::Emitter;
                loop {
                    let sys = crate::system::system_data(&shared).await;
                    let browsers = crate::system::browsers_data(&shared).await;
                    let status = crate::metrics::status_data(&shared).await;
                    let threats = crate::agent::threats_data(&shared).await;
                    let last_scan = {
                        let s = shared.lock().await;
                        s.last_scan.clone().unwrap_or(serde_json::Value::Null)
                    };
                    let _ = handle.emit(
                        "cf-telemetry",
                        serde_json::json!({
                            "sys": sys,
                            "browsers": browsers,
                            "status": status,
                            "threats": threats,
                            "lastScan": last_scan
                        }),
                    );
                    tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                }
            });

            // Background browser-history collector: as soon as the app opens it
            // reads the FULL history of every detected browser — across all
            // profiles, straight from the on-disk SQLite files — even when the
            // browsers are closed. The snapshot is cached in shared state (so the
            // UI loads it instantly), persisted locally to the app-config dir,
            // and announced via a `cf-history` event. It then refreshes every few
            // minutes to pick up newly visited pages. Reads run in parallel on
            // the blocking pool, so this never stalls the UI or the telemetry
            // poller above.
            let hist_state = app.state::<Arc<Mutex<AppState>>>().inner().clone();
            let hist_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use tauri::Emitter;
                // Small delay so the window mounts before the first heavy read.
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                loop {
                    let snapshot = crate::system::refresh_history(&hist_state).await;
                    crate::system::persist_history_snapshot(&hist_handle, &snapshot);
                    // Announce a lightweight summary (counts only — not every URL).
                    let _ = hist_handle.emit(
                        "cf-history",
                        serde_json::json!({
                            "count": snapshot.pointer("/data/count"),
                            "totalUnique": snapshot.pointer("/data/totalUnique"),
                            "byBrowser": snapshot.pointer("/data/byBrowser"),
                            "sources": snapshot.pointer("/data/sources"),
                            "collectedAt": snapshot.pointer("/data/collectedAt"),
                        }),
                    );
                    // Refresh cadence: often enough to stay current, rare enough
                    // to keep disk/CPU cost negligible.
                    tokio::time::sleep(std::time::Duration::from_secs(300)).await;
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the CyberForge desktop application");
}
