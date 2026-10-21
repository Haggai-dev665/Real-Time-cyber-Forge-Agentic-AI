//! This installation as a device of the user's workspace (DEV-01, DEV-02, the
//! first part of DEV-04; desktop side of backend/src/services/deviceService.js).
//!
//! Identity:
//!   - an installation ID, made once and kept in the app's data folder
//!     (`device.json`, with the device ID and the last sequence number; none of
//!     it is secret);
//!   - an Ed25519 key made by this installation, kept only in the system
//!     credential store. It is kept when the user signs out: the computer stays
//!     enrolled. If the store cannot keep it, enrollment stops and says so.
//!
//! Enrollment ("enroll this computer"): with the user signed in, ask the
//! backend for a code, claim it at once with this installation's key, then show
//! the key fingerprint so the user approves it knowing which key it is.
//! Pairing works the other way round: this app shows a code for another
//! installation to claim, or claims a code shown elsewhere.
//!
//! Heartbeats are signed exactly as the backend checks them. The sequence number
//! is the current time in milliseconds, or one more than the last one sent if
//! the clock went back, so it keeps increasing across restarts and even if
//! `device.json` is lost.

use base64::Engine;
use ring::rand::SystemRandom;
use ring::signature::{Ed25519KeyPair, KeyPair};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::State;
use tokio::sync::Mutex;

use crate::state::AppState;

type SharedState = Arc<Mutex<AppState>>;

// What the backend checks, and device.json's format, are shared (cyberforge_core::device).
pub use cyberforge_core::device::{
    b64, body_digest, claim_message, command_message, key_fingerprint, key_from_text, load_at, next_seq, normalize_code,
    platform, request_message, rotate_message, save_at, server_signed, sign, DeviceFile, MAX_DONE_COMMANDS,
};


const HEARTBEAT_EVERY: Duration = Duration::from_secs(60);
/// What this app can do; its heartbeats report which of these its own checks confirm.
const ADVERTISED: &[&str] = &["browser_history", "hosts_blocking", "secure_storage"];

/// Enrolled and not revoked: heartbeats and telemetry are sent.
pub fn is_enrolled() -> bool {
    load().map(|f| f.device_id.is_some() && f.state.as_deref() != Some("revoked")).unwrap_or(false)
}

fn device_path() -> Option<PathBuf> {
    crate::auth::config_dir().map(|d| d.join("device.json"))
}

fn load() -> Result<DeviceFile, String> {
    load_at(&device_path().ok_or("no data folder")?)
}

fn save(file: &DeviceFile) -> Result<(), String> {
    crate::ownership::ensure_owner()?;
    save_at(&device_path().ok_or("no data folder")?, file)
}

// ── the key ──────────────────────────────────────────────────────────────────

/// This installation's key, made and kept in the credential store the first time.
fn device_key() -> Result<Ed25519KeyPair, String> {
    let stored = crate::auth::device_key().map_err(|e| format!("The system credential store could not be read ({e}); this computer cannot be enrolled."))?;
    let pkcs8 = match stored {
        Some(text) => base64::engine::general_purpose::STANDARD.decode(text).map_err(|_| "the stored device key is damaged".to_string())?,
        None => {
            let made = Ed25519KeyPair::generate_pkcs8(&SystemRandom::new()).map_err(|_| "could not make a device key".to_string())?;
            crate::auth::store_device_key(&b64(made.as_ref()))
                .map_err(|e| format!("The device key could not be kept in the system credential store ({e}); this computer cannot be enrolled."))?;
            made.as_ref().to_vec()
        }
    };
    Ed25519KeyPair::from_pkcs8(&pkcs8).map_err(|_| "the stored device key is damaged".to_string())
}

// ── talking to the backend ───────────────────────────────────────────────────

fn default_name() -> String {
    sysinfo::System::host_name()
        .map(|h| h.chars().filter(|c| !c.is_control()).take(80).collect::<String>())
        .filter(|h| !h.trim().is_empty())
        .unwrap_or_else(|| "This computer".into())
}

async fn session(state: &SharedState) -> (String, Vec<(String, String)>, bool) {
    let s = state.lock().await;
    (s.backend_url.clone(), s.auth_headers(), s.is_authenticated)
}

/// The backend's JSON answer: `data` on success, otherwise its message and code.
async fn answer(response: Result<reqwest::Response, reqwest::Error>) -> Result<Value, String> {
    let response = response.map_err(|e| format!("The server could not be reached: {e}"))?;
    let ok = response.status().is_success();
    let body: Value = response.json().await.unwrap_or(Value::Null);
    if ok {
        return Ok(body.get("data").cloned().unwrap_or(Value::Null));
    }
    let message = body.get("message").and_then(|m| m.as_str()).unwrap_or("The server refused the request");
    let code = body.get("code").and_then(|c| c.as_str()).unwrap_or("");
    Err(if code.is_empty() { message.to_string() } else { format!("{message} ({code})") })
}

