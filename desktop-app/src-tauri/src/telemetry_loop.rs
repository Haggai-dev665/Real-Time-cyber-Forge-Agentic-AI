// CyberForge Real-Time Telemetry Loop
//
// Runs two concurrent background tasks inside the Tauri async runtime:
//
//   1. URL-poll task  — queries all running browsers every `url_interval_ms` ms
//                       and emits `cf:url-poll` when a URL changes.
//   2. System task    — collects OS telemetry every `sys_interval_ms` ms
//                       and emits `cf:system-telemetry`.
//
// Both tasks also pipe through the Browser Intelligence Engine and emit
// `cf:behavioral-alert` whenever a new behavioral alert is generated.
//
// ADDITIVE: Does NOT modify any existing Tauri command or event.
// The loop is started once during app setup via `start_background_loops()`.

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

// ──────────────────────────────────────────────────────────────────────────
// Loop configuration
// ──────────────────────────────────────────────────────────────────────────

/// Tuneable parameters for both background loops.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryLoopConfig {
    /// How often to poll browser URLs (milliseconds). Default: 3 000 ms.
    pub url_interval_ms: u64,
    /// How often to collect system telemetry (milliseconds). Default: 5 000 ms.
    pub sys_interval_ms: u64,
    /// If true the URL loop skips identical consecutive URLs (deduplication).
    pub url_dedup: bool,
}

impl Default for TelemetryLoopConfig {
    fn default() -> Self {
        Self {
            url_interval_ms: 3_000,
            sys_interval_ms: 5_000,
            url_dedup: true,
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Global running flag
// ──────────────────────────────────────────────────────────────────────────

lazy_static::lazy_static! {
    static ref LOOP_RUNNING: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
}

/// Returns true if the background loops are currently active.
pub fn is_running() -> bool {
    LOOP_RUNNING.load(Ordering::Relaxed)
}

/// Status payload returned to the renderer.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LoopStatus {
    pub running: bool,
    pub config: TelemetryLoopConfig,
}

// ──────────────────────────────────────────────────────────────────────────
// Payload types emitted as Tauri events
// ──────────────────────────────────────────────────────────────────────────

/// Emitted as `cf:url-poll` whenever the active browser URL changes (or on
/// every tick if dedup is disabled).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UrlPollPayload {
    /// ISO-8601 UTC timestamp of this poll
    pub poll_at: String,
    /// All active tabs across all running browsers
    pub tabs: Vec<BrowserTabInfo>,
    /// Whether this payload contains at least one URL change vs the last tick
    pub has_change: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserTabInfo {
    pub browser: String,
    pub browser_key: String,
    pub url: String,
    pub title: String,
    pub timestamp: String,
}

/// Emitted as `cf:behavioral-alert` whenever the intelligence engine fires.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BehavioralAlertPayload {
    pub source: String, // "url-poll" or "system"
    pub alerts: Vec<serde_json::Value>,
    pub emitted_at: String,
}

// ──────────────────────────────────────────────────────────────────────────
// Entry point
// ──────────────────────────────────────────────────────────────────────────

/// Spawns both background loops. Safe to call multiple times — will only
/// start if not already running.  Returns `true` if loops were started,
/// `false` if already active.
pub fn start_background_loops(app: AppHandle, config: TelemetryLoopConfig) -> bool {
    // CAS: only one caller wins
    if LOOP_RUNNING
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::Relaxed)
        .is_err()
    {
        return false;
    }

    let cfg_url = config.clone();
    let cfg_sys = config.clone();
    let running_url = Arc::clone(&LOOP_RUNNING);
    let running_sys = Arc::clone(&LOOP_RUNNING);
    let app_url = app.clone();
    let app_sys = app;

