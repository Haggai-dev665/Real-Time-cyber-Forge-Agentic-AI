//! This installation as a device of the user's workspace: the parts that do
//! not depend on the window (DEV-01, DEV-02, DEV-04).
//!
//! What the backend checks (`backend/src/services/deviceService.js` and
//! `deviceCommandService.js`) is defined here once: the claim, request,
//! rotation and command messages, the body digest, the key fingerprint, the
//! sequence rule, and `device.json`'s format. These must stay identical to the
//! backend; the tests hold them to vectors made with it.
//!
//! Where `device.json` lives, the key in the credential store, the calls to
//! the backend and the heartbeat loop belong to the program that owns this
//! computer's state (the desktop app, `ownership.rs`).

use base64::Engine;
use ring::signature::Ed25519KeyPair;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::path::Path;

pub const CODE_ALPHABET: &str = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
pub const CODE_LENGTH: usize = 12;

pub fn b64(bytes: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

// ── what the backend checks (keep identical to deviceService.js) ────────────

/// The code as typed (any case, dashes optional, O as 0, I and L as 1), or None.
pub fn normalize_code(input: &str) -> Option<String> {
    let code: String = input
        .to_uppercase()
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .map(|c| match c {
            'O' => '0',
            'I' | 'L' => '1',
            other => other,
        })
        .collect();
    (code.len() == CODE_LENGTH && code.chars().all(|c| CODE_ALPHABET.contains(c))).then_some(code)
}

pub fn claim_message(code: &str, installation_id: &str, public_key: &str) -> String {
    ["cyberforge-device-claim-v1", code, installation_id, public_key].join("\n")
}

pub fn request_message(method: &str, path: &str, device_id: &str, timestamp: u64, seq: u64, body_digest: &str) -> String {
    format!("cyberforge-device-request-v1\n{}\n{}\n{}\n{}\n{}\n{}", method.to_uppercase(), path, device_id, timestamp, seq, body_digest)
}

pub fn body_digest(body: &[u8]) -> String {
    Sha256::digest(body).iter().map(|b| format!("{b:02x}")).collect()
}

/// 32 hex characters of the key's SHA-256, in groups of four: what the user compares.
pub fn key_fingerprint(public_key: &[u8]) -> String {
    let hex: String = Sha256::digest(public_key).iter().take(16).map(|b| format!("{b:02x}")).collect();
    hex.as_bytes().chunks(4).map(|c| std::str::from_utf8(c).unwrap_or("")).collect::<Vec<_>>().join(" ")
}

/// The next sequence number: the clock in milliseconds, but always above the last one.
pub fn next_seq(last: u64, now_ms: u64) -> u64 {
    now_ms.max(last + 1)
}

// ── the device file ──────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFile {
    pub installation_id: String,
    #[serde(default)]
    pub device_id: Option<String>,
    #[serde(default)]
    pub last_seq: u64,
    /// What the backend last said about this device (active, pending_approval, revoked).
    #[serde(default)]
    pub state: Option<String>,
    /// The key version the backend last confirmed (claim or rotation).
    #[serde(default)]
    pub key_version: u64,
    /// What this computer's checks confirmed at the last heartbeat, to report changes.
    #[serde(default)]
    pub last_capabilities: Option<Value>,
    /// The server's command key, given at enrollment: every command must be signed by it.
    #[serde(default)]
    pub server_command_key: Option<String>,
    /// Commands already carried out (most recent last), so a repeat is not run twice.
    #[serde(default)]
    pub done_commands: Vec<String>,
}

pub const MAX_DONE_COMMANDS: usize = 200;


/// The file at `path`, with an installation ID made and saved the first time.
pub fn load_at(path: &Path) -> Result<DeviceFile, String> {
    if let Some(file) = std::fs::read_to_string(path).ok().and_then(|t| serde_json::from_str::<DeviceFile>(&t).ok()) {
        if !file.installation_id.is_empty() {
            return Ok(file);
        }
    }
    let mut bytes = [0u8; 16];
    getrandom::fill(&mut bytes).map_err(|e| format!("could not make an installation ID: {e}"))?;
    let file = DeviceFile { installation_id: bytes.iter().map(|b| format!("{b:02x}")).collect(), ..Default::default() };
    save_at(path, &file)?;
    Ok(file)
}

pub fn save_at(path: &Path, file: &DeviceFile) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let staged = path.with_extension("json.new");
    std::fs::write(&staged, serde_json::to_string_pretty(file).unwrap_or_default()).map_err(|e| e.to_string())?;
    std::fs::rename(&staged, path).map_err(|e| e.to_string())
}