fn with_headers(mut request: reqwest::RequestBuilder, headers: &[(String, String)]) -> reqwest::RequestBuilder {
    for (k, v) in headers {
        request = request.header(k, v);
    }
    request
}

async fn signed_in(state: &SharedState) -> Result<(String, Vec<(String, String)>), String> {
    let (base, headers, ok) = session(state).await;
    if !ok {
        return Err("Sign in first.".into());
    }
    Ok((base, headers))
}

/// The claim request itself, for any key and installation (the live test uses a throwaway key).
async fn claim_with(base: &str, code: &str, display_name: &str, key: &Ed25519KeyPair, installation_id: &str) -> Result<Value, String> {
    let normalized = normalize_code(code).ok_or("The code is 12 letters and digits, as shown: XXXX-XXXX-XXXX.")?;
    let name = crate::input::text(display_name, "device name", 80)?;
    let public_key = b64(key.public_key().as_ref());
    let body = json!({
        "code": normalized,
        "installationId": installation_id,
        "publicKey": public_key,
        "platform": platform(),
        "kind": "endpoint",
        "displayName": name,
        "capabilities": ADVERTISED,
        "clientVersion": env!("CARGO_PKG_VERSION"),
        "signature": sign(key, &claim_message(&normalized, installation_id, &public_key)),
    });
    answer(crate::http::client().post(format!("{base}/api/v1/device-enrollments/claim")).json(&body).send().await).await
}

/// One signed heartbeat for any key, device and sequence number.
async fn heartbeat_with(base: &str, device_id: &str, key: &Ed25519KeyPair, seq: u64, now_ms: u64, body: Vec<u8>) -> Result<Value, String> {
    signed_with(base, &format!("/api/v1/devices/{device_id}/heartbeat"), device_id, key, seq, now_ms, body).await
}

/// One signed request to a device path, for any key and sequence number.
async fn signed_with(base: &str, path: &str, device_id: &str, key: &Ed25519KeyPair, seq: u64, now_ms: u64, body: Vec<u8>) -> Result<Value, String> {
    let signature = sign(key, &request_message("POST", path, device_id, now_ms, seq, &body_digest(&body)));
    answer(
        crate::http::client_with_timeout(Duration::from_secs(20))
            .post(format!("{base}{path}"))
            .header("Content-Type", "application/json")
            .header("X-CF-Device", device_id)
            .header("X-CF-Timestamp", now_ms.to_string())
            .header("X-CF-Seq", seq.to_string())
            .header("X-CF-Signature", signature)
            .body(body)
            .send()
            .await,
    )
    .await
}

/// Claim `code` with this installation's key. Used by both flows.
async fn claim(base: &str, code: &str, display_name: &str) -> Result<Value, String> {
    let key = device_key()?;
    let mut file = load()?;
    let data = claim_with(base, code, display_name, &key, &file.installation_id).await?;
    file.device_id = data.get("deviceId").and_then(|v| v.as_str()).map(String::from);
    file.state = data.get("state").and_then(|v| v.as_str()).map(String::from);
    file.key_version = data.get("keyVersion").and_then(|v| v.as_u64()).unwrap_or(1);
    file.last_capabilities = None;
    file.server_command_key = data.get("serverCommandKey").and_then(|v| v.as_str()).map(String::from);
    save(&file)?;
    Ok(json!({
        "deviceId": file.device_id,
        "state": file.state,
        "keyFingerprint": key_fingerprint(key.public_key().as_ref()),
        "serverKeyFingerprint": data.get("keyFingerprint"),
    }))
}

/// A signed request from this computer to one of its device paths. The sequence
/// number is saved before sending. If the current key is refused and a rotation
/// left a next key, the request is tried once with that key, and the next key
/// becomes the current one when it is accepted (the rotation went through and its
/// answer was lost).
async fn signed_post(base: &str, path_of: impl Fn(&str) -> String, body: Vec<u8>) -> Result<Value, String> {
    let device_id = load()?.device_id.ok_or("not enrolled")?;
    let path = path_of(&device_id);
    let send = |key: Ed25519KeyPair, body: Vec<u8>| {
        let (path, device_id) = (path.clone(), device_id.clone());
        async move {
            let mut file = load()?;
            let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
            let seq = next_seq(file.last_seq, now_ms);
            file.last_seq = seq;
            save(&file)?; // before sending, so a crash cannot send the same number twice
            signed_with(base, &path, &device_id, &key, seq, now_ms, body).await
        }
    };
    let result = send(device_key()?, body.clone()).await;
    if matches!(&result, Err(e) if e.contains("DEVICE_SIGNATURE_INVALID")) {
        if let Ok(Some(next)) = crate::auth::device_key_next() {
            let retried = send(key_from_text(&next)?, body).await;
            if retried.is_ok() {
                crate::auth::store_device_key(&next)?;
                let _ = crate::auth::delete_device_key_next();
            }
            return retried;
        }
    }
    result
}