    // ── URL-poll task ────────────────────────────────────────────────────
    tauri::async_runtime::spawn(async move {
        let interval = std::time::Duration::from_millis(cfg_url.url_interval_ms);
        // Per-browser key → last seen URL for deduplication
        let mut last_urls: std::collections::HashMap<String, String> = std::collections::HashMap::new();

        log::info!(
            "[telemetry-loop] URL-poll task started (interval={}ms, dedup={})",
            cfg_url.url_interval_ms,
            cfg_url.url_dedup
        );

        while running_url.load(Ordering::Relaxed) {
            let result = tokio::task::spawn_blocking(|| {
                crate::system::get_active_browser_urls()
            })
            .await;

            if let Ok(url_result) = result {
                let tabs: Vec<BrowserTabInfo> = url_result
                    .tabs
                    .iter()
                    .map(|t| BrowserTabInfo {
                        browser: t.browser.clone(),
                        browser_key: t.browser_key.clone(),
                        url: t.url.clone(),
                        title: t.title.clone(),
                        timestamp: t.timestamp.clone(),
                    })
                    .collect();

                // Determine if anything changed
                let mut has_change = false;
                if cfg_url.url_dedup {
                    for tab in &tabs {
                        let prev = last_urls.get(&tab.browser_key).cloned().unwrap_or_default();
                        if prev != tab.url {
                            has_change = true;
                            last_urls.insert(tab.browser_key.clone(), tab.url.clone());
                        }
                    }
                } else {
                    has_change = !tabs.is_empty();
                }

                // Always emit the event (renderer decides what to render)
                let payload = UrlPollPayload {
                    poll_at: chrono::Utc::now().to_rfc3339(),
                    tabs: tabs.clone(),
                    has_change,
                };
                if let Err(e) = app_url.emit("cf:url-poll", &payload) {
                    log::debug!("[telemetry-loop] emit cf:url-poll failed: {}", e);
                }

                // Feed changed URLs into the behavioral intelligence engine
                if has_change {
                    let alerts_result = tokio::task::spawn_blocking(move || {
                        let mut all_alerts: Vec<serde_json::Value> = vec![];
                        for tab in &tabs {
                            // Only feed changed tabs (or all if dedup off)
                            let alerts = crate::system::process_url_observation(
                                &tab.browser,
                                &tab.browser_key,
                                &tab.url,
                                &tab.title,
                            );
                            for alert in alerts {
                                if let Ok(v) = serde_json::to_value(&alert) {
                                    all_alerts.push(v);
                                }
                            }
                        }
                        all_alerts
                    })
                    .await;

                    if let Ok(alerts) = alerts_result {
                        if !alerts.is_empty() {
                            let alert_payload = BehavioralAlertPayload {
                                source: "url-poll".to_string(),
                                alerts,
                                emitted_at: chrono::Utc::now().to_rfc3339(),
                            };
                            if let Err(e) = app_url.emit("cf:behavioral-alert", &alert_payload) {
                                log::debug!("[telemetry-loop] emit cf:behavioral-alert failed: {}", e);
                            }
                        }
                    }
                }
            }

            tokio::time::sleep(interval).await;
        }

        log::info!("[telemetry-loop] URL-poll task stopped");
    });

    // ── System-telemetry task ────────────────────────────────────────────
    tauri::async_runtime::spawn(async move {
        let interval = std::time::Duration::from_millis(cfg_sys.sys_interval_ms);

        log::info!(
            "[telemetry-loop] System-telemetry task started (interval={}ms)",
            cfg_sys.sys_interval_ms
        );

        while running_sys.load(Ordering::Relaxed) {
            let tele = tokio::task::spawn_blocking(|| {
                crate::system::collect_system_telemetry()
            })
            .await;

            if let Ok(telemetry) = tele {
                if let Ok(payload) = serde_json::to_value(&telemetry) {
                    if let Err(e) = app_sys.emit("cf:system-telemetry", &payload) {
                        log::debug!("[telemetry-loop] emit cf:system-telemetry failed: {}", e);
                    }
                }
            }

            tokio::time::sleep(interval).await;
        }

        log::info!("[telemetry-loop] System-telemetry task stopped");
    });

    true
}

/// Signal both background loops to stop.  They will exit after finishing
/// their current sleep/work cycle.
pub fn stop_background_loops() {
    LOOP_RUNNING.store(false, Ordering::SeqCst);
}
