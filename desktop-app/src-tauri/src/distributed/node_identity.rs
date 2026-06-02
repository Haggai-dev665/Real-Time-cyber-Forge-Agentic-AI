// CyberForge Distributed Intelligence — Node Identity System
// TODO 4: Generates and persists a unique node identity for this CyberForge instance.
//
// ISOLATION: This module is completely independent of the auth system.
// Node identity != User identity. A single user may have multiple nodes.

use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::Mutex;

use keyring::Entry;

const SERVICE_NAME: &str = "com.cyberforge.distributed";
const NODE_ID_KEY: &str = "node_id";
const NODE_SECRET_KEY: &str = "node_secret";

// ──────────────────────────────────────────────
// Data Types
// ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeIdentity {
    pub node_id: String,
    pub device_fingerprint: String,
    pub hostname: String,
    pub platform: String,
    pub arch: String,
    pub created_at: String,
    pub version: String,
    pub node_secret_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeRegistration {
    pub node_id: String,
    pub device_fingerprint: String,
    pub hostname: String,
    pub platform: String,
    pub arch: String,
    pub version: String,
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeRegistrationResponse {
    pub success: bool,
    pub node_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assigned_cluster: Option<String>,
}

// ──────────────────────────────────────────────
// Global singleton
// ──────────────────────────────────────────────

lazy_static::lazy_static! {
    static ref NODE_IDENTITY: Mutex<Option<NodeIdentity>> = Mutex::new(None);
}

// ──────────────────────────────────────────────
// Device Fingerprint
// ──────────────────────────────────────────────

fn compute_device_fingerprint() -> String {
    let hostname = sysinfo::System::host_name().unwrap_or_else(|| "unknown".into());
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    // Combine stable system attributes into a deterministic hash
    let mut hasher = DefaultHasher::new();
    hostname.hash(&mut hasher);
    os.hash(&mut hasher);
    arch.hash(&mut hasher);

    // Add home directory path for uniqueness across user accounts
    if let Some(home) = dirs::home_dir() {
        home.to_string_lossy().hash(&mut hasher);
    }

    format!("{:016x}", hasher.finish())
}

// ──────────────────────────────────────────────
// Secure Storage (OS keychain — same mechanism as auth, different keys)
// ──────────────────────────────────────────────

fn store_node_id(node_id: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, NODE_ID_KEY).map_err(|e| e.to_string())?;
    entry.set_password(node_id).map_err(|e| e.to_string())
}

fn get_stored_node_id() -> Option<String> {
    let entry = Entry::new(SERVICE_NAME, NODE_ID_KEY).ok()?;
    entry.get_password().ok()
}

fn store_node_secret(secret: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, NODE_SECRET_KEY).map_err(|e| e.to_string())?;
    entry.set_password(secret).map_err(|e| e.to_string())
}

fn get_stored_node_secret() -> Option<String> {
    let entry = Entry::new(SERVICE_NAME, NODE_SECRET_KEY).ok()?;
    entry.get_password().ok()
}

fn hash_secret(secret: &str) -> String {
    let mut hasher = DefaultHasher::new();
    secret.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/// Initialize or restore the node identity.
/// Generates a new UUID + secret on first run, persists to OS keychain.
/// Subsequent calls return the cached identity.
pub fn initialize_node_identity() -> NodeIdentity {
    let mut guard = NODE_IDENTITY.lock().unwrap();
    if let Some(ref identity) = *guard {
        return identity.clone();
    }

    let node_id = get_stored_node_id().unwrap_or_else(|| {
        let id = uuid::Uuid::new_v4().to_string();
        let _ = store_node_id(&id);
        log::info!("🆔 Generated new CyberForge node ID: {}", id);
        id
    });

    let node_secret = get_stored_node_secret().unwrap_or_else(|| {
        let secret = uuid::Uuid::new_v4().to_string();
        let _ = store_node_secret(&secret);
        log::info!("🔐 Generated new node secret");
        secret
    });

    let identity = NodeIdentity {
        node_id: node_id.clone(),
        device_fingerprint: compute_device_fingerprint(),
        hostname: sysinfo::System::host_name().unwrap_or_else(|| "unknown".into()),
        platform: std::env::consts::OS.into(),
        arch: std::env::consts::ARCH.into(),
        created_at: chrono::Utc::now().to_rfc3339(),
        version: env!("CARGO_PKG_VERSION").into(),
        node_secret_hash: hash_secret(&node_secret),
    };

    *guard = Some(identity.clone());
    identity
}

/// Get the current node identity (initializes if needed).
pub fn get_node_identity() -> NodeIdentity {
    initialize_node_identity()
}

/// Get the raw node secret for signing (never serialized or sent as-is).
pub fn get_node_secret() -> String {
    get_stored_node_secret().unwrap_or_else(|| {
        // Ensure identity is initialized first
        initialize_node_identity();
        get_stored_node_secret().unwrap_or_default()
    })
}

/// Build a registration payload to send to the backend.
pub fn build_registration_payload() -> NodeRegistration {
    let identity = get_node_identity();
    NodeRegistration {
        node_id: identity.node_id,
        device_fingerprint: identity.device_fingerprint,
        hostname: identity.hostname,
        platform: identity.platform,
        arch: identity.arch,
        version: identity.version,
        capabilities: vec![
            "browser_intelligence".into(),
            "behavioral_scoring".into(),
            "url_monitoring".into(),
            "system_telemetry".into(),
        ],
    }
}

/// Register this node with the backend.
/// Returns the registration response from the server.
pub async fn register_node_with_backend(
    backend_url: &str,
    auth_token: Option<&str>,
) -> Result<NodeRegistrationResponse, String> {
    let payload = build_registration_payload();

    let client = reqwest::Client::new();
    let mut req = client
        .post(&format!("{}/api/distributed/nodes/register", backend_url))
        .json(&payload)
        .header("User-Agent", "cyber-forge-desktop/2.0");

    if let Some(token) = auth_token {
        req = req.header("Authorization", format!("Bearer {}", token));
    }

    // Add node signature header
    let secret = get_node_secret();
    let timestamp = chrono::Utc::now().timestamp().to_string();
    let signature_input = format!("{}:{}:{}", payload.node_id, timestamp, secret);
    let mut hasher = DefaultHasher::new();
    signature_input.hash(&mut hasher);
    let signature = format!("{:016x}", hasher.finish());

    req = req
        .header("X-Node-ID", &payload.node_id)
        .header("X-Node-Timestamp", &timestamp)
        .header("X-Node-Signature", &signature);

    let resp = req.send().await.map_err(|e| format!("Node registration failed: {}", e))?;
    let body: NodeRegistrationResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse registration response: {}", e))?;

    if body.success {
        log::info!("✅ Node registered successfully: {}", body.node_id);
    } else {
        log::warn!("⚠️ Node registration returned failure: {:?}", body.message);
    }

    Ok(body)
}