/// One signed heartbeat with what this computer's own checks confirm. A change
/// since the last heartbeat is also queued as a `capability_change` event.
async fn heartbeat_once(base: &str) -> Result<Value, String> {
    let confirmed = confirmed_capabilities();
    let body = serde_json::to_vec(&json!({ "clientVersion": env!("CARGO_PKG_VERSION"), "capabilities": confirmed }))
        .map_err(|e| e.to_string())?;
    let result = signed_post(base, |id| format!("/api/v1/devices/{id}/heartbeat"), body).await;
    let mut file = load()?;
    let state = match &result {
        Ok(_) => Some("active"),
        Err(e) if e.contains("DEVICE_REVOKED") => Some("revoked"),
        Err(e) if e.contains("DEVICE_NOT_ACTIVE") => Some("pending_approval"),
        _ => None,
    };
    if let Some(state) = state {
        file.state = Some(state.into());
    }
    if result.is_ok() {
        if let Some(previous) = file.last_capabilities.clone() {
            for (name, now) in confirmed.as_object().into_iter().flatten() {
                if previous.get(name) != Some(now) {
                    crate::outbox::record("capability_change", json!({ "name": name, "from": previous.get(name), "to": now }));
                }
            }
        }
        file.last_capabilities = Some(confirmed);
    }
    save(&file)?;
    result
}

/// The backend's answer when a batch's content is invalid (as opposed to the
/// request not getting through, or the device not being accepted).
pub fn is_refused_batch(error: &str) -> bool {
    error.ends_with("(TELEMETRY_EVENT_INVALID)") || error.ends_with("(TELEMETRY_BATCH_INVALID)")
}

/// Send the outbox's next batch and forget it once the backend acknowledges it.
/// A send that got no answer leaves the batch in flight, to be sent again with
/// the same ID; a batch refused for its content is dropped (outbox.rs).
async fn flush_outbox(base: &str) -> Result<Value, String> {
    let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
    let Some(batch) = crate::outbox::update(|o| {
        o.drop_expired(now_ms);
        o.next_batch(new_batch_id)
    })?
    else {
        return Ok(json!({ "sent": 0 }));
    };
    let body = serde_json::to_vec(&batch).map_err(|e| e.to_string())?;
    let data = match signed_post(base, |id| format!("/api/v1/devices/{id}/telemetry"), body).await {
        Ok(data) => data,
        // refused for its content: it would be refused again, so it must not hold up the queue
        Err(e) if is_refused_batch(&e) => {
            crate::outbox::update(|o| o.refuse(&batch.batch_id, &e))?;
            return Err(e);
        }
        Err(e) => return Err(e),
    };
    if data.get("batchId").and_then(|v| v.as_str()) == Some(batch.batch_id.as_str()) {
        crate::outbox::update(|o| o.acknowledge(&batch.batch_id))?;
    }
    Ok(data)
}

/// Fetch this computer's commands and carry out each one that the server key
/// signed, that is for this device, has not expired and has not been run, then
/// send a receipt saying what happened. A command that fails any check is not
/// run, and its receipt says why.
async fn run_commands(base: &str) -> Result<Value, String> {
    let pulled = signed_post(base, |id| format!("/api/v1/devices/{id}/commands/pull"), b"{}".to_vec()).await?;
    let mut file = load()?;
    let device_id = file.device_id.clone().ok_or("not enrolled")?;
    let offered = pulled.get("serverKey").and_then(|v| v.as_str()).map(String::from);
    if file.server_command_key.is_none() {
        // Enrolled before commands existed: keep the first key seen (over the same TLS connection as enrollment).
        file.server_command_key = offered.clone();
        save(&file)?;
    }
    let trusted = file.server_command_key.clone().unwrap_or_default();
    let mut results = Vec::new();
    for command in pulled.get("commands").and_then(|c| c.as_array()).cloned().unwrap_or_default() {
        let get = |k: &str| command.get(k).and_then(|v| v.as_str()).unwrap_or("").to_string();
        let (command_id, kind, domain, signature) = (get("commandId"), get("type"), get("domain"), get("signature"));
        let expires_at = command.get("expiresAt").and_then(|v| v.as_u64()).unwrap_or(0);
        let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
        let (status, executor, detail) = if offered.as_deref() != Some(trusted.as_str()) {
            ("failed", None, "the server's command key is not the one given at enrollment; nothing was run".to_string())
        } else if !server_signed(&trusted, &command_message(&command_id, &device_id, &kind, &domain, expires_at), &signature) {
            ("failed", None, "the command's signature does not match the server key; nothing was run".to_string())
        } else if expires_at <= now_ms {
            ("failed", None, "the command had expired; nothing was run".to_string())
        } else if file.done_commands.contains(&command_id) {
            ("applied", Some("hosts_file"), "already carried out".to_string())
        } else {
            let outcome = match kind.as_str() {
                "block_domain" => crate::blocking::block_site(domain.clone(), Some("Sent from your CyberForge account".into())).await
                    .map(|r| r.get("enforced").and_then(|v| v.as_bool()).unwrap_or(false))
                    .map_err(|e| e),
                "unblock_domain" => crate::blocking::unblock_site(domain.clone()).await.map(|_| true),
                other => Err(format!("this app cannot carry out {other}")),
            };
            match outcome {
                Ok(true) => ("applied", Some("hosts_file"), format!("{domain}: the hosts file now enforces it")),
                Ok(false) => ("failed", Some("hosts_file"), format!("{domain}: listed, but the hosts file was not changed (administrator approval not given)")),
                Err(e) => ("failed", Some("hosts_file"), e),
            }
        };
        if status == "applied" && !file.done_commands.contains(&command_id) {
            file.done_commands.push(command_id.clone());
            if file.done_commands.len() > MAX_DONE_COMMANDS {
                file.done_commands.remove(0);
            }
            save(&file)?;
        }
        let body = serde_json::to_vec(&json!({ "status": status, "executor": executor, "detail": detail })).map_err(|e| e.to_string())?;
        let sent = signed_post(base, |id| format!("/api/v1/devices/{id}/commands/{command_id}/receipt"), body).await;
        results.push(json!({ "commandId": command_id, "status": status, "receiptSent": sent.is_ok() }));
        file = load()?;
    }
    Ok(json!({ "commands": results }))
}

