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
/// Candidate locations for the user-editable `hf_config.json`. Checked in order
/// so it works both in `tauri dev` (cwd = src-tauri) and a packaged build.
fn hf_config_candidates() -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = Vec::new();
    if let Ok(p) = std::env::var("HF_CONFIG") {
        if !p.trim().is_empty() {
            v.push(PathBuf::from(p));
        }
    }
    if let Some(d) = config_dir() {
        v.push(d.join("hf_config.json"));
    }
    if let Ok(cwd) = std::env::current_dir() {
        v.push(cwd.join("hf_config.json"));
        if let Some(parent) = cwd.parent() {
            v.push(parent.join("hf_config.json"));
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            v.push(dir.join("hf_config.json"));
        }
    }
    v
}

/// Read the Hugging Face token from the editable `hf_config.json`. Accepts any
/// of: `{"active": "hf_…"}`, `{"hf_token"/"token": "hf_…"}`, or a `{"tokens":
/// ["hf_new", "hf_old"]}` array (the first non-empty entry is used — so swapping
/// a token is just adding a new one to the top of the list).
pub fn hf_token_from_config() -> Option<String> {
    for path in hf_config_candidates() {
        let Ok(s) = std::fs::read_to_string(&path) else { continue };
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) else { continue };
        for key in ["active", "hf_token", "token"] {
            if let Some(t) = v.get(key).and_then(|x| x.as_str()) {
                let t = t.trim();
                if !t.is_empty() {
                    return Some(t.to_string());
                }
            }
        }
        if let Some(arr) = v.get("tokens").and_then(|x| x.as_array()) {
            for it in arr {
                if let Some(t) = it.as_str() {
                    let t = t.trim();
                    if !t.is_empty() {
                        return Some(t.to_string());
                    }
                }
            }
        }
    }
    None
}

pub fn get_hf_token() -> Option<String> {
    // 1) explicit environment override
    if let Ok(t) = std::env::var("HF_TOKEN") {
        let t = t.trim().to_string();
        if !t.is_empty() {
            return Some(t);
        }
    }
    // 2) the permanent, user-editable hf_config.json (takes priority over the
    //    keychain so editing the file actually changes the token in use)
    if let Some(t) = hf_token_from_config() {
        return Some(t);
    }
    // 3) OS keychain (what the in-app "Connect DeepSeek" dialog writes)
    if let Some(t) = Entry::new(SERVICE_NAME, "hf_token")
        .ok()
        .and_then(|e| e.get_password().ok())
    {
        if !t.trim().is_empty() {
            return Some(t);
        }
    }
    // 4) the internal session.json fallback
    file_get("hf_token").filter(|t| !t.trim().is_empty())
}

/// The permanent, user-editable HF config file in the stable app-config dir
/// (`%APPDATA%\com.cyberforge.console\hf_config.json`). This is the location
/// `get_hf_token()` checks first (after the env var), so writing here makes a
/// token saved from Settings the one actually used — and it survives restarts.
fn hf_config_file() -> Option<PathBuf> {
    config_dir().map(|d| d.join("hf_config.json"))
}

/// Persist the token into the editable `hf_config.json` (`active` + a short
/// `tokens` history so swapping back is easy). Keeps the most recent 5.
fn write_hf_config(token: &str) {
    let Some(path) = hf_config_file() else { return };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let mut tokens: Vec<String> = vec![token.to_string()];
    if let Some(v) = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
    {
        if let Some(arr) = v.get("tokens").and_then(|x| x.as_array()) {
            for it in arr {
                if let Some(t) = it.as_str() {
                    let t = t.trim().to_string();
                    if !t.is_empty() && !tokens.contains(&t) {
                        tokens.push(t);
                    }
                }
            }
        }
    }
    tokens.truncate(5);
    let body = serde_json::json!({
        "_comment": "CyberForge AI (DeepSeek via Hugging Face). `active` is the token in use; `tokens` keeps recent ones. Saved from Settings → AI & Models, or edit this file directly. Local to this machine; never committed.",
        "active": token,
        "tokens": tokens,
    });
    let _ = std::fs::write(
        &path,
        serde_json::to_string_pretty(&body).unwrap_or_else(|_| "{}".into()),
    );
}

/// Persist the HF token. Written to (a) the editable `hf_config.json` in the
/// app-config dir — the source `get_hf_token()` prefers, so the saved token
/// takes effect immediately — plus (b) the OS keychain and (c) the session-file
/// fallback. Set by the user from Settings → AI & Models; never embedded.
pub fn store_hf_token(token: &str) -> Result<(), String> {
    write_hf_config(token);
    if let Ok(e) = Entry::new(SERVICE_NAME, "hf_token") {
        let _ = e.set_password(token);
    }
    file_set("hf_token", token);
    Ok(())
}

/// The effective HF token and where it was resolved from — for the settings
/// screen to display the saved token (it shows what is actually in use).
pub fn hf_token_info() -> (Option<String>, &'static str) {
    if let Ok(t) = std::env::var("HF_TOKEN") {
        let t = t.trim().to_string();
        if !t.is_empty() {
            return (Some(t), "environment");
        }
    }
    if let Some(t) = hf_token_from_config() {
        return (Some(t), "config file");
    }
    if let Some(t) = Entry::new(SERVICE_NAME, "hf_token")
        .ok()
        .and_then(|e| e.get_password().ok())
    {
        if !t.trim().is_empty() {
            return (Some(t), "keychain");
        }
    }
    if let Some(t) = file_get("hf_token").filter(|t| !t.trim().is_empty()) {
        return (Some(t), "session");
    }
    (None, "none")
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
