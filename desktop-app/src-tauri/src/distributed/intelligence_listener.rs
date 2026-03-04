// CyberForge Distributed Intelligence — Intelligence Listener
// TODO 4: Subscribes to realtime intelligence broadcasts from the cloud.
//
// ISOLATION: Does NOT modify the existing event loop or WebSocket handler.
// Hooks in additively by providing its own processing pipeline.
// Updates the global risk weight multiplier table without touching base scoring.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

// ──────────────────────────────────────────────
// Data Types
// ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntelligenceBroadcast {
    pub broadcast_id: String,
    pub broadcast_type: BroadcastType,
    pub source_node_count: u32,
    pub timestamp: String,
    pub payload: BroadcastPayload,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BroadcastType {
    WeightUpdate,
    ThreatAlert,
    NodeStatus,
    CorrelationResult,
    GlobalMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weight_updates: Option<HashMap<String, f64>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub threat_domains: Option<Vec<ThreatDomainBroadcast>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_statuses: Option<Vec<NodeStatusEntry>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation: Option<CorrelationResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub global_metrics: Option<GlobalMetricsSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreatDomainBroadcast {
    pub domain: String,
    pub risk_score: f64,
    pub seen_by_nodes: u32,
    pub first_seen: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeStatusEntry {
    pub node_id: String,
    pub hostname: String,
    pub is_online: bool,
    pub last_seen: String,
    pub alert_count: u32,
    pub avg_risk_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrelationResult {
    pub correlation_id: String,
    pub pattern_type: String,
    pub affected_nodes: Vec<String>,
    pub affected_domains: Vec<String>,
    pub severity: f64,
    pub description: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalMetricsSnapshot {
    pub total_nodes: u32,
    pub active_nodes: u32,
    pub total_alerts_24h: u32,
    pub avg_risk_score: f64,
    pub top_threat_domains: Vec<ThreatDomainBroadcast>,
    pub correlation_count_24h: u32,
    pub timestamp: String,
}

// ──────────────────────────────────────────────
// Global Risk Weight Multiplier Table
// ──────────────────────────────────────────────
//
// This is the dynamic risk adjustment layer.
// Existing scoring: base_score (from browser_intelligence.rs)
// This adds:       adjusted_score = base_score * global_multiplier
//
// CRITICAL: The base scoring formula is NEVER modified.
// This table only provides multipliers that wrap around the existing score.

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskWeightTable {
    /// Domain-specific multipliers (e.g., "example.com" → 1.5 means 50% risk increase)
    pub domain_multipliers: HashMap<String, f64>,
    /// TLD-based multipliers (e.g., ".xyz" → 1.3)
    pub tld_multipliers: HashMap<String, f64>,
    /// Global baseline multiplier (default 1.0 = no change)
    pub global_multiplier: f64,
    /// Last updated timestamp
    pub last_updated: String,
    /// Source broadcast ID
    pub source_broadcast_id: String,
}

impl Default for RiskWeightTable {
    fn default() -> Self {
        Self {
            domain_multipliers: HashMap::new(),
            tld_multipliers: HashMap::new(),
            global_multiplier: 1.0,
            last_updated: chrono::Utc::now().to_rfc3339(),
            source_broadcast_id: String::new(),
        }
    }
}

// ──────────────────────────────────────────────
// Listener State
// ──────────────────────────────────────────────

struct ListenerState {
    weight_table: RiskWeightTable,
    received_broadcasts: Vec<IntelligenceBroadcast>,
    latest_node_statuses: Vec<NodeStatusEntry>,
    latest_global_metrics: Option<GlobalMetricsSnapshot>,
    latest_correlations: Vec<CorrelationResult>,
    processed_broadcast_ids: Vec<String>,
}

lazy_static::lazy_static! {
    static ref LISTENER_STATE: Mutex<ListenerState> = Mutex::new(ListenerState {
        weight_table: RiskWeightTable::default(),
        received_broadcasts: Vec::new(),
        latest_node_statuses: Vec::new(),
        latest_global_metrics: None,
        latest_correlations: Vec::new(),
        processed_broadcast_ids: Vec::new(),
    });
}

const MAX_BROADCAST_HISTORY: usize = 100;
const MAX_CORRELATION_HISTORY: usize = 50;
const MAX_PROCESSED_IDS: usize = 500;

// ──────────────────────────────────────────────
// Broadcast Processing
// ──────────────────────────────────────────────

/// Process an incoming intelligence broadcast.
/// This is the main entry point called when a broadcast arrives via WebSocket.
/// Returns true if the broadcast was processed, false if it was a duplicate.
pub fn process_broadcast(broadcast: IntelligenceBroadcast) -> bool {
    let mut state = LISTENER_STATE.lock().unwrap();

    // Replay protection: skip already-processed broadcasts
    if state.processed_broadcast_ids.contains(&broadcast.broadcast_id) {
        log::debug!("⏭️ Skipping duplicate broadcast: {}", broadcast.broadcast_id);
        return false;
    }

    // Track broadcast ID for replay protection
    state.processed_broadcast_ids.push(broadcast.broadcast_id.clone());
    if state.processed_broadcast_ids.len() > MAX_PROCESSED_IDS {
        state.processed_broadcast_ids.drain(0..100);
    }

    log::info!(
        "📡 Processing intelligence broadcast: {} ({:?})",
        broadcast.broadcast_id,
        broadcast.broadcast_type
    );

    match broadcast.broadcast_type {
        BroadcastType::WeightUpdate => {
            if let Some(ref updates) = broadcast.payload.weight_updates {
                apply_weight_updates(&mut state, updates, &broadcast.broadcast_id);
            }
        }
        BroadcastType::ThreatAlert => {
            if let Some(ref domains) = broadcast.payload.threat_domains {
                apply_threat_domain_updates(&mut state, domains);
            }
        }
        BroadcastType::NodeStatus => {
            if let Some(ref statuses) = broadcast.payload.node_statuses {
                state.latest_node_statuses = statuses.clone();
            }
        }
        BroadcastType::CorrelationResult => {
            if let Some(ref correlation) = broadcast.payload.correlation {
                state.latest_correlations.push(correlation.clone());
                if state.latest_correlations.len() > MAX_CORRELATION_HISTORY {
                    state.latest_correlations.remove(0);
                }
            }
        }
        BroadcastType::GlobalMetrics => {
            state.latest_global_metrics = broadcast.payload.global_metrics.clone();
        }
    }

    // Store broadcast in history
    state.received_broadcasts.push(broadcast);
    if state.received_broadcasts.len() > MAX_BROADCAST_HISTORY {
        state.received_broadcasts.remove(0);
    }

    true
}

fn apply_weight_updates(
    state: &mut ListenerState,
    updates: &HashMap<String, f64>,
    broadcast_id: &str,
) {
    for (key, value) in updates {
        if key == "global" {
            state.weight_table.global_multiplier = value.clamp(0.1, 10.0);
            log::info!("⚖️ Global risk multiplier updated to {}", value);
        } else if key.starts_with("tld:") {
            let tld = key.strip_prefix("tld:").unwrap_or(key);
            state
                .weight_table
                .tld_multipliers
                .insert(tld.to_string(), value.clamp(0.1, 10.0));
        } else {
            // Treat as domain multiplier
            state
                .weight_table
                .domain_multipliers
                .insert(key.clone(), value.clamp(0.1, 10.0));
        }
    }
    state.weight_table.last_updated = chrono::Utc::now().to_rfc3339();
    state.weight_table.source_broadcast_id = broadcast_id.to_string();
}

fn apply_threat_domain_updates(state: &mut ListenerState, domains: &[ThreatDomainBroadcast]) {
    for domain in domains {
        // Automatically add domain multiplier based on cross-node risk
        let multiplier = if domain.risk_score >= 80.0 {
            2.0
        } else if domain.risk_score >= 60.0 {
            1.5
        } else if domain.risk_score >= 40.0 {
            1.2
        } else {
            1.0
        };

        if multiplier > 1.0 {
            state
                .weight_table
                .domain_multipliers
                .insert(domain.domain.clone(), multiplier);
        }
    }
    state.weight_table.last_updated = chrono::Utc::now().to_rfc3339();
}

// ──────────────────────────────────────────────
// Dynamic Risk Adjustment API
// ──────────────────────────────────────────────
//
// These functions are called by the scoring pipeline to apply
// the distributed intelligence multiplier on TOP of existing scores.
// They NEVER modify the base score calculation.

/// Get the risk multiplier for a specific domain.
/// Returns the combined multiplier: global * domain-specific * tld-specific.
/// Default is 1.0 (no adjustment).
pub fn get_risk_multiplier(domain: &str) -> f64 {
    let state = LISTENER_STATE.lock().unwrap();
    let mut multiplier = state.weight_table.global_multiplier;

    // Apply domain-specific multiplier
    if let Some(domain_mult) = state.weight_table.domain_multipliers.get(domain) {
        multiplier *= domain_mult;
    }

    // Apply TLD multiplier
    if let Some(tld_start) = domain.rfind('.') {
        let tld = &domain[tld_start..];
        if let Some(tld_mult) = state.weight_table.tld_multipliers.get(tld) {
            multiplier *= tld_mult;
        }
    }

    multiplier.clamp(0.1, 10.0)
}

/// Apply the distributed intelligence multiplier to a base risk score.
/// adjusted_score = base_score * multiplier, clamped to 0-100.
/// This is the ONLY way distributed intelligence affects scoring.
pub fn apply_distributed_risk_adjustment(base_score: f64, domain: &str) -> f64 {
    let multiplier = get_risk_multiplier(domain);
    (base_score * multiplier).clamp(0.0, 100.0)
}

// ──────────────────────────────────────────────
// Public Read API
// ──────────────────────────────────────────────

/// Get the current risk weight table.
pub fn get_weight_table() -> RiskWeightTable {
    LISTENER_STATE.lock().unwrap().weight_table.clone()
}

/// Get the latest node statuses from broadcasts.
pub fn get_node_statuses() -> Vec<NodeStatusEntry> {
    LISTENER_STATE.lock().unwrap().latest_node_statuses.clone()
}

/// Get the latest global metrics snapshot.
pub fn get_global_metrics() -> Option<GlobalMetricsSnapshot> {
    LISTENER_STATE.lock().unwrap().latest_global_metrics.clone()
}

/// Get recent correlations.
pub fn get_correlations() -> Vec<CorrelationResult> {
    LISTENER_STATE.lock().unwrap().latest_correlations.clone()
}

/// Get the count of processed broadcasts.
pub fn get_broadcast_count() -> usize {
    LISTENER_STATE.lock().unwrap().received_broadcasts.len()
}