fn new_batch_id() -> String {
    let mut bytes = [0u8; 12];
    let _ = getrandom::fill(&mut bytes);
    format!("b-{}", bytes.iter().map(|b| format!("{b:02x}")).collect::<String>())
}

/// What this computer's checks confirm right now.
fn confirmed_capabilities() -> Value {
    let storage = if crate::auth::check_secure_storage().is_ok() { "ok" } else { "unavailable" };
    let history = if crate::system::collected_history_available() { "ok" } else { "unavailable" };
    let hosts = if crate::blocking::hosts_file_usable() { "ok" } else { "unavailable" };
    json!({ "secure_storage": storage, "browser_history": history, "hosts_blocking": hosts })
}

/// Background heartbeats while this computer is enrolled and not revoked.
pub fn start_heartbeats(state: SharedState) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(HEARTBEAT_EVERY).await;
            if !is_enrolled() {
                continue;
            }
            let base = state.lock().await.backend_url.clone();
            if heartbeat_once(&base).await.is_ok() {
                let _ = run_commands(&base).await;
                let _ = flush_outbox(&base).await;
            }
        }
    });
}

// ── commands ─────────────────────────────────────────────────────────────────

/// This installation: its ID, its key fingerprint, and what it knows about its enrollment.
#[tauri::command]
pub async fn device_status() -> Result<Value, String> {
    let file = load()?;
    let outbox = crate::outbox::snapshot();
    let key = device_key();
    Ok(json!({
        "localOwner": crate::ownership::describe(),
        "installationId": file.installation_id,
        "deviceId": file.device_id,
        "state": file.state,
        "platform": platform(),
        "defaultName": default_name(),
        "keyFingerprint": key.as_ref().ok().map(|k| key_fingerprint(k.public_key().as_ref())),
        "secureStorage": key.as_ref().map(|_| "ok").unwrap_or("unavailable"),
        "secureStorageError": key.err(),
        "keyVersion": file.key_version,
        "outbox": {
            "queued": outbox.queued.len(),
            "inFlight": outbox.in_flight.as_ref().map(|b| b.events.len()).unwrap_or(0),
            "sent": outbox.sent,
            "dropped": outbox.dropped,
            "lastRefusal": outbox.last_refusal,
            "limit": crate::outbox::MAX_QUEUED,
        },
    }))
}

/// Enroll this computer: get a code with the user's session and claim it with this installation's key.
#[tauri::command]
pub async fn device_enroll_this(state: State<'_, SharedState>, display_name: Option<String>) -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    let (base, headers) = signed_in(state.inner()).await?;
    let code_data = answer(
        with_headers(crate::http::client().post(format!("{base}/api/v1/device-enrollments")), &headers)
            .json(&json!({ "flow": "this_device", "platform": platform() }))
            .send()
            .await,
    )
    .await?;
    let code = code_data.get("code").and_then(|c| c.as_str()).ok_or("the server did not return a code")?;
    let name = display_name.filter(|n| !n.trim().is_empty()).unwrap_or_else(default_name);
    claim(&base, code, &name).await
}

/// Claim a code shown by another CyberForge app (pairing).
#[tauri::command]
pub async fn device_claim_code(state: State<'_, SharedState>, code: String, display_name: Option<String>) -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    let base = state.inner().lock().await.backend_url.clone();
    let name = display_name.filter(|n| !n.trim().is_empty()).unwrap_or_else(default_name);
    claim(&base, &code, &name).await
}

