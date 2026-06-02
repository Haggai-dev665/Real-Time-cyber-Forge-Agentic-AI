// CyberForge Distributed Intelligence — Distributed Module Root
// TODO 4: Central module declaration for all distributed intelligence components.
//
// All submodules are new and isolated from existing code.

pub mod node_identity;
pub mod sync_manager;
pub mod intelligence_listener;

// Re-export commonly used types and functions for convenience
pub use node_identity::{
    get_node_identity, initialize_node_identity, build_registration_payload,
    register_node_with_backend, NodeIdentity, NodeRegistration, NodeRegistrationResponse,
};

pub use sync_manager::{
    collect_telemetry_summary, sync_telemetry, get_sync_state, retry_failed_syncs,
    TelemetrySummary, SyncResult, SyncState,
};

pub use intelligence_listener::{
    process_broadcast, get_risk_multiplier, apply_distributed_risk_adjustment,
    get_weight_table, get_node_statuses, get_global_metrics, get_correlations,
    get_broadcast_count, IntelligenceBroadcast, BroadcastType, BroadcastPayload,
    RiskWeightTable, GlobalMetricsSnapshot, NodeStatusEntry, CorrelationResult,
};
