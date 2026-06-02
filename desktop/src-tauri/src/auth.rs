//! Secure auth-token + user-profile storage so a session survives app restarts.
//!
//! Two backends are written together: the OS keychain (secure, primary) and a
//! JSON file under the app-config dir (reliable fallback). The file means
//! persistent login keeps working even if the keychain is unavailable on a given
//! machine — a real failure mode we hit on Windows. Reads prefer the keychain
//! and fall back to the file.

use keyring::Entry;
use std::path::PathBuf;

const SERVICE_NAME: &str = "com.cyberforge.console";

/// `%APPDATA%\com.cyberforge.console` (Win) / `~/Library/Application Support/…`
/// (mac) / `~/.config/…` (Linux) — matches Tauri's app-config dir.
fn config_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        return std::env::var("APPDATA").ok().map(|b| PathBuf::from(b).join(SERVICE_NAME));
    }
    #[cfg(target_os = "macos")]
    {
        return std::env::var("HOME").ok().map(|h| {
            PathBuf::from(h).join("Library").join("Application Support").join(SERVICE_NAME)
        });
    }
    #[cfg(target_os = "linux")]
    {
        return std::env::var("XDG_CONFIG_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| std::env::var("HOME").ok().map(|h| PathBuf::from(h).join(".config")))
            .map(|b| b.join(SERVICE_NAME));
    }
    #[allow(unreachable_code)]
    None
}

fn session_file() -> Option<PathBuf> {
    config_dir().map(|d| d.join("session.json"))
}

fn file_read() -> serde_json::Value {
    session_file()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(serde_json::Value::Null)
}

/// Generic single-key persistence in the (gitignored) session file.
fn file_set(key: &str, value: &str) {
    let Some(path) = session_file() else { return };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let mut v = file_read();
    if !v.is_object() {
        v = serde_json::json!({});
    }
    if let Some(obj) = v.as_object_mut() {
        obj.insert(key.to_string(), serde_json::Value::String(value.to_string()));
    }
    let _ = std::fs::write(path, v.to_string());
}

fn file_get(key: &str) -> Option<String> {
    file_read().get(key).and_then(|v| v.as_str()).map(String::from)
}

/// Merge the given field(s) into the session file (creating it if needed).
fn file_write(token: Option<&str>, user_json: Option<&str>) {
    let Some(path) = session_file() else { return };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let mut v = file_read();
    if !v.is_object() {
        v = serde_json::json!({});
    }
    if let Some(obj) = v.as_object_mut() {
        if let Some(t) = token {
            obj.insert("token".into(), serde_json::Value::String(t.to_string()));
        }
        if let Some(u) = user_json {
            obj.insert(
                "user".into(),
                serde_json::from_str(u).unwrap_or(serde_json::Value::Null),
            );
        }
    }
    let _ = std::fs::write(path, v.to_string());
}

pub fn store_token(token: &str) -> Result<(), String> {
    let kc = Entry::new(SERVICE_NAME, "auth_token").and_then(|e| e.set_password(token));
    file_write(Some(token), None);
    #[cfg(debug_assertions)]
    eprintln!(
        "[cyberforge] store_token: keychain={} file={}",
        if kc.is_ok() { "ok" } else { "failed" },
        session_file().map(|p| p.display().to_string()).unwrap_or_default()
    );
    Ok(())
}

/// Cache the user profile (JSON) alongside the token so the session can be
/// restored offline, without a backend round-trip.
pub fn store_user(user_json: &str) {
    if let Ok(e) = Entry::new(SERVICE_NAME, "auth_user") {
        let _ = e.set_password(user_json);
    }
    file_write(None, Some(user_json));
}

pub fn get_stored_token() -> Option<String> {
    if let Some(t) = Entry::new(SERVICE_NAME, "auth_token")
        .ok()
        .and_then(|e| e.get_password().ok())
    {
        return Some(t);
    }
    file_read().get("token").and_then(|v| v.as_str()).map(String::from)
}

pub fn get_stored_user() -> Option<String> {
    if let Some(u) = Entry::new(SERVICE_NAME, "auth_user")
        .ok()
        .and_then(|e| e.get_password().ok())
    {
        return Some(u);
    }
    file_read()
        .get("user")
        .filter(|v| !v.is_null())
        .map(|v| v.to_string())
}

/// HF Inference token for direct DeepSeek calls. Resolved from the `HF_TOKEN`
/// env var first, then the OS keychain, then the gitignored session file. It is
/// NEVER written to source or git — only the keychain / per-user config dir.
pub fn get_hf_token() -> Option<String> {
    if let Ok(t) = std::env::var("HF_TOKEN") {
        let t = t.trim().to_string();
        if !t.is_empty() {
            return Some(t);
        }
    }
    if let Some(t) = Entry::new(SERVICE_NAME, "hf_token")
        .ok()
        .and_then(|e| e.get_password().ok())
    {
        if !t.trim().is_empty() {
            return Some(t);
        }
    }
    file_get("hf_token").filter(|t| !t.trim().is_empty())
}

/// Persist the HF token in the OS keychain (+ file fallback). Set once by the
/// user from the AI Assistance screen; never embedded in the app.
pub fn store_hf_token(token: &str) -> Result<(), String> {
    if let Ok(e) = Entry::new(SERVICE_NAME, "hf_token") {
        let _ = e.set_password(token);
    }
    file_set("hf_token", token);
    Ok(())
}

pub fn delete_token() -> Result<(), String> {
    if let Ok(e) = Entry::new(SERVICE_NAME, "auth_token") {
        let _ = e.delete_credential();
    }
    if let Ok(e) = Entry::new(SERVICE_NAME, "auth_user") {
        let _ = e.delete_credential();
    }
    if let Some(p) = session_file() {
        let _ = std::fs::remove_file(p);
    }
    Ok(())
}