/// A code for another installation to claim.
#[tauri::command]
pub async fn device_enrollment_create(state: State<'_, SharedState>) -> Result<Value, String> {
    let (base, headers) = signed_in(state.inner()).await?;
    answer(
        with_headers(crate::http::client().post(format!("{base}/api/v1/device-enrollments")), &headers)
            .json(&json!({ "flow": "pair" }))
            .send()
            .await,
    )
    .await
}

/// The workspace's devices.
#[tauri::command]
pub async fn devices_list(state: State<'_, SharedState>) -> Result<Value, String> {
    let (base, headers) = signed_in(state.inner()).await?;
    answer(with_headers(crate::http::client().get(format!("{base}/api/v1/devices?limit=200")), &headers).send().await).await
}

/// Approve a device that has claimed a code, naming the fingerprint the user compared.
#[tauri::command]
pub async fn device_approve(state: State<'_, SharedState>, device_id: String, key_fingerprint: String) -> Result<Value, String> {
    let device_id = crate::input::record_id(&device_id, "device id")?;
    let fingerprint = crate::input::text(&key_fingerprint, "key fingerprint", 64)?;
    let (base, headers) = signed_in(state.inner()).await?;
    let data = answer(
        with_headers(crate::http::client().post(format!("{base}/api/v1/devices/{device_id}/approve")), &headers)
            .json(&json!({ "keyFingerprint": fingerprint }))
            .send()
            .await,
    )
    .await?;
    if let Ok(mut file) = load() {
        if file.device_id.as_deref() == Some(device_id.as_str()) {
            file.state = Some("active".into());
            let _ = save(&file);
            let _ = heartbeat_once(&base).await; // shows as online straight away
        }
    }
    Ok(data)
}

#[tauri::command]
pub async fn device_rename(state: State<'_, SharedState>, device_id: String, display_name: String) -> Result<Value, String> {
    let device_id = crate::input::record_id(&device_id, "device id")?;
    let name = crate::input::text(&display_name, "device name", 80)?;
    let (base, headers) = signed_in(state.inner()).await?;
    answer(
        with_headers(crate::http::client().patch(format!("{base}/api/v1/devices/{device_id}")), &headers)
            .json(&json!({ "displayName": name }))
            .send()
            .await,
    )
    .await
}

#[tauri::command]
pub async fn device_revoke(state: State<'_, SharedState>, device_id: String) -> Result<Value, String> {
    let device_id = crate::input::record_id(&device_id, "device id")?;
    let (base, headers) = signed_in(state.inner()).await?;
    answer(with_headers(crate::http::client().post(format!("{base}/api/v1/devices/{device_id}/revoke")), &headers).send().await).await
}

/// Send one heartbeat now, then the next telemetry batch (the Devices page's "Check in" button).
#[tauri::command]
pub async fn device_heartbeat(state: State<'_, SharedState>) -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    let base = state.inner().lock().await.backend_url.clone();
    let beat = heartbeat_once(&base).await?;
    let commands = run_commands(&base).await.unwrap_or_else(|e| json!({ "error": e }));
    let telemetry = flush_outbox(&base).await.map_err(|e| format!("heartbeat accepted; telemetry not sent: {e}"))?;
    Ok(json!({ "heartbeat": beat, "commands": commands, "telemetry": telemetry }))
}

/// Ask a device of the workspace to block or unblock one domain. The request is
/// the approval for that exact action; the device reports what happened.
#[tauri::command]
pub async fn device_command_send(state: State<'_, SharedState>, device_id: String, kind: String, domain: String) -> Result<Value, String> {
    let device_id = crate::input::record_id(&device_id, "device id")?;
    if kind != "block_domain" && kind != "unblock_domain" {
        return Err("kind is block_domain or unblock_domain".into());
    }
    let domain = crate::input::text(&domain, "domain", 253)?;
    let (base, headers) = signed_in(state.inner()).await?;
    let mut bytes = [0u8; 16];
    getrandom::fill(&mut bytes).map_err(|e| e.to_string())?;
    let idempotency_key: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    answer(
        with_headers(crate::http::client().post(format!("{base}/api/v1/devices/{device_id}/commands")), &headers)
            .json(&json!({ "type": kind, "domain": domain, "idempotencyKey": idempotency_key }))
            .send()
            .await,
    )
    .await
}

/// A device's recent commands and what its receipts said.
#[tauri::command]
pub async fn device_commands_list(state: State<'_, SharedState>, device_id: String) -> Result<Value, String> {
    let device_id = crate::input::record_id(&device_id, "device id")?;
    let (base, headers) = signed_in(state.inner()).await?;
    answer(with_headers(crate::http::client().get(format!("{base}/api/v1/devices/{device_id}/commands?limit=10")), &headers).send().await).await
}

