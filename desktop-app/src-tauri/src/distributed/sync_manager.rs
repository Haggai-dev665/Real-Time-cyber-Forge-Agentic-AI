// CyberForge Distributed Intelligence — Telemetry Sync Manager
// TODO 4: Serializes structured telemetry summaries and syncs to backend.
//
// ISOLATION: Does NOT modify the existing event emission system.
// Instead, it subscribes to intelligence snapshots and sends summaries.
// All network operations are async and non-blocking.

use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::distributed::node_identity;

// ──────────────────────────────────────────────
// Data Types
// ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetrySummary {
    pub node_id: String,
    pub device_fingerprint: String,
    pub timestamp: String,
    pub timestamp_ms: u64,
    pub sequence_id: u64,
    pub nonce: String,
    pub metrics: TelemetryMetrics,
    pub top_alerts: Vec<TelemetryAlert>,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryMetrics {
    pub active_sessions: u32,
    pub total_domains_visited: u32,
    pub total_alerts: u32,
    pub average_behavioral_score: f64,
    pub highest_risk_score: f64,
    pub http_downgrade_count: u32,
    pub suspicious_tld_count: u32,
    pub rapid_switch_count: u32,
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub uptime_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryAlert {
    pub alert_id: String,
    pub domain: String,
    pub risk_score: f64,
    pub reason: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub success: bool,
    pub sync_id: String,
    pub acknowledged_sequence: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub global_weights_update: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncState {
    pub last_sync_at: Option<String>,
    pub last_sync_sequence: u64,
    pub total_syncs: u64,
    pub failed_syncs: u64,
    pub retry_queue_size: usize,
    pub is_syncing: bool,
}

// ──────────────────────────────────────────────
// Internal State
// ──────────────────────────────────────────────

struct SyncManagerInternal {
    sequence_counter: u64,
    last_sync_at: Option<String>,
    total_syncs: u64,
    failed_syncs: u64,
    retry_queue: Vec<TelemetrySummary>,
    is_syncing: bool,
}

lazy_static::lazy_static! {
    static ref SYNC_MANAGER: Mutex<SyncManagerInternal> = Mutex::new(SyncManagerInternal {
        sequence_counter: 0,
        last_sync_at: None,
        total_syncs: 0,
        failed_syncs: 0,
        retry_queue: Vec::new(),
        is_syncing: false,
    });
}

const MAX_RETRY_QUEUE: usize = 50;
const MAX_TOP_ALERTS: usize = 10;

// ──────────────────────────────────────────────
// Signing & Replay Protection
// ──────────────────────────────────────────────

fn sign_telemetry(node_id: &str, sequence: u64, nonce: &str) -> String {
    let secret = node_identity::get_node_secret();
    let payload = format!("{}:{}:{}:{}", node_id, sequence, nonce, secret);
    let mut hasher = DefaultHasher::new();
    payload.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn generate_nonce() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

// ──────────────────────────────────────────────
// Telemetry Collection (reads from existing systems, never modifies them)
// ──────────────────────────────────────────────

/// Collect a telemetry summary from the current browser intelligence snapshot.
/// This reads only — it does NOT alter any existing state.
pub fn collect_telemetry_summary() -> TelemetrySummary {
    let identity = node_identity::get_node_identity();
    let snapshot = crate::system::get_intelligence_snapshot();

    let mut mgr = SYNC_MANAGER.lock().unwrap();
    mgr.sequence_counter += 1;
    let seq = mgr.sequence_counter;
    drop(mgr);

    let nonce = generate_nonce();

    // Compute metrics from snapshot (read-only access)
    let highest_risk = snapshot
        .sessions
        .iter()
        .map(|s| s.behavioral_score)
        .fold(0.0_f64, f64::max);

    let http_downgrades: u32 = snapshot.sessions.iter().map(|s| s.http_downgrade_count).sum();
    let rapid_switches: u32 = snapshot
        .sessions
        .iter()
        .filter(|s| s.rapid_switch_detected)
        .count() as u32;

    // System resource stats
    let mut sys = sysinfo::System::new();
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    let cpu_usage: f64 = sys.cpus().iter().map(|c| c.cpu_usage() as f64).sum::<f64>()
        / sys.cpus().len().max(1) as f64;
    let total_mem = sys.total_memory() as f64;
    let used_mem = sys.used_memory() as f64;
    let mem_pct = if total_mem > 0.0 {
        (used_mem / total_mem) * 100.0
    } else {
        0.0
    };

    // Top alerts by risk score (most recent, capped)
    let mut top_alerts: Vec<TelemetryAlert> = snapshot
        .alerts
        .iter()
        .rev()
        .take(MAX_TOP_ALERTS)
        .map(|a| TelemetryAlert {
            alert_id: a.alert_id.clone(),
            domain: a.domain.clone(),
            risk_score: a.risk_score,
            reason: a.reason.clone(),
            timestamp: a.timestamp.clone(),
        })
        .collect();
    top_alerts.sort_by(|a, b| b.risk_score.partial_cmp(&a.risk_score).unwrap_or(std::cmp::Ordering::Equal));

    let signature = sign_telemetry(&identity.node_id, seq, &nonce);

    TelemetrySummary {
        node_id: identity.node_id,
        device_fingerprint: identity.device_fingerprint,
        timestamp: chrono::Utc::now().to_rfc3339(),
        timestamp_ms: now_ms(),
        sequence_id: seq,
        nonce,
        metrics: TelemetryMetrics {
            active_sessions: snapshot.sessions.len() as u32,
            total_domains_visited: snapshot.total_domains_visited as u32,
            total_alerts: snapshot.total_alerts as u32,
            average_behavioral_score: snapshot.average_behavioral_score,
            highest_risk_score: highest_risk,
            http_downgrade_count: http_downgrades,
            suspicious_tld_count: 0, // Computed server-side from alerts
            rapid_switch_count: rapid_switches,
            cpu_usage: (cpu_usage * 10.0).round() / 10.0,
            memory_usage: (mem_pct * 10.0).round() / 10.0,
            uptime_secs: sysinfo::System::uptime(),
        },
        top_alerts,
        signature,
    }
}

// ──────────────────────────────────────────────
// Sync Execution (async, non-blocking)
// ──────────────────────────────────────────────

/// Send a telemetry summary to the backend.
/// Handles retry queue and failure tracking.
pub async fn sync_telemetry(
    backend_url: &str,
    auth_token: Option<&str>,
) -> Result<SyncResult, String> {
    // Check if already syncing
    {
        let mgr = SYNC_MANAGER.lock().unwrap();
        if mgr.is_syncing {
            return Err("Sync already in progress".into());
        }
    }

    {
        let mut mgr = SYNC_MANAGER.lock().unwrap();
        mgr.is_syncing = true;
    }

    let summary = collect_telemetry_summary();
    let result = send_telemetry_to_backend(backend_url, auth_token, &summary).await;

    let mut mgr = SYNC_MANAGER.lock().unwrap();
    mgr.is_syncing = false;

    match result {
        Ok(sync_result) => {
            mgr.last_sync_at = Some(chrono::Utc::now().to_rfc3339());
            mgr.total_syncs += 1;

            // Process retry queue on successful sync
            if !mgr.retry_queue.is_empty() {
                log::info!(
                    "📡 {} items in retry queue, will attempt on next sync",
                    mgr.retry_queue.len()
                );
            }

            Ok(sync_result)
        }
        Err(e) => {
            mgr.failed_syncs += 1;

            // Add to retry queue
            if mgr.retry_queue.len() < MAX_RETRY_QUEUE {
                mgr.retry_queue.push(summary);
            } else {
                // Drop oldest
                mgr.retry_queue.remove(0);
                mgr.retry_queue.push(collect_telemetry_summary());
            }

            log::warn!("⚠️ Telemetry sync failed: {}", e);
            Err(e)
        }
    }
}

async fn send_telemetry_to_backend(
    backend_url: &str,
    auth_token: Option<&str>,
    summary: &TelemetrySummary,
) -> Result<SyncResult, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client
        .post(&format!("{}/api/distributed/telemetry/sync", backend_url))
        .json(summary)
        .header("User-Agent", "cyber-forge-desktop/2.0")
        .header("X-Node-ID", &summary.node_id)
        .header("X-Telemetry-Sequence", summary.sequence_id.to_string())
        .header("X-Telemetry-Nonce", &summary.nonce)
        .header("X-Telemetry-Signature", &summary.signature);

    if let Some(token) = auth_token {
        req = req.header("Authorization", format!("Bearer {}", token));
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Telemetry sync request failed: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("Telemetry sync returned status {}", status));
    }

    resp.json::<SyncResult>()
        .await
        .map_err(|e| format!("Failed to parse sync response: {}", e))
}

/// Retry failed telemetry syncs from the queue.
pub async fn retry_failed_syncs(
    backend_url: &str,
    auth_token: Option<&str>,
) -> Vec<Result<SyncResult, String>> {
    let queue: Vec<TelemetrySummary> = {
        let mut mgr = SYNC_MANAGER.lock().unwrap();
        std::mem::take(&mut mgr.retry_queue)
    };

    let mut results = Vec::new();
    for summary in &queue {
        let result = send_telemetry_to_backend(backend_url, auth_token, summary).await;
        if let Err(ref e) = result {
            log::warn!("⚠️ Retry failed for sequence {}: {}", summary.sequence_id, e);
            // Re-add to queue
            let mut mgr = SYNC_MANAGER.lock().unwrap();
            if mgr.retry_queue.len() < MAX_RETRY_QUEUE {
                mgr.retry_queue.push(summary.clone());
            }
        }
        results.push(result);
    }
    results
}

/// Get the current sync state.
pub fn get_sync_state() -> SyncState {
    let mgr = SYNC_MANAGER.lock().unwrap();
    SyncState {
        last_sync_at: mgr.last_sync_at.clone(),
        last_sync_sequence: mgr.sequence_counter,
        total_syncs: mgr.total_syncs,
        failed_syncs: mgr.failed_syncs,
        retry_queue_size: mgr.retry_queue.len(),
        is_syncing: mgr.is_syncing,
    }
}
