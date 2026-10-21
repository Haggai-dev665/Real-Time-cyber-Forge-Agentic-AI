//! CyberForge — AI Security Console
//!
//! Tauri desktop shell that serves the static CyberForge UI (HTML/CSS/JS in `../ui`).
//! The only piece wired to the backend is authentication: `auth_login` /
//! `auth_register` (and friends) call `https://…herokuapp.com/api/auth/*` from
//! Rust and persist the session token in the OS keychain. The frontend invokes
//! them via `window.__TAURI__.core.invoke(...)`.

mod agent;
mod account_api;
mod finding_api;
mod oauth;
mod agents_api;
mod auth;
mod blocking;
mod commands;
mod device;
mod http;
mod input;
mod memory;
mod integrations;
mod outbox;
mod ownership;
mod session_renewal;
mod metrics;
mod ml;
mod console;
mod policy;
mod privacy;
mod state;
mod stream;
mod system;
#[cfg(test)]
mod acl_tests;

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
            commands::credential_storage_status,
            stream::stream_status,
            commands::get_backend_url,
            integrations::cli_status,
            integrations::mcp_grants,
            integrations::mcp_grant_create,
            integrations::mcp_grant_revoke,
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
            agent::get_pending_threat,
            agent::get_active_urls,
            agent::get_last_scan,
            agent::agent_alerts,
            agent::get_threats,
            agent::auth_google,
            agent::browser_intel,
            agent::browser_intel_report,
            // Threat Globe — live AlienVault OTX threat-intel pulses
            agent::otx_fetch,
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
            console::console_snapshot,
            ml::set_hf_token,
            ml::hf_token_status,
            ml::hf_token_get,
            // Security Functions — Policy Engine (what to do during a threat)
            policy::policy_meta,
            policy::policy_list,
            policy::policy_stats,
            policy::policy_response_log,
            policy::policy_create,
            policy::policy_update,
            policy::policy_delete,
            policy::policy_evaluate,
            // Site blocking (hosts file) + protection (assistant Block/Protect)
            blocking::block_site,
            blocking::unblock_site,
            blocking::list_blocked,
            blocking::protect_site,
            blocking::unprotect_site,
            blocking::list_protected,
            blocking::allow_site,
            blocking::unallow_site,
            blocking::list_allowed,
            blocking::public_ip,
            // This computer as a device of the workspace (DEV-01/02)
            device::device_status,
            device::device_enroll_this,
            device::device_claim_code,
            device::device_enrollment_create,
            device::devices_list,
            device::device_approve,
            device::device_rename,
            device::device_revoke,
            device::device_heartbeat,
            device::device_rotate_key,
            device::device_command_send,
            device::device_commands_list,
            // Agents page (AGT-02/04/05/07)
            agents_api::agents_call,
            account_api::account_call,
            finding_api::finding_state,
            finding_api::finding_exception,
            finding_api::incidents_list,
            finding_api::incident_resolve,
            finding_api::alert_state,
            finding_api::incident_evidence,
            finding_api::evidence_report,
            // What the app may collect and send (SEC-07)
            privacy::privacy_get,
            privacy::privacy_set,
            privacy::privacy_clear_history,
            privacy::privacy_clear_memory,
        ])
        .setup(|app| {
            // `Manager` provides `get_webview_window` (debug devtools) and
            // `state` (telemetry broadcaster below).
            use tauri::Manager;

            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
            }

            // Prepare the per-user data directory + crucial editable files so
            // everything the app needs exists right after installation
            // (app-config dir, hf_config.json template, README). Idempotent.
            crate::system::prepare_filesystem(&app.handle());

            // One owner per user of this computer's state (ownership.rs). Only the
            // owner runs the device loop: two would reuse device sequence numbers.
            let ownership = crate::ownership::claim();
            eprintln!("CyberForge: local state owner: {:?}", ownership);

            // Signed device heartbeats, once this computer is enrolled (device.rs).
            let device_state = app.state::<Arc<Mutex<AppState>>>().inner().clone();
            if crate::ownership::is_owner_or_unenforced() {
                crate::device::start_heartbeats(device_state);
            } else {
                crate::ownership::take_over_when_free(move || {
                    // Read what the previous owner saved before writing anything.
                    crate::memory::reload_from_disk();
                    crate::device::start_heartbeats(device_state);
                });
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

            // The live feed: one connection for the whole app, held here and
            // forwarded to every window as `cf-stream` (see stream.rs). A page
            // cannot open it itself; the content security policy forbids it.
            crate::stream::start(
                app.handle().clone(),
                app.state::<Arc<Mutex<AppState>>>().inner().clone(),
            );

            // Renew the 24-hour session before it expires (session_renewal.rs).
            crate::session_renewal::start(app.state::<Arc<Mutex<AppState>>>().inner().clone());

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