/// Replace this computer's device key. The next key is kept in the credential
/// store before anything is sent, so a lost answer cannot leave the computer
/// without the key the backend now expects; signed_post() finishes the switch.
#[tauri::command]
pub async fn device_rotate_key(state: State<'_, SharedState>) -> Result<Value, String> {
    crate::ownership::ensure_owner()?;
    let base = state.inner().lock().await.backend_url.clone();
    let file = load()?;
    let device_id = file.device_id.clone().ok_or("This computer is not enrolled.")?;
    if file.state.as_deref() != Some("active") {
        return Err("Only an approved device can rotate its key.".into());
    }
    let made = Ed25519KeyPair::generate_pkcs8(&SystemRandom::new()).map_err(|_| "could not make a device key".to_string())?;
    let next_text = b64(made.as_ref());
    let next = key_from_text(&next_text)?;
    crate::auth::store_device_key_next(&next_text)
        .map_err(|e| format!("The new key could not be kept in the system credential store ({e}); nothing was changed."))?;
    let public_key = b64(next.public_key().as_ref());
    let body = serde_json::to_vec(&json!({
        "publicKey": public_key,
        "proof": sign(&next, &rotate_message(&device_id, file.key_version + 1, &public_key)),
    }))
    .map_err(|e| e.to_string())?;
    let data = signed_post(&base, |id| format!("/api/v1/devices/{id}/rotate-key"), body).await?;
    crate::auth::store_device_key(&next_text)?;
    let _ = crate::auth::delete_device_key_next();
    let mut file = load()?;
    file.key_version = data.get("keyVersion").and_then(|v| v.as_u64()).unwrap_or(file.key_version + 1);
    save(&file)?;
    Ok(data)
}

#[cfg(test)]
mod device_tests {
    use super::*;

    #[test]
    fn only_a_refusal_of_the_batch_itself_drops_it() {
        assert!(is_refused_batch("Event 3 has a time outside the last 7 days. (TELEMETRY_EVENT_INVALID)"));
        assert!(is_refused_batch("A batch holds 1 to 100 events. (TELEMETRY_BATCH_INVALID)"));
        for kept in [
            "The server could not be reached: timed out",
            "The request time is more than 5 minutes from server time. (DEVICE_CLOCK_SKEW)",
            "Device request failed",
            "This device was revoked (DEVICE_REVOKED)",
        ] {
            assert!(!is_refused_batch(kept), "{kept}");
        }
    }

    // Vectors made with backend/src/services/deviceService.js and Node's crypto,
    // for the key whose 32-byte seed is all 7s.
    const PUBLIC_KEY: &str = "6kpsY+KcUgq+9VB7Ey7F+ZVHdq6+vnuSQh7qaRRG0iw=";
    const FINGERPRINT: &str = "fe81 2c12 f3ab 4ce6 ac5d b69a c352 f906";
    const CLAIM_SIGNATURE: &str = "fOTi9NIZqrZpCEOjnu1AyjREsxx80w0M7kzrlMItjHa3TNN18fO5lVw8dyuqPGS/u8scofc8sRm1E7xTgwRKCA==";
    const BODY: &str = r#"{"capabilities":{"secure_storage":"ok"}}"#;
    const BODY_DIGEST: &str = "3915cc7ab7eb3dcdf0e49bc3aee51953565783c2a6048653d53aa024a5d30ef4";
    const REQUEST_SIGNATURE: &str = "9z/t5YLGXbDMXwjEGdpfunomo7BzHVEhpMd9qzUI7EwMyqLAeIrf60XcTB1PhGv09IIzhQTQwhR0+NQ8y1+7Dg==";

    fn test_key() -> Ed25519KeyPair {
        Ed25519KeyPair::from_seed_unchecked(&[7u8; 32]).unwrap()
    }

    #[test]
    fn keys_and_fingerprints_match_the_backend() {
        let key = test_key();
        assert_eq!(b64(key.public_key().as_ref()), PUBLIC_KEY);
        assert_eq!(key_fingerprint(key.public_key().as_ref()), FINGERPRINT);
    }

    #[test]
    fn a_claim_is_signed_exactly_as_the_backend_checks_it() {
        let code = normalize_code("abcd-0011-wxyz").unwrap();
        assert_eq!(code, "ABCD0011WXYZ");
        assert_eq!(sign(&test_key(), &claim_message(&code, "install-0001", PUBLIC_KEY)), CLAIM_SIGNATURE);
    }

    #[test]
    fn a_heartbeat_is_signed_exactly_as_the_backend_checks_it() {
        assert_eq!(body_digest(BODY.as_bytes()), BODY_DIGEST);
        let message = request_message("post", "/api/v1/devices/dev-1/heartbeat", "dev-1", 1_792_100_000_000, 1_792_100_000_000, BODY_DIGEST);
        assert_eq!(sign(&test_key(), &message), REQUEST_SIGNATURE);
    }

    #[test]
    fn a_rotation_proof_is_signed_exactly_as_the_backend_checks_it() {
        const ROTATE_SIGNATURE: &str = "Gt0gaO4ArYeVr6ws2hJxQzjPR9tDhDtYBJPa6hihBADG8VT9yJmGadEEWqm3fbHfmZrMOQQ+0/pYM3FpL4LdAQ==";
        assert_eq!(sign(&test_key(), &rotate_message("dev-1", 2, PUBLIC_KEY)), ROTATE_SIGNATURE);
    }