pub fn key_from_text(text: &str) -> Result<Ed25519KeyPair, String> {
    let pkcs8 = base64::engine::general_purpose::STANDARD.decode(text).map_err(|_| "a stored device key is damaged".to_string())?;
    Ed25519KeyPair::from_pkcs8(&pkcs8).map_err(|_| "a stored device key is damaged".to_string())
}

pub fn command_message(command_id: &str, device_id: &str, kind: &str, domain: &str, expires_at_ms: u64) -> String {
    format!("cyberforge-device-command-v1\n{command_id}\n{device_id}\n{kind}\n{domain}\n{expires_at_ms}")
}

/// Whether `signature` (base64) is the server key's (base64) signature of `message`.
pub fn server_signed(server_key: &str, message: &str, signature: &str) -> bool {
    let engine = base64::engine::general_purpose::STANDARD;
    match (engine.decode(server_key), engine.decode(signature)) {
        (Ok(key), Ok(sig)) => ring::signature::UnparsedPublicKey::new(&ring::signature::ED25519, key).verify(message.as_bytes(), &sig).is_ok(),
        _ => false,
    }
}

pub fn rotate_message(device_id: &str, key_version: u64, public_key: &str) -> String {
    format!("cyberforge-device-rotate-v1\n{device_id}\n{key_version}\n{public_key}")
}

pub fn sign(key: &Ed25519KeyPair, message: &str) -> String {
    b64(key.sign(message.as_bytes()).as_ref())
}


pub fn platform() -> &'static str {
    match std::env::consts::OS {
        "windows" => "windows",
        "macos" => "macos",
        "linux" => "linux",
        _ => "other",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ring::signature::KeyPair;

    // Vectors made with backend/src/services/deviceService.js and Node's crypto,
    // for the key whose 32-byte seed is all 7s (the same as the desktop's tests).
    const PUBLIC_KEY: &str = "6kpsY+KcUgq+9VB7Ey7F+ZVHdq6+vnuSQh7qaRRG0iw=";
    const FINGERPRINT: &str = "fe81 2c12 f3ab 4ce6 ac5d b69a c352 f906";
    const CLAIM_SIGNATURE: &str = "fOTi9NIZqrZpCEOjnu1AyjREsxx80w0M7kzrlMItjHa3TNN18fO5lVw8dyuqPGS/u8scofc8sRm1E7xTgwRKCA==";
    const BODY_DIGEST: &str = "3915cc7ab7eb3dcdf0e49bc3aee51953565783c2a6048653d53aa024a5d30ef4";
    const REQUEST_SIGNATURE: &str = "9z/t5YLGXbDMXwjEGdpfunomo7BzHVEhpMd9qzUI7EwMyqLAeIrf60XcTB1PhGv09IIzhQTQwhR0+NQ8y1+7Dg==";

    fn key() -> Ed25519KeyPair {
        Ed25519KeyPair::from_seed_unchecked(&[7u8; 32]).unwrap()
    }

    #[test]
    fn messages_and_signatures_match_the_backend() {
        assert_eq!(b64(key().public_key().as_ref()), PUBLIC_KEY);
        assert_eq!(key_fingerprint(key().public_key().as_ref()), FINGERPRINT);
        let code = normalize_code("abcd-0011-wxyz").unwrap();
        assert_eq!(sign(&key(), &claim_message(&code, "install-0001", PUBLIC_KEY)), CLAIM_SIGNATURE);
        assert_eq!(body_digest(br#"{"capabilities":{"secure_storage":"ok"}}"#), BODY_DIGEST);
        let message = request_message("post", "/api/v1/devices/dev-1/heartbeat", "dev-1", 1_792_100_000_000, 1_792_100_000_000, BODY_DIGEST);
        assert_eq!(sign(&key(), &message), REQUEST_SIGNATURE);
    }

    #[test]
    fn sequence_numbers_only_go_up() {
        assert_eq!(next_seq(10, 5), 11);
        assert_eq!(next_seq(10, 50), 50);
    }

    #[test]
    fn the_device_file_is_made_once_and_kept() {
        let dir = std::env::temp_dir().join(format!("cf-core-device-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let path = dir.join("device.json");
        let first = load_at(&path).unwrap();
        assert_eq!(first.installation_id.len(), 32);
        assert_eq!(load_at(&path).unwrap(), first, "the installation ID is kept");
        let _ = std::fs::remove_dir_all(dir);
    }
}