    #[test]
    fn a_command_signed_by_the_server_is_recognised_and_anything_else_is_not() {
        // made with backend/src/services/deviceCommandService.js for the server seed of all 9s
        const SERVER_KEY: &str = "/RckOFqgx1tk+3jNYC+h2ZH96/drE8WO1wLqyDXp9hg=";
        const SIGNATURE: &str = "nz6TW3bzhNL/xcgg65v1S54aZS7YXsSn/nunKBo7yNDAUzuHvKbvFvrd6Iatf9RzCsHa9hyZJUZielmknSt5CA==";
        let message = command_message("cmd-1", "dev-1", "block_domain", "phish.example", 1_792_100_000_000);
        assert!(server_signed(SERVER_KEY, &message, SIGNATURE));
        // another device, another domain, a later expiry, or another key: refused
        assert!(!server_signed(SERVER_KEY, &command_message("cmd-1", "dev-2", "block_domain", "phish.example", 1_792_100_000_000), SIGNATURE));
        assert!(!server_signed(SERVER_KEY, &command_message("cmd-1", "dev-1", "block_domain", "bank.example", 1_792_100_000_000), SIGNATURE));
        assert!(!server_signed(SERVER_KEY, &command_message("cmd-1", "dev-1", "block_domain", "phish.example", 1_792_200_000_000), SIGNATURE));
        assert!(!server_signed(PUBLIC_KEY, &message, SIGNATURE));
        assert!(!server_signed(SERVER_KEY, &message, "not base64!"));
    }

    #[test]
    fn codes_are_read_as_the_backend_reads_them() {
        assert_eq!(normalize_code(" abcd OoiL wxyz ").as_deref(), Some("ABCD0011WXYZ"));
        assert_eq!(normalize_code("ABCD-0011-WXYU"), None);
        assert_eq!(normalize_code("ABCD-0011"), None);
    }

    #[test]
    fn sequence_numbers_keep_increasing_even_if_the_clock_goes_back() {
        assert_eq!(next_seq(0, 1_000), 1_000);
        assert_eq!(next_seq(1_000, 1_000), 1_001);
        assert_eq!(next_seq(5_000, 1_000), 5_001);
    }

    /// Enrolls a throwaway in-memory key (not this machine's credential store)
    /// through the real backend, with a session from a throwaway account, and
    /// checks approval, a heartbeat signed here, a replay and revocation.
    ///   CF_LIVE_BASE=… CF_LIVE_TOKEN=… cargo test --lib device_tests::the_live_backend -- --ignored --nocapture
    #[tokio::test]
    #[ignore]
    async fn the_live_backend_accepts_this_client() {
        let (Ok(base), Ok(token)) = (std::env::var("CF_LIVE_BASE"), std::env::var("CF_LIVE_TOKEN")) else {
            println!("SKIPPED: CF_LIVE_BASE and CF_LIVE_TOKEN are not set");
            return;
        };
        let session = vec![("Authorization".to_string(), format!("Bearer {token}"))];
        let code = answer(with_headers(crate::http::client().post(format!("{base}/api/v1/device-enrollments")), &session)
            .json(&json!({ "flow": "pair" })).send().await).await.expect("code");
        let code = code["code"].as_str().unwrap().to_string();
        let pkcs8 = Ed25519KeyPair::generate_pkcs8(&SystemRandom::new()).unwrap();
        let key = Ed25519KeyPair::from_pkcs8(pkcs8.as_ref()).unwrap();
        let installation = format!("live-test-{}", std::process::id());

        let claimed = claim_with(&base, &code, "Live test", &key, &installation).await.expect("claim");
        let device_id = claimed["deviceId"].as_str().unwrap().to_string();
        let fingerprint = key_fingerprint(key.public_key().as_ref());
        assert_eq!(claimed["keyFingerprint"].as_str(), Some(fingerprint.as_str()), "the server saw the same key");
        println!("LIVE claimed {} ({})", claimed["state"], fingerprint);

        answer(with_headers(crate::http::client().post(format!("{base}/api/v1/devices/{device_id}/approve")), &session)
            .json(&json!({ "keyFingerprint": fingerprint })).send().await).await.expect("approve");
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
        let body = || serde_json::to_vec(&json!({ "capabilities": { "secure_storage": "ok" } })).unwrap();
        let beat = heartbeat_with(&base, &device_id, &key, now, now, body()).await.expect("heartbeat");
        println!("LIVE heartbeat: connection {}", beat["device"]["connection"]);
        assert_eq!(beat["device"]["connection"], "online");
        let replay = heartbeat_with(&base, &device_id, &key, now, now, body()).await;
        assert!(matches!(&replay, Err(e) if e.contains("DEVICE_REPLAY")), "{replay:?}");

        // a telemetry batch from the outbox, sent twice: stored once
        let mut outbox = crate::outbox::Outbox::default();
        outbox.push(crate::outbox::OutboxEvent { kind: "enforcement".into(), at: now, data: json!({ "action": "block", "domain": "phish.example", "enforced": false }) });
        let batch = outbox.next_batch(new_batch_id).unwrap();
        let telemetry_path = format!("/api/v1/devices/{device_id}/telemetry");
        let first = signed_with(&base, &telemetry_path, &device_id, &key, now + 1, now, serde_json::to_vec(&batch).unwrap()).await.expect("telemetry");
        let again = signed_with(&base, &telemetry_path, &device_id, &key, now + 2, now, serde_json::to_vec(&batch).unwrap()).await.expect("telemetry again");
        println!("LIVE telemetry: first {first}, again {again}");
        assert_eq!((first["stored"].as_u64(), again["stored"].as_u64(), again["duplicates"].as_u64()), (Some(1), Some(0), Some(1)));

        // key rotation: signed by the current key, proved by the next
        let next_pkcs8 = Ed25519KeyPair::generate_pkcs8(&SystemRandom::new()).unwrap();
        let next = Ed25519KeyPair::from_pkcs8(next_pkcs8.as_ref()).unwrap();
        let next_public = b64(next.public_key().as_ref());
        let version = claimed["keyVersion"].as_u64().unwrap_or(1);
        let rotate_body = serde_json::to_vec(&json!({ "publicKey": next_public, "proof": sign(&next, &rotate_message(&device_id, version + 1, &next_public)) })).unwrap();
        let rotated = signed_with(&base, &format!("/api/v1/devices/{device_id}/rotate-key"), &device_id, &key, now + 3, now, rotate_body).await.expect("rotate");
        println!("LIVE rotated to key version {}", rotated["keyVersion"]);
        let old_key = heartbeat_with(&base, &device_id, &key, now + 4, now, body()).await;
        assert!(matches!(&old_key, Err(e) if e.contains("DEVICE_SIGNATURE_INVALID")), "{old_key:?}");
        heartbeat_with(&base, &device_id, &next, now + 5, now, body()).await.expect("heartbeat with the new key");
        let key = next;

        // a command: sent by the member, pulled and checked by the device, done on its receipt
        let server_key = claimed["serverCommandKey"].as_str().expect("the server gave a command key at enrollment").to_string();
        let sent = answer(with_headers(crate::http::client().post(format!("{base}/api/v1/devices/{device_id}/commands")), &session)
            .json(&json!({ "type": "block_domain", "domain": "phish.example", "idempotencyKey": format!("live-{now}") })).send().await).await.expect("command");
        let pulled = signed_with(&base, &format!("/api/v1/devices/{device_id}/commands/pull"), &device_id, &key, now + 7, now, b"{}".to_vec()).await.expect("pull");
        assert_eq!(pulled["serverKey"].as_str(), Some(server_key.as_str()));
        let command = &pulled["commands"][0];
        let command_id = command["commandId"].as_str().unwrap();
        assert_eq!(Some(command_id), sent["commandId"].as_str());
        let message = command_message(command_id, &device_id, "block_domain", "phish.example", command["expiresAt"].as_u64().unwrap());
        assert!(server_signed(&server_key, &message, command["signature"].as_str().unwrap()), "the command is signed by the enrollment key");
        let receipt = serde_json::to_vec(&json!({ "status": "applied", "executor": "hosts_file", "detail": "live test (nothing was changed on this machine)" })).unwrap();
        signed_with(&base, &format!("/api/v1/devices/{device_id}/commands/{command_id}/receipt"), &device_id, &key, now + 8, now, receipt).await.expect("receipt");
        let listed = answer(with_headers(crate::http::client().get(format!("{base}/api/v1/devices/{device_id}/commands")), &session).send().await).await.expect("list");
        println!("LIVE command {} is {}", command_id, listed["commands"][0]["state"]);
        assert_eq!(listed["commands"][0]["state"], "applied");

        answer(with_headers(crate::http::client().post(format!("{base}/api/v1/devices/{device_id}/revoke")), &session).send().await).await.expect("revoke");
        let after = heartbeat_with(&base, &device_id, &key, now + 9, now, body()).await;
        assert!(matches!(&after, Err(e) if e.contains("DEVICE_REVOKED")), "{after:?}");
        println!("LIVE replay and revoked heartbeats refused");
    }

    #[test]
    fn the_installation_id_is_made_once_and_kept() {
        let dir = std::env::temp_dir().join(format!("cf-device-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let path = dir.join("device.json");
        let first = load_at(&path).unwrap();
        assert_eq!(first.installation_id.len(), 32);
        let mut file = first.clone();
        file.device_id = Some("dev-1".into());
        file.last_seq = 42;
        save_at(&path, &file).unwrap();
        let again = load_at(&path).unwrap();
        assert_eq!(again, file);
        assert!(!dir.join("device.json.new").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
